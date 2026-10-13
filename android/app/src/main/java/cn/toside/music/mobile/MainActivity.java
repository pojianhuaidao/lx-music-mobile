package cn.toside.music.mobile;

import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.ReactContext;
import com.reactnativenavigation.NavigationActivity;
import com.reactnativenavigation.NavigationApplication;

public class MainActivity extends NavigationActivity {

  private final Handler mainHandler = new Handler(Looper.getMainLooper());

  /**
   * 统一延迟补刷：同一次前台恢复中 onNewIntent / onMultiWindowModeChanged 可能接连触发，
   * 先 removeCallbacks 合并为一次，配合 JS 层 refreshOnForeground 防抖，避免两次刷新导致
   * 画中画点击图标偶发闪烁；延迟同时保证 deeplink 路由处理完成后再刷新。
   */
  private final Runnable delayedRefreshRunnable = new Runnable() {
    @Override
    public void run() {
      refreshReactRootView();
    }
  };

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }

  /**
   * 点击桌面图标/媒体卡片恢复场景（系统强制小窗/后台返回时可能不触发常规 resume 刷新）：
   * intent 非空即向 JS 层发送刷新事件，由 JS 层 updateProps 触发 RN 根视图重渲染；
   * 统一延迟 500ms 补刷（同批事件先 removeCallbacks 合并），避免立即刷新 + 延迟补刷
   * 双重重绘造成的画中画点击图标偶发闪烁。
   */
  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    if (intent == null) return;
    mainHandler.removeCallbacks(delayedRefreshRunnable);
    mainHandler.postDelayed(delayedRefreshRunnable, 500);
  }

  /**
   * 退出多窗口/媒体小窗时同样强制刷新 RN 根视图，避免界面停留在小窗尺寸/空白状态；
   * 与 onNewIntent 共用延迟补刷通道，防止连续触发时重复刷新。
   */
  @Override
  public void onMultiWindowModeChanged(boolean isInMultiWindowMode, Configuration newConfig) {
    super.onMultiWindowModeChanged(isInMultiWindowMode, newConfig);
    if (!isInMultiWindowMode) {
      mainHandler.removeCallbacks(delayedRefreshRunnable);
      mainHandler.postDelayed(delayedRefreshRunnable, 500);
    }
  }

  /**
   * 通过 ReactContext.emitDeviceEvent 向 JS 层发送 "lxMusicRefresh" 事件，
   * JS 层在 src/navigation/refreshOnForeground.ts 中监听并刷新当前界面。
   */
  private void refreshReactRootView() {
    try {
      ReactInstanceManager reactInstanceManager = ((NavigationApplication) getApplication())
          .getReactNativeHost()
          .getReactInstanceManager();
      ReactContext reactContext = reactInstanceManager.getCurrentReactContext();
      if (reactContext != null) {
        reactContext.emitDeviceEvent("lxMusicRefresh");
      }
    } catch (Exception ignored) {
      // 刷新失败不影响 Activity 生命周期，下次前台/NewIntent 会再次尝试
    }
  }
}
