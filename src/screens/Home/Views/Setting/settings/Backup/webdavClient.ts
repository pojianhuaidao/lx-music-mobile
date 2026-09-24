import { LX_BACKUP_DIR, LX_DATA_FILE_NAME } from '@/config/constant'

export interface WebdavConfig {
  server: string
  username: string
  password: string
}

const getAuthHeader = (username: string, password: string) => `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

const normalizeServer = (server: string) => server.trim().replace(/\/+$/, '')
const buildUrl = (server: string, path: string) => {
  const base = normalizeServer(server)
  return path ? `${base}/${path.replace(/^\/+/, '')}` : base
}

const request = async(config: WebdavConfig, method: string, path: string, body?: string) => {
  return await fetch(buildUrl(config.server, path), {
    method,
    headers: {
      Authorization: getAuthHeader(config.username, config.password),
      ...(body != null ? { 'Content-Type': 'application/octet-stream' } : {}),
    },
    body,
  })
}

/**
 * 确保远端存在 LX Backup 目录（不存在则自动创建）
 */
export const ensureBackupDir = async(config: WebdavConfig) => {
  const resp = await request(config, 'PROPFIND', LX_BACKUP_DIR)
  if (resp.ok) return
  if (resp.status === 404 || resp.status === 405) {
    const mkcolResp = await request(config, 'MKCOL', LX_BACKUP_DIR)
    if (!mkcolResp.ok && mkcolResp.status !== 405) {
      throw new Error(`MKCOL failed: ${mkcolResp.status}`)
    }
    return
  }
  throw new Error(`PROPFIND failed: ${resp.status}`)
}

/**
 * 导出数据到 WebDAV（自动创建 LX Backup 目录并上传 lx_data.lxmc）
 */
export const uploadBackupData = async(config: WebdavConfig, data: string) => {
  await ensureBackupDir(config)
  const resp = await request(config, 'PUT', `${LX_BACKUP_DIR}/${LX_DATA_FILE_NAME}`, data)
  if (!resp.ok) throw new Error(`PUT failed: ${resp.status}`)
}

/**
 * 从 WebDAV 下载备份数据（LX Backup/lx_data.lxmc），返回 JSON 文本
 */
export const downloadBackupData = async(config: WebdavConfig): Promise<string> => {
  const resp = await request(config, 'GET', `${LX_BACKUP_DIR}/${LX_DATA_FILE_NAME}`)
  if (!resp.ok) throw new Error(`GET failed: ${resp.status}`)
  return await resp.text()
}
