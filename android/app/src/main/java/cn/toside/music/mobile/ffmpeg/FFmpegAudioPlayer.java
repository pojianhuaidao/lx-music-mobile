package cn.toside.music.mobile.ffmpeg;

import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Log;

/**
 * 基于 FFmpeg 软解 + AudioTrack 输出的音频播放器。
 *
 * 用途：播放 Media3/ExoPlayer 缺少 Extractor 的本地格式（ape / wma / dsf / dff / tak / tta 等）。
 * 线程模型：
 *   - controlHandler 线程负责 load / release 等状态切换类操作；
 *   - playbackThread 负责 native 解码 → AudioTrack.write 的拉流循环。
 * 回调（Listener）在内部线程触发，调用方（FFmpegAudioPlayerModule）负责 post 到主线程。
 */
public class FFmpegAudioPlayer {

  private static final String TAG = "FFmpegAudioPlayer";

  public static final int STATE_IDLE = 0;
  public static final int STATE_PREPARING = 1;
  public static final int STATE_READY = 2;
  public static final int STATE_PLAYING = 3;
  public static final int STATE_PAUSED = 4;
  public static final int STATE_COMPLETED = 5;
  public static final int STATE_ERROR = 6;

  private static final int READ_BUFFER_FRAMES = 4096;

  /** 播放器回调，全部在内部线程触发。 */
  public interface Listener {
    void onPrepared(MediaInfo info);

    void onStateChanged(int state);

    void onProgress(long positionMs, long durationMs);

    void onCompleted();

    void onError(String message);
  }

  /** 探测得到的媒体信息。 */
  public static class MediaInfo {
    public final long durationMs;
    public final int sourceSampleRate;
    public final int sourceChannels;
    public final long bitRate;
    public final String codec;

    MediaInfo(long durationMs, int sourceSampleRate, int sourceChannels, long bitRate, String codec) {
      this.durationMs = durationMs;
      this.sourceSampleRate = sourceSampleRate;
      this.sourceChannels = sourceChannels;
      this.bitRate = bitRate;
      this.codec = codec;
    }
  }

  private final HandlerThread controlThread;
  private final Handler controlHandler;

  private volatile int state = STATE_IDLE;
  private volatile boolean released = false;
  private volatile long pendingSeekMs = -1;
  private volatile long positionMs = 0;
  private volatile long durationMs = 0;

  private volatile Listener listener;
  private volatile Thread playbackThread;
  private volatile long nativeHandle = 0;

  private volatile AudioTrack audioTrack;
  private volatile int outputSampleRate = 44100;
  private volatile int outputChannels = 2;
  private volatile float volume = 1f;
  private volatile MediaInfo mediaInfo;
  private volatile String currentPath;

  public FFmpegAudioPlayer() {
    controlThread = new HandlerThread("ffmpeg-audio-control");
    controlThread.start();
    controlHandler = new Handler(controlThread.getLooper());
  }

  public void setListener(Listener listener) {
    this.listener = listener;
  }

  public int getState() {
    return state;
  }

  public long getPosition() {
    return positionMs;
  }

  public long getDuration() {
    return durationMs;
  }

  public String getCurrentPath() {
    return currentPath;
  }

  public MediaInfo getMediaInfo() {
    return mediaInfo;
  }

  // -------------------------------------------------------------------------
  // 对外控制接口（异步，实际动作在 controlHandler 上串行执行）
  // -------------------------------------------------------------------------

  /** 加载并准备播放指定文件；准备完成后回调 onPrepared，可直接 play。 */
  public void load(final String path) {
    if (released) return;
    controlHandler.post(() -> doLoad(path));
  }

  public void play() {
    if (released) return;
    final int current = state;
    if (current != STATE_READY && current != STATE_PAUSED && current != STATE_PLAYING) return;
    if (current == STATE_PLAYING) return;
    state = STATE_PLAYING;
    AudioTrack track = audioTrack;
    if (track != null) {
      try {
        track.play();
      } catch (Throwable t) {
        Log.w(TAG, "AudioTrack.play 失败: " + t);
      }
    }
    notifyState();
  }

  public void pause() {
    if (released) return;
    if (state != STATE_PLAYING) return;
    state = STATE_PAUSED;
    AudioTrack track = audioTrack;
    if (track != null) {
      try {
        track.pause();
      } catch (Throwable t) {
        Log.w(TAG, "AudioTrack.pause 失败: " + t);
      }
    }
    notifyState();
  }

  public void seekTo(long positionMs) {
    if (released) return;
    final int current = state;
    if (current != STATE_PLAYING && current != STATE_PAUSED && current != STATE_READY && current != STATE_COMPLETED) {
      return;
    }
    long target = Math.max(0, positionMs);
    if (durationMs > 0 && target > durationMs) target = durationMs;
    pendingSeekMs = target;
    // 播放结束状态下 seek，需要重新进入可播放状态并确保播放线程存活。
    if (current == STATE_COMPLETED) {
      state = STATE_PAUSED;
      notifyState();
      Thread thread = playbackThread;
      if (thread == null || !thread.isAlive()) startPlaybackThread();
    }
  }

  public void setVolume(float value) {
    float v = value < 0f ? 0f : (value > 1f ? 1f : value);
    volume = v;
    AudioTrack track = audioTrack;
    if (track != null) {
      try {
        track.setVolume(v);
      } catch (Throwable t) {
        Log.w(TAG, "AudioTrack.setVolume 失败: " + t);
      }
    }
  }

  /** 停止播放并释放底层资源（可重复调用）。 */
  public void release() {
    if (released) return;
    released = true;
    pendingSeekMs = -1;
    controlHandler.post(this::doRelease);
  }

  // -------------------------------------------------------------------------
  // 内部实现
  // -------------------------------------------------------------------------

  private void doLoad(String path) {
    if (released) return;
    if (path == null || path.isEmpty()) {
      fail("文件路径为空");
      return;
    }
    if (!FFmpegNative.isAvailable()) {
      fail("libffmpeg_bridge.so 未加载: " + FFmpegNative.getLoadError());
      return;
    }

    // 释放上一首的资源
    stopPlaybackThread();
    releaseNative();
    releaseTrack();

    currentPath = path;
    state = STATE_PREPARING;
    positionMs = 0;
    durationMs = 0;
    notifyState();

    MediaInfo info = probe(path);
    if (info == null) {
      String error = FFmpegNative.getLastError(0);
      fail("无法解析音频文件: " + (error == null ? "未知错误" : error));
      return;
    }
    mediaInfo = info;
    durationMs = info.durationMs;

    outputSampleRate = chooseOutputSampleRate(info.sourceSampleRate);
    outputChannels = info.sourceChannels >= 2 ? 2 : 1;

    long handle = FFmpegNative.open(path, outputSampleRate, outputChannels);
    if (handle == 0) {
      String error = FFmpegNative.getLastError(0);
      fail("打开音频流失败: " + (error == null ? "未知错误" : error));
      return;
    }
    nativeHandle = handle;

    audioTrack = createTrack(outputSampleRate, outputChannels);
    if (audioTrack == null) {
      // 某些设备不支持非常规采样率，回退到 44.1kHz 重新打开。
      if (outputSampleRate != 44100) {
        Log.w(TAG, "采样率 " + outputSampleRate + " 不受支持，回退到 44100");
        outputSampleRate = 44100;
        FFmpegNative.close(nativeHandle);
        nativeHandle = FFmpegNative.open(path, outputSampleRate, outputChannels);
        if (nativeHandle != 0) audioTrack = createTrack(outputSampleRate, outputChannels);
      }
      if (audioTrack == null) {
        fail("AudioTrack 初始化失败");
        return;
      }
    }

    state = STATE_READY;
    notifyState();
    Listener observer = listener;
    if (observer != null) {
      try {
        observer.onPrepared(info);
      } catch (Throwable t) {
        Log.w(TAG, "onPrepared 回调异常: " + t);
      }
    }

    startPlaybackThread();
  }

  private MediaInfo probe(String path) {
    String[] raw = FFmpegNative.probe(path);
    if (raw == null || raw.length < 5) return null;
    long duration = parseLong(raw[0]);
    int sampleRate = (int) parseLong(raw[1]);
    int channels = (int) parseLong(raw[2]);
    long bitRate = parseLong(raw[3]);
    String codec = raw[4] == null ? "" : raw[4];
    if (sampleRate <= 0) sampleRate = 44100;
    if (channels <= 0) channels = 2;
    return new MediaInfo(duration, sampleRate, channels, bitRate, codec);
  }

  private static long parseLong(String value) {
    if (value == null || value.isEmpty()) return 0;
    try {
      return Long.parseLong(value.trim());
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  /**
   * 选择输出采样率：普通格式保持源采样率（保证音质、避免无谓重采样）；
   * 超高采样率（DSD 64/128、352.8kHz 等）下采样到 88.2kHz 或 96kHz，
   * 兼顾 DSD 解码性能与设备兼容性。
   */
  private static int chooseOutputSampleRate(int sourceSampleRate) {
    if (sourceSampleRate <= 0) return 44100;
    if (sourceSampleRate <= 96000) return sourceSampleRate;
    if (sourceSampleRate % 44100 == 0) return 88200;
    return 96000;
  }

  private AudioTrack createTrack(int sampleRate, int channels) {
    int channelMask = channels >= 2 ? AudioFormat.CHANNEL_OUT_STEREO : AudioFormat.CHANNEL_OUT_MONO;
    int minBufferSize;
    try {
      minBufferSize = AudioTrack.getMinBufferSize(sampleRate, channelMask, AudioFormat.ENCODING_PCM_16BIT);
    } catch (Throwable t) {
      minBufferSize = AudioTrack.ERROR;
    }
    if (minBufferSize <= 0) {
      // 200ms 兜底
      minBufferSize = sampleRate * channels * 2 / 5;
    }
    int bufferSizeInBytes = Math.max(minBufferSize * 2, 8192);

    AudioTrack track = null;
    try {
      track = new AudioTrack(AudioManager.STREAM_MUSIC, sampleRate, channelMask,
          AudioFormat.ENCODING_PCM_16BIT, bufferSizeInBytes, AudioTrack.MODE_STREAM);
    } catch (Throwable t) {
      Log.w(TAG, "创建 AudioTrack 失败: " + t);
      return null;
    }
    if (track.getState() != AudioTrack.STATE_INITIALIZED) {
      Log.w(TAG, "AudioTrack 未初始化, sampleRate=" + sampleRate + ", channels=" + channels);
      try {
        track.release();
      } catch (Throwable ignored) {
        // ignore
      }
      return null;
    }
    try {
      track.setVolume(volume);
    } catch (Throwable ignored) {
      // 部分设备不支持 setVolume，忽略
    }
    return track;
  }

  private void startPlaybackThread() {
    Thread thread = new Thread(this::playbackLoop, "ffmpeg-audio-playback");
    thread.setPriority(Thread.MAX_PRIORITY - 1);
    playbackThread = thread;
    thread.start();
  }

  private void stopPlaybackThread() {
    Thread thread = playbackThread;
    playbackThread = null;
    if (thread != null && thread != Thread.currentThread()) {
      try {
        thread.join(1000);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
  }

  private void playbackLoop() {
    final int bytesPerFrame = 2 * outputChannels;
    final int readBytes = Math.max(READ_BUFFER_FRAMES * bytesPerFrame, 8192);
    final byte[] buffer = new byte[readBytes];

    while (!released) {
      // 1) 处理跳转请求
      long seekTarget = pendingSeekMs;
      if (seekTarget >= 0) {
        pendingSeekMs = -1;
        applySeek(seekTarget);
      }

      final int current = state;
      if (current != STATE_PLAYING) {
        if (current == STATE_PAUSED || current == STATE_READY) {
          sleepQuietly(20);
          continue;
        }
        break;
      }

      // 2) 拉取一帧数据
      int read;
      try {
        read = FFmpegNative.read(nativeHandle, buffer, 0, buffer.length);
      } catch (Throwable t) {
        fail("解码异常: " + t);
        return;
      }
      if (read == -1) {
        String error = FFmpegNative.getLastError(nativeHandle);
        fail("解码失败: " + (error == null ? "未知错误" : error));
        return;
      }
      if (read == 0) {
        positionMs = durationMs > 0 ? durationMs : positionMs;
        state = STATE_COMPLETED;
        notifyState();
        Listener observer = listener;
        if (observer != null) {
          try {
            observer.onCompleted();
          } catch (Throwable t) {
            Log.w(TAG, "onCompleted 回调异常: " + t);
          }
        }
        break;
      }

      // 3) 写入 AudioTrack（处理部分写入）
      AudioTrack track = audioTrack;
      if (track == null) {
        sleepQuietly(20);
        continue;
      }
      int offset = 0;
      while (offset < read && !released && state == STATE_PLAYING) {
        int written;
        try {
          written = track.write(buffer, offset, read - offset);
        } catch (Throwable t) {
          fail("写入 AudioTrack 失败: " + t);
          return;
        }
        if (written < 0) {
          fail("AudioTrack.write 返回错误码 " + written);
          return;
        }
        if (written == 0) {
          sleepQuietly(5);
          continue;
        }
        offset += written;
      }

      // 4) 更新播放位置并上报进度
      long position = FFmpegNative.getPosition(nativeHandle);
      positionMs = position;
      Listener observer = listener;
      if (observer != null) {
        try {
          observer.onProgress(position, durationMs);
        } catch (Throwable t) {
          Log.w(TAG, "onProgress 回调异常: " + t);
        }
      }
    }
  }

  private void applySeek(long targetMs) {
    AudioTrack track = audioTrack;
    final boolean wasPlaying = state == STATE_PLAYING;
    if (track != null) {
      try {
        track.pause();
        track.flush();
      } catch (Throwable t) {
        Log.w(TAG, "seek 前 flush 失败: " + t);
      }
    }
    boolean ok;
    try {
      ok = FFmpegNative.seek(nativeHandle, targetMs);
    } catch (Throwable t) {
      Log.w(TAG, "seek 异常: " + t);
      ok = false;
    }
    if (!ok) {
      String error = FFmpegNative.getLastError(nativeHandle);
      Log.w(TAG, "seek 失败: " + (error == null ? "未知错误" : error));
    } else {
      positionMs = targetMs;
    }
    if (track != null && wasPlaying) {
      try {
        track.play();
      } catch (Throwable t) {
        Log.w(TAG, "seek 后恢复播放失败: " + t);
      }
    }
  }

  private void fail(String message) {
    Log.e(TAG, message);
    state = STATE_ERROR;
    notifyState();
    Listener observer = listener;
    if (observer != null) {
      try {
        observer.onError(message);
      } catch (Throwable t) {
        Log.w(TAG, "onError 回调异常: " + t);
      }
    }
  }

  private void notifyState() {
    Listener observer = listener;
    if (observer == null) return;
    try {
      observer.onStateChanged(state);
    } catch (Throwable t) {
      Log.w(TAG, "onStateChanged 回调异常: " + t);
    }
  }

  private void doRelease() {
    stopPlaybackThread();
    releaseNative();
    releaseTrack();
    state = STATE_IDLE;
    positionMs = 0;
    if (!released) notifyState();
    if (controlThread != null && controlThread.isAlive()) {
      controlThread.quitSafely();
    }
  }

  private void releaseNative() {
    long handle = nativeHandle;
    nativeHandle = 0;
    if (handle != 0) {
      try {
        FFmpegNative.close(handle);
      } catch (Throwable t) {
        Log.w(TAG, "释放解码器失败: " + t);
      }
    }
  }

  private void releaseTrack() {
    AudioTrack track = audioTrack;
    audioTrack = null;
    if (track != null) {
      try {
        if (track.getState() == AudioTrack.STATE_INITIALIZED) {
          track.pause();
          track.flush();
          track.stop();
        }
      } catch (Throwable ignored) {
        // ignore
      }
      try {
        track.release();
      } catch (Throwable ignored) {
        // ignore
      }
    }
  }

  private static void sleepQuietly(long millis) {
    try {
      Thread.sleep(millis);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
