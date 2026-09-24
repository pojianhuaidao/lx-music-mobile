/**
 * 默认音乐源配置
 * 可以在此添加或修改预设的音乐源 URL
 *
 * 注意：内置音源（flower/grass/juhe 等）统一由 seedBuiltin 注入
 * （assets/lx-builtin-user-api/），此处若再配置同源 URL 会导致
 * 「野花/野草」等音源被 defaultSources 与 seedBuiltin 双路径重复注入，
 * 故默认源列表保持为空。
 */

export interface DefaultMusicSource {
  name: string
  url: string
}

// 每次修改默认源列表时，递增此版本号，触发升级用户重新导入
// 注意：不要递增——递增会触发 defaultSources.ts 中「清除全部旧音源后重导」逻辑，
// 可能误删用户自建音源与 seedBuiltin 已注入的内置音源
export const DEFAULT_SOURCES_VERSION = 2

const defaultMusicSources: DefaultMusicSource[] = []

export default defaultMusicSources
