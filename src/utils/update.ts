import { httpGet } from '@/utils/request'
import { downloadFile, existsFile, unlink } from '@/utils/fs'
import { getBuildNumber, getBuildTime, installApk } from '@/utils/nativeModules/utils'
import { version } from '../../package.json'

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

let buildNumberPromise: Promise<number> | null = null
// 本地 APK 的 CI build number（构建时注入的 BUILD_NUMBER，本地构建为 0）；旧版本无注入时为 0
export const getLocalBuildNumber = async() => {
  if (buildNumberPromise) return buildNumberPromise
  buildNumberPromise = (async() => {
    try {
      return await getBuildNumber()
    } catch {
      return 0
    }
  })()
  return buildNumberPromise
}

/**
 * 检查 GitHub Releases 是否有新版本。
 * 对比规则：① 版本号优先；② 版本号相同且本地 build 号有效（>0，CI 发布版注入 BUILD_NUMBER）时，
 * 仅比较 build 号：remoteBuild > localBuild 才判定有新版本，相等即同版本（不提示）；
 * ③ 仅当本地 build 号缺失/为 0（旧版本或本地构建）时，才用发布时间兜底（远端 release 发布时间
 * vs 本地构建注入时间）。注意：build 号相等时严禁走发布时间兜底——构建开始时间必然早于
 * Release 发布时间，会稳定误判为新版本。
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
    const localBuild = await getLocalBuildNumber()
    if (localBuild > 0) {
      // 本地 build 号有效（CI 发布版）：仅比较 build 号，相等即同版本，绝不误报
      return remoteBuild > localBuild ? makeInfo() : null
    }
    // 本地 build 号缺失/为 0（旧版本或本地构建）：build 号不可比，退化为发布时间兜底
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
