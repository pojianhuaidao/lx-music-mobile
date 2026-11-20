const defaultSetting: LX.AppSetting = {
  version: '2.0',
  'common.isAutoTheme': true,
  'common.langId': 'zh_cn',
  'common.apiSource': '',
  'common.sourceNameType': 'real',
  'common.shareType': 'system',
  'common.isAgreePact': true,
  'common.autoHidePlayBar': true,
  'common.drawerLayoutPosition': 'left',
  'common.homePageScroll': true,
  'common.allowProgressBarSeek': true,
  'common.showBackBtn': false,
  'common.showExitBtn': true,
  'common.alwaysKeepStatusbarHeight': false,
  'common.iconTheme': 'default',

  'player.startupAutoPlay': false,
  'player.startupPushPlayDetailScreen': false,
  'player.togglePlayMethod': 'listLoop',
  'player.playQuality': 'flac24bit',
  'player.isSavePlayTime': true,
  'player.volume': 1,
  'player.playbackRate': 1,
  'player.cacheSize': '1024',
  'player.timeoutExit': '',
  'player.timeoutExitPlayed': true,
  'player.isAutoCleanPlayedList': false,
  'player.isHandleAudioFocus': true,
  'player.isEnableAudioOffload': true,
  'player.isShowLyricTranslation': false,
  'player.isShowLyricRoma': false,
  'player.isShowNotificationImage': true,
  'player.isS2t': false,
  'player.isShowBluetoothLyric': false,
  'player.autoSwitchSource': true,

  // 'playDetail.isZoomActiveLrc': false,
  // 'playDetail.isShowLyricProgressSetting': false,
  'playDetail.style.align': 'left',
  'playDetail.vertical.style.lrcFontSize': 210,
  'playDetail.horizontal.style.lrcFontSize': 220,
  'playDetail.isShowLyricProgressSetting': true,
  'playDetail.defaultShowLyric': true,

  'desktopLyric.enable': false,
  'desktopLyric.isLock': false,
  'desktopLyric.width': 100,
  'desktopLyric.maxLineNum': 5,
  'desktopLyric.isSingleLine': false,
  'desktopLyric.showToggleAnima': true,
  'desktopLyric.position.x': 0,
  'desktopLyric.position.y': 0,
  'desktopLyric.textPosition.x': 'left',
  'desktopLyric.textPosition.y': 'top',
  'desktopLyric.style.fontSize': 180,
  'desktopLyric.style.opacity': 100,
  'desktopLyric.style.lyricUnplayColor': 'rgba(255, 255, 255, 1)',
  'desktopLyric.style.lyricPlayedColor': 'rgba(7, 197, 86, 1)',
  'desktopLyric.style.lyricShadowColor': 'rgba(0, 0, 0, 0.6)',

  'search.isShowHotSearch': false,
  'search.isShowHistorySearch': false,

  'list.isClickPlayList': true,
  'list.isShowSource': true,
  'list.isShowAlbumName': false,
  'list.isShowInterval': true,
  'list.isSaveScrollLocation': true,
  'list.addMusicLocationType': 'top',

  'download.fileName': '歌名 - 歌手',
  'download.savePath': '/storage/emulated/0/Music/LXMusic',
  'download.maxDownloadNum': 3,
  'download.autoSwitchSource': false,
  'download.embedCover': true,
  'download.embedLyric': true,
  'download.embedLyricTranslation': true,
  'download.embedLyricRoma': true,

  // 'theme.id': 'blue_plus',
  'theme.id': 'green',
  'theme.lightId': 'green',
  'theme.darkId': 'black',
  'theme.hideBgDark': false,
  'theme.dynamicBg': false,
  'theme.fontShadow': false,
  'theme.glassBg': false,
  'theme.glassOpacity': 0.55,
  // 外观皮肤 id，default = 洛雪原版外观，其他值由 src/skin/registry.ts 注册
  'theme.skinId': 'default',

  // 本地音乐：默认只播本地文件，解码失败不静默换成在线源
  'local.playbackMode': 'localOnly',
  // 本地音乐解码内核：auto = 系统内核优先、不足时切内置 FFmpeg 内核；system = 只用系统内核
  'local.decodeKernel': 'auto',
  'local.allowOnlinePic': true,
  'local.allowOnlineLyric': true,
  'local.filter.enabled': false,
  'local.filter.minDuration': 0,
  'local.filter.maxDuration': 0,
  'local.filter.exts': '',
  'local.filter.onlyDecodable': false,
}


// 使用新年皮肤
if (new Date().getMonth() < 2) {
  defaultSetting['theme.id'] = 'happy_new_year'
  defaultSetting['desktopLyric.style.lyricPlayedColor'] = 'rgba(255, 18, 34, 1)'
}

export default defaultSetting
