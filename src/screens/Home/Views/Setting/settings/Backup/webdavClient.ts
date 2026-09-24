import { LX_BACKUP_DIR, LX_DATA_FILE_NAME } from '@/config/constant'

export interface WebdavConfig {
  server: string
  username: string
  password: string
}

const getAuthHeader = (username: string, password: string) => `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

const normalizeServer = (server: string) => server.trim().replace(/\/+$/, '')
/** 路径逐段 URL 编码（空格→%20、中文→百分号编码），避免未编码空格/特殊字符导致服务器拒绝请求 */
const encodePath = (path: string) => path.split('/').filter(Boolean).map(seg => encodeURIComponent(seg)).join('/')
const buildUrl = (server: string, path: string) => {
  const base = normalizeServer(server)
  return path ? `${base}/${encodePath(path)}` : base
}

const request = async(config: WebdavConfig, method: string, path: string, body?: string) => {
  const resp = await fetch(buildUrl(config.server, path), {
    method,
    headers: {
      Authorization: getAuthHeader(config.username, config.password),
      // WebDAV PUT 标准头：允许覆盖已存在文件，部分服务器依赖该头
      ...(method === 'PUT' ? { Overwrite: 'T' } : {}),
      ...(body != null ? { 'Content-Type': 'application/octet-stream' } : {}),
    },
    body,
  })
  return resp
}

/** 读取响应体（WebDAV 错误常为 XML/文本，含服务器侧具体原因），失败返回空串 */
const readErrorDetail = async(resp: Response): Promise<string> => {
  try {
    const text = await resp.text()
    return text ? `: ${text.slice(0, 200)}` : ''
  } catch {
    return ''
  }
}

const statusText = (resp: Response) => `${resp.status}${resp.statusText ? ` ${resp.statusText}` : ''}`

/**
 * 确保远端存在目标目录（不存在则逐级 MKCOL 自动创建）。
 * 目录路径支持多级（如 "LX Backup/子目录"），逐级创建保证父目录齐全。
 * MKCOL 返回 405（服务器不支持建目录）/ 409（目录已存在）/ 301（重定向）均不中断：
 * 405 保留 PUT 兜底（部分服务器允许 PUT 直接创建文件），409/301 视为目录已存在。
 */
const ensureRemoteDir = async(config: WebdavConfig, dirPath: string) => {
  const segments = dirPath.split('/').filter(Boolean)
  let current = ''
  for (const seg of segments) {
    current = current ? `${current}/${seg}` : seg
    const prop = await request(config, 'PROPFIND', current)
    if (prop.ok) continue
    if (prop.status === 401 || prop.status === 403) {
      throw new Error(`PROPFIND failed: ${statusText(prop)}${await readErrorDetail(prop)}`)
    }
    const mk = await request(config, 'MKCOL', current)
    if (!mk.ok && mk.status !== 405 && mk.status !== 409 && mk.status !== 301) {
      throw new Error(`MKCOL failed: ${statusText(mk)} (${current})${await readErrorDetail(mk)}`)
    }
  }
}

/**
 * 确保远端存在 LX Backup 目录（不存在则自动创建）
 */
export const ensureBackupDir = async(config: WebdavConfig) => {
  await ensureRemoteDir(config, LX_BACKUP_DIR)
}

/**
 * 导出数据到 WebDAV（自动创建 LX Backup 目录并上传 lx_data.lxmc）
 */
export const uploadBackupData = async(config: WebdavConfig, data: string) => {
  await ensureBackupDir(config)
  const resp = await request(config, 'PUT', `${LX_BACKUP_DIR}/${LX_DATA_FILE_NAME}`, data)
  if (!resp.ok) {
    const detail = await readErrorDetail(resp)
    throw new Error(`PUT failed: ${statusText(resp)}${detail}${resp.status === 405 ? '（服务器拒绝上传，请检查 NAS/服务端 WebDAV 是否允许写入、是否启用 PUT/MKCOL 方法、账号对备份目录是否有写权限）' : ''}`)
  }
}

/**
 * 从 WebDAV 下载备份数据（LX Backup/lx_data.lxmc），返回 JSON 文本
 */
export const downloadBackupData = async(config: WebdavConfig): Promise<string> => {
  const resp = await request(config, 'GET', `${LX_BACKUP_DIR}/${LX_DATA_FILE_NAME}`)
  if (!resp.ok) {
    const detail = await readErrorDetail(resp)
    throw new Error(`GET failed: ${statusText(resp)}${detail}`)
  }
  return await resp.text()
}

