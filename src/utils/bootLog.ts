const logs: string[] = []

// 冷启动计时起点：模块加载即开始计时，配合各 init 段打点量化阶段耗时
let lastBootLogTime = Date.now()

export const bootLog = (...msgs: any[]) => {
  const now = Date.now()
  const elapsed = now - lastBootLogTime
  lastBootLogTime = now
  logs.push(`[${now}] [+${elapsed}ms] ${msgs.map(m => typeof m == 'string' ? m : JSON.stringify(m)).join(' ')}`)
}

export const getBootLog = () => {
  return logs.join('\n')
}

