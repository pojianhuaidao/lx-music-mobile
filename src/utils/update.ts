import { httpGet } from '@/utils/request'
import { downloadFile, existsFile, unlink } from '@/utils/fs'
import { getBuildTime, installApk } from '@/utils/nativeModules/utils'
import { version, versionCode } from '../../package.json'

const REPO = 'pojianhuaidao/lx-music-mobile'
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`

// GitHub 直连失败时依次尝试的镜像加速前缀（按顺序兜底）
const DOWNLOAD_MIRRORS = [
  (url: string) => url,
  (url: string) => `https://ghproxy.net/${url}`,
  (url: string) => `https://ghfast.top/${url}`,
  (url: string) => `https://gh-proxy.com/${url}`,
  (url: string) => `https://mirror.ghproxy.com/${url}`,
]

export interface UpdateInfo {
  version: string
  build: number
  name: string
  notes: string
  publishedAt: number
  downloadUrl: string
  assetName: string
  assetSize: number
}

interface GitHubAsset {
  name?: string
  browser_download_url?: string
  size?: number
}
interface GitHubRelease {
  tag_name?: string
  name?: string
  body?: string | null
  published_at?: string
  draft?: boolean
  assets?: GitHubAsset[]
}

// 解析 tag：v{version}-build{run_number}，如 v1.9.2-build123
const parseTag = (tag: string) => {
  const m = /^v?(\d+\.\d+\.\d+)(?:-build(\d+))?/i.exec(tag.trim())
  if (!m) return null
  return { version: m[1], build: m[2] ? parseInt(m[2], 10) : 0 }
}

const compareVersion = (a: string, b: string) => {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff) return diff > 0 ? 1 : -1
  }
  return 0
}

const requestLatestRelease = async(url: string): Promise<GitHubRelease> => {
  const request = async() => new Promise<GitHubRelease>((resolve, reject) => {
    httpGet(url, { timeout: 15000 }, (err: any, resp: any, body: any) => {
      if (err || !resp || resp.statusCode !== 200) reject(err ?? new Error(`请求失败：${resp?.statusCode ?? 'unknown'}`))
      else resolve(body as GitHubRelease)
    })
  })
  let lastErr: Error | null = null
  for (let i = 0; i < 3; i++) {
    try {
      return await request()
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastErr ?? new Error('获取更新信息失败')
}

let buildTimePromise: Promise<number> | null = null
// 本地 APK 的构建时间（构建时注入的 BUILD_TIME，epoch 秒）；旧版本无注入时为 0
export const getLocalBuildTime = async() => {
  if (buildTimePromise) return buildTimePromise
  buildTimePromise = (async() => {
    try {
      return await getBuildTime()
    } catch {
      return 0
    }
  })()
  return buildTimePromise
}

/**
 * 检查 GitHub Releases 是否有新版本。
 * 对比规则：① 版本号优先；② 版本号相同比较 build 号（远端 CI run_number vs 本地 versionCode）；
 * ③ 再比较发布时间（远端 release 发布时间 vs 本地构建注入时间），避免本地构建无 build 号时漏检。
 */
export const checkUpdate = async(): Promise<UpdateInfo | null> => {
  const release = await requestLatestRelease(RELEASE_API)
  if (!release || release.draft) return null
  const tagInfo = parseTag(release.tag_name ?? release.name ?? '')
  if (!tagInfo) return null
  const asset = (release.assets ?? []).find(a => /arm64-v8a\.apk$/i.test(a.name ?? ''))
  if (!asset?.browser_download_url) return null

  const remoteVersion = tagInfo.version
  const remoteBuild = tagInfo.build
  const publishedAt = release.published_at ? Math.floor(new Date(release.published_at).getTime() / 1000) : 0

  const makeInfo = (): UpdateInfo => ({
    version: remoteVersion,
    build: remoteBuild,
    name: release.name ?? remoteVersion,
    notes: release.body ?? '',
    publishedAt,
    downloadUrl: asset.browser_download_url!,
    assetName: asset.name ?? '',
    assetSize: asset.size ?? 0,
  })

  const verCmp = compareVersion(remoteVersion, version)
  if (verCmp > 0) return makeInfo()
  if (verCmp === 0) {
    if (remoteBuild > versionCode) return makeInfo()
    const buildTime = await getLocalBuildTime()
    if (buildTime > 0 && publishedAt > buildTime) return makeInfo()
  }
  return null
}

export const getApkDownloadUrls = (url: string) => DOWNLOAD_MIRRORS.map(fn => fn(url))

// 下载 APK：直连失败自动切换到镜像源，全部失败则抛出最后一次错误
export const downloadUpdateApk = async(url: string, filePath: string, onProgress?: (received: number, total: number) => void) => {
  const urls = getApkDownloadUrls(url)
  let lastErr: Error | null = null
  for (const downloadUrl of urls) {
    if (await existsFile(filePath)) {
      try { await unlink(filePath) } catch {}
    }
    try {
      const ret = downloadFile(downloadUrl, filePath, {
        connectionTimeout: 20000,
        readTimeout: 30000,
        progressDivider: 1,
        progress: onProgress
          ? res => { onProgress(res.bytesWritten, res.contentLength || 0) }
          : undefined,
      })
      const res = await ret.promise
      if (res.statusCode !== 200) throw new Error(`下载失败（${res.statusCode}）`)
      if (!(await existsFile(filePath))) throw new Error('下载文件不存在')
      return filePath
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastErr ?? new Error('下载失败')
}

// 安装已下载的 APK（FileProvider authority 与 AndroidManifest 中 ${applicationId}.provider 一致）
export const installUpdateApk = async(filePath: string) => {
  await installApk(filePath, 'cn.toside.music.mobile.provider')
}
