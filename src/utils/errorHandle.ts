import { Alert } from 'react-native'
// import { exitApp } from '@/utils/common'
import { setJSExceptionHandler, setNativeExceptionHandler } from 'react-native-exception-handler'
import { log } from '@/utils/log'

// 解析类异常（音源 / 网络返回非 JSON 文本，如 "ok"、"[object Object]"、HTML、被截断的分片）
// 属于业务数据问题，不应升级为全局 Fatal 弹窗，这里仅记录日志，
// 由对应业务模块自行提示“加载失败”，避免反复弹窗打断播放。
const isParseError = (e: any) => {
  if (!e) return false
  const msg = String(e.message ?? '')
  return (e.name === 'SyntaxError' || /SyntaxError/i.test(msg)) &&
    /JSON|Unexpected (character|token|end)|unexpected end of/i.test(msg)
}

const errorHandler = (e: Error, isFatal: boolean) => {
  if (isFatal && !isParseError(e)) {
    Alert.alert(
      '💥Unexpected error occurred💥',
      `
应用出 bug 了😭，以下是错误异常信息。请截图并在 GitHub 反馈（并附上刚才你进行了什么操作）。现在应用可能会出现异常，若出现异常请尝试强制结束应用后重新启动！

Error:
${isFatal ? 'Fatal:' : ''} ${e.name} ${e.message}
`,
      [{
        text: '关闭 (Close)',
        onPress: () => {
          // exitApp()
        },
      }],
    )
  }
  log.error(e.stack)
}

if (process.env.NODE_ENV !== 'development') {
  setJSExceptionHandler(errorHandler)

  setNativeExceptionHandler((errorString) => {
    log.error(errorString)
    console.log('+++++', errorString, '+++++')
  }, false)
}
