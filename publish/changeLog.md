### 其他

- 清理废代码：移除自动更新链路（core/version、VersionModal 及其注册、store/version、utils/version.js 的 downloadNewVersion/updateApp、ignoreVersion 相关存储键与事件）及 16 个无引用导出（setDesktopLyricPosition、scanFolder、updateUserListPosition、clearListMusics、getSortList、parseUrlParams、scaleSizeHR、onWindowSizeChange、handleAddToList、useSourceNames、useDownloadConfig、useRunningDownloadsCount、onModalDismissed、useNavigationCommandComplete、useNavigationComponentDidDisappear、useAsyncStorage）与 2 个无引用文件（cryptoTest.ts、ScaledImage.tsx），不涉及功能变更

### 修改

- 备份与恢复：支持按需勾选备份「播放列表（含默认/喜欢/自建列表）、本地音乐列表、音源、设置数据」，导入/导出按钮改为「导入数据」「导出数据」
- 移除数据同步功能（设置入口、同步插件、同步 Store、同步模式弹窗及相关依赖），保留历史同步数据（无损）
- 移除内置音源「独家音源V4」「ikun音源」，seedBuiltin 不再注入并在 REMOVED_BUILTIN_USER_APIS 登记清理，旧版本升级残留自动移除

### 新增

- 播放失败自动换源：默认开启，播放中两分钟未开始播放且当前音源未取得有效播放地址时，自动切换其它音源重试，单曲最多尝试 2 次
- 备份新增 WebDAV 支持：填写服务器地址/账号/密码即可导出数据到 WebDAV（自动创建 LX Backup 文件夹）或从 WebDAV 导入数据

### 优化

- 播放列表备份仅勾选「播放列表」时仍导出 playList_v2 格式，兼容桌面版导入


### 修复

- 修复备份恢复时主题偏好被旧备份值静默改写的问题，恢复完成后自动重新应用主题（「跟随系统」开关不再被覆盖）
- 音源初始化恢复串行等待完成后再进入主界面，解决「初始化失败 / 一直获取URL」问题
- 远程默认音源全部加载失败时回退使用现有音源列表首个，避免默认音源丢失
- 移除与野花 / 野草重复的聚合API接口(CF)音源，并自动清理旧版本升级残留
- 修复 Metro 打包阶段模块解析失败导致构建中断

### 新增

- 歌词页：上下滑动歌词时，停留的歌词行会显示时间条（左侧为该句时间、右侧为播放按钮），点击播放按钮即可从该句开始播放
- 歌词页：直接点击任意歌词行即可跳转到该句播放，暂停状态下会自动开始播放（竖屏 / 横屏均支持）

### 优化

- 歌词页：滑动后 5 秒内无操作，自动回到当前正在播放的歌词位置
- 播放页设置中的「显示歌词进度调整」默认开启
- 内置音源注入增加自动去重（按脚本内容哈希），避免重复音源

### 其他

- 更新源改为本 fork（pojianhuaidao/lx-music-mobile），不再查询原版 lyswhut 仓库的 npm / gitee / 第三方镜像
- 新增 `npm run bump` 脚本，自动递增 version 与 versionCode
- GitHub Actions 支持 main 分支推送后自动打包签名 APK 并发布 Release
