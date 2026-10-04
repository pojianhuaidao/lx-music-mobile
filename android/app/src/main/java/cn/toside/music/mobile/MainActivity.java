package cn.toside.music.mobile;

import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;

import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.ReactContext;
import com.reactnativenavigation.NavigationActivity;
import com.reactnativenavigation.NavigationApplication;

public class MainActivity extends NavigationActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }

  /**
   * 点击桌面图标恢复场景（系统强制小窗/后台返回时可能不触发常规 resume 刷新）：
   * ACTION_MAIN 或无可识别业务 data 时，向 JS 层发送刷新事件，
   * 由 JS 层 updateProps 触发 RN 根视图重渲染，一次点击即可恢复主界面。
   */
  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    if (intent != null
      && (Intent.ACTION_MAIN.equals(intent.getAction()) || intent.getData() == null)) {
      refreshReactRootView();
    }
  }

  /**
   * 退出多窗口/媒体小窗时同样强制刷新 RN 根视图，避免界面停留在小窗尺寸/空白状态。
   */
  @Override
  public void onMultiWindowModeChanged(boolean isInMultiWindowMode, Configuration newConfig) {
    super.onMultiWindowModeChanged(isInMultiWindowMode, newConfig);
    if (!isInMultiWindowMode) {
      refreshReactRootView();
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
