package cn.toside.music.mobile.ffmpeg;

import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * RN 侧入口：FFmpegAudioPlayer。
 *
 * JS 用法：
 *   const player = new NativeEventEmitter(NativeModules.FFmpegAudioPlayer)
 *   or NativeModules.FFmpegAudioPlayer.load(path) ...
 *
 * 事件（事件名 → payload）：
 *   FFmpegAudioPlayerState     { state: number, stateName: string }
 *   FFmpegAudioPlayerProgress  { position: number, duration: number }
 *   FFmpegAudioPlayerCompleted { }
 *   FFmpegAudioPlayerError     { message: string }
 */
public class FFmpegAudioPlayerModule extends ReactContextBaseJavaModule
    implements FFmpegAudioPlayer.Listener {

  public static final String NAME = "FFmpegAudioPlayer";

  private static final String TAG = "FFmpegAudioPlayerMod";

  private static final String EVENT_STATE = "FFmpegAudioPlayerState";
  private static final String EVENT_PROGRESS = "FFmpegAudioPlayerProgress";
  private static final String EVENT_COMPLETED = "FFmpegAudioPlayerCompleted";
  private static final String EVENT_ERROR = "FFmpegAudioPlayerError";

  private final ReactApplicationContext reactContext;
  private final Object lock = new Object();

  private FFmpegAudioPlayer player;
  private Promise pendingLoad;
  private boolean destroyed = false;
  private int listenerCount = 0;

  public FFmpegAudioPlayerModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return NAME;
  }

  // -------------------------------------------------------------------------
  // 生命周期
  // -------------------------------------------------------------------------

  @Override
  public void invalidate() {
    destroyPlayer();
    super.invalidate();
  }

  private FFmpegAudioPlayer getPlayer() {
    synchronized (lock) {
      if (player == null) {
        player = new FFmpegAudioPlayer();
        player.setListener(this);
      }
      return player;
    }
  }

  private void destroyPlayer() {
    FFmpegAudioPlayer current;
    synchronized (lock) {
      destroyed = true;
      current = player;
      player = null;
      rejectPendingLoad("播放器已释放");
    }
    if (current != null) {
      current.setListener(null);
      current.release();
    }
  }

  private void rejectPendingLoad(String message) {
    Promise promise;
    synchronized (lock) {
      promise = pendingLoad;
      pendingLoad = null;
    }
    if (promise != null) {
      try {
        promise.reject("E_FFMPEG_DESTROYED", message);
      } catch (Throwable ignored) {
        // promise 可能已被 resolve
      }
    }
  }

  // -------------------------------------------------------------------------
  // JS 事件监听
  // -------------------------------------------------------------------------

  @ReactMethod
  public void addListener(String eventName) {
    listenerCount++;
  }

  @ReactMethod
  public void removeListeners(int count) {
    listenerCount = Math.max(0, listenerCount - count);
  }

  // -------------------------------------------------------------------------
  // 能力查询
  // -------------------------------------------------------------------------

  @ReactMethod
  public void isAvailable(Promise promise) {
    WritableMap map = Arguments.createMap();
    map.putBoolean("available", FFmpegNative.isAvailable());
    map.putString("version", FFmpegNative.getVersionInfo());
    map.putString("error", FFmpegNative.getLoadError());
    promise.resolve(map);
  }

  // -------------------------------------------------------------------------
  // 播放控制
  // -------------------------------------------------------------------------

  /**
   * 加载文件，prepare 成功时 resolve：
   * { duration, sampleRate, channels, bitRate, codec, state }
   */
  @ReactMethod
  public void load(String path, Promise promise) {
    if (destroyed) {
      promise.reject("E_FFMPEG_DESTROYED", "播放器已销毁");
      return;
    }
    if (!FFmpegNative.isAvailable()) {
      promise.reject("E_FFMPEG_UNAVAILABLE", "libffmpeg_bridge.so 未加载："
          + (FFmpegNative.getLoadError() == null ? "未知原因" : FFmpegNative.getLoadError()));
      return;
    }
    synchronized (lock) {
      if (pendingLoad != null) {
        try {
          pendingLoad.reject("E_FFMPEG_BUSY", "已有加载中的文件");
        } catch (Throwable ignored) {
          // ignore
        }
      }
      pendingLoad = promise;
    }
    getPlayer().load(path);
  }

  @ReactMethod
  public void play() {
    FFmpegAudioPlayer current;
    synchronized (lock) {
      current = player;
    }
    if (current != null) current.play();
  }

  @ReactMethod
  public void pause() {
    FFmpegAudioPlayer current;
    synchronized (lock) {
      current = player;
    }
    if (current != null) current.pause();
  }

  @ReactMethod
  public void seekTo(double positionMs) {
    FFmpegAudioPlayer current;
    synchronized (lock) {
      current = player;
    }
    if (current != null) current.seekTo((long) positionMs);
  }

  @ReactMethod
  public void setVolume(double value) {
    FFmpegAudioPlayer current;
    synchronized (lock) {
      current = player;
    }
    if (current != null) current.setVolume((float) value);
  }

  /** 停止播放并把位置归零，不释放解码器，可继续 play()。 */
  @ReactMethod
  public void stop() {
    FFmpegAudioPlayer current;
    synchronized (lock) {
      current = player;
    }
    if (current == null) return;
    current.pause();
    current.seekTo(0);
  }

  /** 释放解码器与 AudioTrack；再次使用需重新 load。 */
  @ReactMethod
  public void destroy() {
    destroyPlayer();
  }

  /** 查询当前状态：{ state, stateName, position, duration, path, codec, sampleRate, channels } */
  @ReactMethod
  public void getStatus(Promise promise) {
    FFmpegAudioPlayer current;
    synchronized (lock) {
      current = player;
    }
    WritableMap map = Arguments.createMap();
    if (current == null) {
      map.putInt("state", FFmpegAudioPlayer.STATE_IDLE);
      map.putString("stateName", stateName(FFmpegAudioPlayer.STATE_IDLE));
      map.putDouble("position", 0);
      map.putDouble("duration", 0);
      map.putBoolean("available", FFmpegNative.isAvailable());
      promise.resolve(map);
      return;
    }
    FFmpegAudioPlayer.MediaInfo info = current.getMediaInfo();
    map.putInt("state", current.getState());
    map.putString("stateName", stateName(current.getState()));
    map.putDouble("position", current.getPosition());
    map.putDouble("duration", current.getDuration());
    map.putString("path", current.getCurrentPath());
    map.putBoolean("available", FFmpegNative.isAvailable());
    if (info != null) {
      map.putString("codec", info.codec);
      map.putInt("sampleRate", info.sourceSampleRate);
      map.putInt("channels", info.sourceChannels);
      map.putDouble("bitRate", info.bitRate);
    }
    promise.resolve(map);
  }

  // -------------------------------------------------------------------------
  // FFmpegAudioPlayer.Listener（内部线程回调 → 转发到 JS）
  // -------------------------------------------------------------------------

  @Override
  public void onPrepared(FFmpegAudioPlayer.MediaInfo info) {
    WritableMap payload = Arguments.createMap();
    payload.putDouble("duration", info.durationMs);
    payload.putInt("sampleRate", info.sourceSampleRate);
    payload.putInt("channels", info.sourceChannels);
    payload.putDouble("bitRate", info.bitRate);
    payload.putString("codec", info.codec);
    payload.putInt("state", FFmpegAudioPlayer.STATE_READY);
    payload.putString("stateName", stateName(FFmpegAudioPlayer.STATE_READY));

    Promise promise;
    synchronized (lock) {
      promise = pendingLoad;
      pendingLoad = null;
    }
    if (promise != null) {
      try {
        promise.resolve(payload);
      } catch (Throwable t) {
        Log.w(TAG, "resolve load promise 失败: " + t);
      }
    }
    emit(EVENT_STATE, payload);
  }

  @Override
  public void onStateChanged(int state) {
    WritableMap payload = Arguments.createMap();
    payload.putInt("state", state);
    payload.putString("stateName", stateName(state));
    emit(EVENT_STATE, payload);
  }

  @Override
  public void onProgress(long positionMs, long durationMs) {
    if (listenerCount <= 0 && pendingLoad == null) {
      // 没有 JS 监听者时不做无谓的跨线程投递
      return;
    }
    FFmpegAudioPlayer current;
    synchronized (lock) {
      current = player;
    }
    WritableMap payload = Arguments.createMap();
    payload.putDouble("position", positionMs);
    payload.putDouble("duration", durationMs > 0 ? durationMs : (current == null ? 0 : current.getDuration()));
    payload.putInt("state", current == null ? FFmpegAudioPlayer.STATE_PLAYING : current.getState());
    emit(EVENT_PROGRESS, payload);
  }

  @Override
  public void onCompleted() {
    WritableMap payload = Arguments.createMap();
    payload.putInt("state", FFmpegAudioPlayer.STATE_COMPLETED);
    payload.putString("stateName", stateName(FFmpegAudioPlayer.STATE_COMPLETED));
    emit(EVENT_COMPLETED, payload);
    emit(EVENT_STATE, payload);
  }

  @Override
  public void onError(String message) {
    Promise promise;
    synchronized (lock) {
      promise = pendingLoad;
      pendingLoad = null;
    }
    if (promise != null) {
      try {
        promise.reject("E_FFMPEG_PLAYBACK", message);
      } catch (Throwable ignored) {
        // ignore
      }
    }
    WritableMap payload = Arguments.createMap();
    payload.putString("message", message);
    payload.putInt("state", FFmpegAudioPlayer.STATE_ERROR);
    payload.putString("stateName", stateName(FFmpegAudioPlayer.STATE_ERROR));
    emit(EVENT_ERROR, payload);
    emit(EVENT_STATE, payload);
  }

  // -------------------------------------------------------------------------
  // 工具方法
  // -------------------------------------------------------------------------

  private void emit(String event, WritableMap payload) {
    if (!reactContext.hasActiveReactInstance()) return;
    try {
      reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
          .emit(event, payload);
    } catch (Throwable t) {
      Log.w(TAG, "发送事件失败(" + event + "): " + t);
    }
  }

  private static String stateName(int state) {
    switch (state) {
      case FFmpegAudioPlayer.STATE_IDLE:
        return "idle";
      case FFmpegAudioPlayer.STATE_PREPARING:
        return "preparing";
      case FFmpegAudioPlayer.STATE_READY:
        return "ready";
      case FFmpegAudioPlayer.STATE_PLAYING:
        return "playing";
      case FFmpegAudioPlayer.STATE_PAUSED:
        return "paused";
      case FFmpegAudioPlayer.STATE_COMPLETED:
        return "completed";
      case FFmpegAudioPlayer.STATE_ERROR:
        return "error";
      default:
        return "unknown";
    }
  }
}
