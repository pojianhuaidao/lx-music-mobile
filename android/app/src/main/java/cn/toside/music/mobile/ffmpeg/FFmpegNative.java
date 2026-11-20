package cn.toside.music.mobile.ffmpeg;

import android.util.Log;

/**
 * JNI 声明层。真正的实现位于 src/main/cpp/ffmpeg_bridge.cpp。
 *
 * 所有方法均由 FFmpegAudioPlayer 的播放线程调用；若 libffmpeg_bridge.so 未能加载
 * （例如开启 ffmpegUsePrebuiltSo 却没放入对应 ABI 的 so，或构建时关闭了本模块），
 * {@link #isAvailable()} 返回 false，调用方必须先判断再使用，避免 UnsatisfiedLinkError。
 */
final class FFmpegNative {

  private static final String TAG = "FFmpegNative";
  private static final String LIB_NAME = "ffmpeg_bridge";

  private static volatile boolean loaded = false;
  private static volatile String loadError = null;
  private static volatile String versionInfo = null;

  static {
    try {
      System.loadLibrary(LIB_NAME);
      loaded = true;
    } catch (Throwable t) {
      loadError = t.getMessage();
      Log.w(TAG, "无法加载 lib" + LIB_NAME + ".so，FFmpeg 音频桥接不可用: " + t);
    }
  }

  private FFmpegNative() {
  }

  static boolean isAvailable() {
    return loaded;
  }

  static String getLoadError() {
    return loadError;
  }

  /** 返回形如 avformat=60.16.100,avcodec=... 的版本串，加载失败时返回 null。 */
  static String getVersionInfo() {
    if (!loaded) return null;
    if (versionInfo == null) {
      try {
        versionInfo = nativeVersionInfo();
      } catch (Throwable t) {
        Log.w(TAG, "读取 FFmpeg 版本失败: " + t);
        return null;
      }
    }
    return versionInfo;
  }

  /**
   * 只读探测音频文件信息。
   *
   * @return 长度为 5 的数组 [durationMs, sampleRate, channels, bitRate, codecName]，失败返回 null。
   */
  static String[] probe(String path) {
    if (!loaded) return null;
    return nativeProbe(path);
  }

  /** 打开文件并返回句柄；失败返回 0。 */
  static long open(String path, int sampleRate, int channels) {
    if (!loaded) return 0;
    return nativeOpen(path, sampleRate, channels);
  }

  /** 读取 PCM：> 0 字节数，0 表示播放结束，-1 表示出错。 */
  static int read(long handle, byte[] buffer, int offset, int length) {
    if (!loaded || handle == 0) return -1;
    return nativeRead(handle, buffer, offset, length);
  }

  static boolean seek(long handle, long positionMs) {
    if (!loaded || handle == 0) return false;
    return nativeSeek(handle, positionMs);
  }

  static long getPosition(long handle) {
    if (!loaded || handle == 0) return 0;
    return nativePosition(handle);
  }

  static String getLastError(long handle) {
    if (!loaded) return loadError;
    return nativeLastError(handle);
  }

  static void close(long handle) {
    if (!loaded || handle == 0) return;
    nativeClose(handle);
  }

  private static native String nativeVersionInfo();

  private static native String[] nativeProbe(String path);

  private static native long nativeOpen(String path, int sampleRate, int channels);

  private static native int nativeRead(long handle, byte[] buffer, int offset, int length);

  private static native boolean nativeSeek(long handle, long positionMs);

  private static native long nativePosition(long handle);

  private static native String nativeLastError(long handle);

  private static native void nativeClose(long handle);
}
