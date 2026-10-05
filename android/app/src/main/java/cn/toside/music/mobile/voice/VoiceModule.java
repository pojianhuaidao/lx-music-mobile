package cn.toside.music.mobile.voice;

import android.content.Intent;
import android.os.Build;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * RN 原生模块：车机语音搜歌入口。
 * 方法：init / startListening / stopListening / setWakeWord / setSensitivity / setWakeWordFree / destroy
 * 事件：onWakeUp / onResult / onError / onState
 */
public class VoiceModule extends ReactContextBaseJavaModule {

  public static final String NAME = "VoiceModule";

  private static VoiceModule instance;
  private final ReactApplicationContext reactContext;

  public VoiceModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    instance = this;
  }

  @Override
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void init(boolean enabled, String wakeWord, double sensitivity, Promise promise) {
    if (!enabled) {
      stopService();
      promise.resolve(true);
      return;
    }
    Intent intent = new Intent(reactContext, VoiceRecognitionService.class)
        .setAction(VoiceRecognitionService.ACTION_START)
        .putExtra(VoiceRecognitionService.EXTRA_WAKE_WORD, wakeWord == null ? "" : wakeWord)
        .putExtra(VoiceRecognitionService.EXTRA_SENSITIVITY, (float) sensitivity);
    startService(intent);
    promise.resolve(true);
  }

  @ReactMethod
  public void startListening(Promise promise) {
    Intent intent = new Intent(reactContext, VoiceRecognitionService.class)
        .setAction(VoiceRecognitionService.ACTION_START);
    startService(intent);
    promise.resolve(true);
  }

  @ReactMethod
  public void stopListening(Promise promise) {
    Intent intent = new Intent(reactContext, VoiceRecognitionService.class)
        .setAction(VoiceRecognitionService.ACTION_STOP);
    reactContext.startService(intent);
    promise.resolve(true);
  }

  @ReactMethod
  public void setWakeWord(String wakeWord, Promise promise) {
    Intent intent = new Intent(reactContext, VoiceRecognitionService.class)
        .setAction(VoiceRecognitionService.ACTION_SET_WAKE_WORD)
        .putExtra(VoiceRecognitionService.EXTRA_WAKE_WORD, wakeWord == null ? "" : wakeWord);
    reactContext.startService(intent);
    promise.resolve(true);
  }

  @ReactMethod
  public void setSensitivity(double sensitivity, Promise promise) {
    Intent intent = new Intent(reactContext, VoiceRecognitionService.class)
        .setAction(VoiceRecognitionService.ACTION_SET_SENSITIVITY)
        .putExtra(VoiceRecognitionService.EXTRA_SENSITIVITY, (float) sensitivity);
    reactContext.startService(intent);
    promise.resolve(true);
  }

  @ReactMethod
  public void setWakeWordFree(boolean wakeWordFree, Promise promise) {
    Intent intent = new Intent(reactContext, VoiceRecognitionService.class)
        .setAction(VoiceRecognitionService.ACTION_SET_WAKE_WORD_FREE)
        .putExtra(VoiceRecognitionService.EXTRA_WAKE_WORD_FREE, wakeWordFree);
    reactContext.startService(intent);
    promise.resolve(true);
  }

  @ReactMethod
  public void destroy(Promise promise) {
    Intent intent = new Intent(reactContext, VoiceRecognitionService.class)
        .setAction(VoiceRecognitionService.ACTION_DESTROY);
    startService(intent);
    promise.resolve(true);
  }

  // NativeEventEmitter 需要模块实现事件计数接口（事件实际经 RCTDeviceEventEmitter 广播）
  @ReactMethod
  public void addListener(String eventName) {}

  @ReactMethod
  public void removeListeners(double count) {}

  private void startService(Intent intent) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      reactContext.startForegroundService(intent);
    } else {
      reactContext.startService(intent);
    }
  }

  private void stopService() {
    reactContext.stopService(new Intent(reactContext, VoiceRecognitionService.class));
  }

  public static VoiceModule getInstance() {
    return instance;
  }

  /** 供 VoiceRecognitionService 回调转发 RN 事件 */
  public static void emit(String event, WritableMap params) {
    if (instance == null || instance.reactContext == null) return;
    DeviceEventManagerModule.RCTDeviceEventEmitter emitter =
        instance.reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class);
    if (emitter != null) emitter.emit(event, params);
  }

  public static void emitString(String event, String key, String value) {
    if (instance == null) return;
    WritableMap map = Arguments.createMap();
    map.putString(key, value);
    emit(event, map);
  }

  public static void emitInt(String event, String key, int value) {
    if (instance == null) return;
    WritableMap map = Arguments.createMap();
    map.putInt(key, value);
    emit(event, map);
  }

  @Override
  public void invalidate() {
    if (instance == this) instance = null;
    super.invalidate();
  }
}
