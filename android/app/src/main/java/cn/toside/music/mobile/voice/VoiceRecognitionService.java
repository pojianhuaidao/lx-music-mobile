package cn.toside.music.mobile.voice;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

/**
 * 语音识别前台服务：常驻录音，START_STICKY 重试，通知栏常驻提示。
 * 由 VoiceModule 通过 ACTION_* 驱动，引擎回调转发给 VoiceModule 发送 RN 事件。
 */
public class VoiceRecognitionService extends Service {

  private static final String TAG = "VoiceService";

  public static final String ACTION_START = "cn.toside.music.mobile.voice.START";
  public static final String ACTION_STOP = "cn.toside.music.mobile.voice.STOP";
  public static final String ACTION_DESTROY = "cn.toside.music.mobile.voice.DESTROY";
  public static final String ACTION_SET_WAKE_WORD = "cn.toside.music.mobile.voice.SET_WAKE_WORD";
  public static final String ACTION_SET_SENSITIVITY = "cn.toside.music.mobile.voice.SET_SENSITIVITY";
  public static final String EXTRA_WAKE_WORD = "wakeWord";
  public static final String EXTRA_SENSITIVITY = "sensitivity";

  private static final String CHANNEL_ID = "voice_service";
  private static final int NOTIFICATION_ID = 10086;

  private SherpaEngine engine;
  private boolean engineReady = false;

  @Override
  public void onCreate() {
    super.onCreate();
    engine = new SherpaEngine(this);
    engine.setListener(new SherpaEngine.Listener() {
      @Override
      public void onWakeUp() {
        VoiceModule.emit("onWakeUp", com.facebook.react.bridge.Arguments.createMap());
      }

      @Override
      public void onResult(String text) {
        VoiceModule.emitString("onResult", "text", text == null ? "" : text);
      }

      @Override
      public void onError(String message) {
        VoiceModule.emitString("onError", "message", message == null ? "" : message);
      }

      @Override
      public void onState(int state) {
        VoiceModule.emitInt("onState", "state", state);
      }
    });
    createNotificationChannel();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    // START_STICKY 重启（intent 为 null）：恢复前台服务并重新初始化引擎
    if (intent == null || intent.getAction() == null) {
      startForeground(NOTIFICATION_ID, buildNotification());
      ensureEngineInit();
      return START_STICKY;
    }
    String action = intent.getAction();
    switch (action) {
      case ACTION_START:
        startForeground(NOTIFICATION_ID, buildNotification());
        ensureEngineInit();
        if (intent.hasExtra(EXTRA_WAKE_WORD)) {
          engine.setWakeWord(intent.getStringExtra(EXTRA_WAKE_WORD));
        }
        if (intent.hasExtra(EXTRA_SENSITIVITY)) {
          engine.setSensitivity(intent.getFloatExtra(EXTRA_SENSITIVITY, 0.7f));
        }
        engine.startListening();
        break;
      case ACTION_STOP:
        if (engineReady) engine.stopListening();
        break;
      case ACTION_SET_WAKE_WORD:
        if (intent.hasExtra(EXTRA_WAKE_WORD)) engine.setWakeWord(intent.getStringExtra(EXTRA_WAKE_WORD));
        break;
      case ACTION_SET_SENSITIVITY:
        if (intent.hasExtra(EXTRA_SENSITIVITY)) engine.setSensitivity(intent.getFloatExtra(EXTRA_SENSITIVITY, 0.7f));
        break;
      case ACTION_DESTROY:
        stopForeground(true);
        stopSelf();
        break;
      default:
        break;
    }
    return START_STICKY;
  }

  private void ensureEngineInit() {
    if (engineReady) return;
    new Thread(() -> {
      boolean ok = engine.init();
      if (ok) {
        engineReady = true;
        Log.i(TAG, "engine initialized");
        engine.startListening();
      } else {
        Log.e(TAG, "engine init failed");
        engine.stopListening();
        VoiceModule.emitString("onError", "message", "engine init failed");
      }
    }, "voice-engine-init").start();
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
          CHANNEL_ID, "语音识别服务", NotificationManager.IMPORTANCE_LOW);
      channel.setDescription("车机语音搜歌监听服务");
      NotificationManager manager = getSystemService(NotificationManager.class);
      if (manager != null) manager.createNotificationChannel(channel);
    }
  }

  private Notification buildNotification() {
    Notification.Builder builder;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      builder = new Notification.Builder(this, CHANNEL_ID);
    } else {
      builder = new Notification.Builder(this);
    }
    return builder
        .setContentTitle("语音搜歌已开启")
        .setContentText("说\"你好小马\"开始搜歌")
        .setSmallIcon(android.R.drawable.ic_btn_speak_now)
        .setOngoing(true)
        .build();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public void onDestroy() {
    Log.i(TAG, "service destroyed");
    if (engine != null) engine.destroy();
    super.onDestroy();
  }
}
