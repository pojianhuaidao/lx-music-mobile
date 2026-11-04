import { log } from '../log'

/**
 * 安全解析 JSON 字符串
 * 当网络返回内容不是合法 JSON（如 "[object Object]"、纯文本 "ok"、HTML 页面等）时，
 * 记录日志并返回 fallback，避免 JSON.parse 抛错中断整条业务流程
 * @param {any} raw 待解析内容
 * @param {any} fallback 解析失败时返回的安全值
 * @param {string} tag 调用点标识，便于日志定位
 * @returns {any} 解析结果或 fallback
 */
export const safeParse = (raw, fallback = null, tag = '') => {
  try {
    return JSON.parse(raw)
  } catch (err) {
    log.error(`safeParse failed${tag ? ` [${tag}]` : ''}: ${err instanceof Error ? err.message : String(err)} | raw=${String(raw).slice(0, 200)}`)
    return fallback
  }
}

export default safeParse
