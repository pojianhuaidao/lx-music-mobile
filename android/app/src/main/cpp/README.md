# FFmpeg 音频桥接模块（方案A）

本地音乐的原生解码回退通道：当 Media3/ExoPlayer 缺少对应容器或解码器（ape / wma·asf / dsf / dff / tak / tta 等）时，
由本模块用 libavformat + libavcodec + libswresample 自行解封装、解码、重采样，输出 S16 PCM 交给 AudioTrack 播放。

## 目录结构

```
android/app/src/main/cpp/
├── CMakeLists.txt                 # 链接 audio-only 裁剪的 FFmpeg 静态库，产出 libffmpeg_bridge.so
├── ffmpeg_decoder.h / .cpp        # 解封装 + 解码 + 重采样核心（FFmpegDecoder）
├── ffmpeg_bridge.cpp              # JNI 桥接层，对接 FFmpegNative 的 native 方法
├── scripts/build_ffmpeg_android.sh# 下载并按 ABI 编译 audio-only FFmpeg 静态库
└── ffmpeg/                        # 【不入库】源码、下载包、静态库产物（见 .gitignore）
android/app/src/main/java/cn/toside/music/mobile/ffmpeg/
├── FFmpegNative.java              # JNI 声明 + so 加载状态
├── FFmpegAudioPlayer.java         # 播放器（AudioTrack 输出、play/pause/seek/进度回调）
├── FFmpegAudioPlayerModule.java   # RN NativeModule，名字 FFmpegAudioPlayer
└── FFmpegAudioPlayerPackage.java  # ReactPackage 注册
```

## 产物目录约定

```
ffmpeg/android-libs/<abi>/lib/libavformat.a
ffmpeg/android-libs/<abi>/lib/libavcodec.a
ffmpeg/android-libs/<abi>/lib/libswresample.a
ffmpeg/android-libs/<abi>/lib/libavutil.a
ffmpeg/android-libs/<abi>/include/...
```

## 编译 FFmpeg 静态库

```bash
# 单个 ABI（release 用）
bash android/app/src/main/cpp/scripts/build_ffmpeg_android.sh

# 全 ABI（beta-pack 用）
FFMPEG_ABIS=armeabi-v7a,arm64-v8a,x86,x86_64 \
  bash android/app/src/main/cpp/scripts/build_ffmpeg_android.sh
```

- 默认 `FFMPEG_VERSION=6.0.1`、`ANDROID_API=21`、`NDK_VERSION=26.1.10909125`，均可由同名环境变量覆盖。
- 裁剪策略：`--disable-everything` 后仅开启 `swresample` 与音频所需的 demuxer / decoder / parser / `file|pipe|data` 协议；
  关闭 video、编码器、muxer、filter、设备、网络、硬件加速、zlib/bzlib/lzma/iconv。
- FFmpeg 不支持 out-of-tree 构建，脚本会为每个 ABI 复制一份独立源码树（`ffmpeg/build/src-<abi>-api21`），中断可续跑。
- 已存在 `libavformat.a` 的 ABI 自动跳过，配合 CI 缓存可复用。

## 构建开关（android/app/build.gradle）

| 开关 | 默认 | 说明 |
| --- | --- | --- |
| `-PffmpegBuildFromSource=true` | true | 挂载 CMake，编译 JNI 并链接裁剪静态库；ABI 随 `reactNativeArchitectures` 收敛 |
| `-PffmpegUsePrebuiltSo=true` | false | 跳过 CMake，直接打包 `src/main/jniLibs/<abi>/libffmpeg_bridge.so`（等同 `-PffmpegBuildFromSource=false`） |

预编 so 接入步骤：把对应 ABI 的 `libffmpeg_bridge.so` 放到 `android/app/src/main/jniLibs/<abi>/`，
然后 `./gradlew assembleRelease -PffmpegUsePrebuiltSo=true`。注意 `libffmpeg_bridge.so` 的 `.gitignore` 已忽略，只做本地接入。

## 已支持的容器 / 解码器

- 无损与 DSD：ape、flac、alac、wavpack(wv)、tta、tak、dsf、dff（DSDIFF，走 iff demuxer）、w64、aiff/caf
- 有损：mp3、aac、vorbis、opus、mpc7/mpc8、ac3/eac3、dts、wma(v1/v2/pro/lossless/voice)
- 视频容器内音频：mp4/m4a、mkv/webm（只解音频流）

## 运行时说明

- 输出统一为 S16、双声道（源单声道则单声道）、采样率取源采样率；源采样率 > 96kHz（DSD64/128 等）时下采样到 88.2kHz 或 96kHz。
- libavformat 与 Media3 的 Extractor 互不影响：本模块只做"回退解码"，不改动 react-native-track-player 主链路。
- 模块通过 `FFmpegAudioPlayer.isAvailable()` 暴露 so 是否加载成功，JS 侧在使用前应先判断。
