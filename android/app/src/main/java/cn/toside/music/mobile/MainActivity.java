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

  // 首次 onResume 属于正常启动，不参与补刷（避免首帧多做一次图层重建）
  private boolean isFirstResume = true;

  /**
   * 统一延迟补刷：同一次前台恢复中 onNewIntent / onMultiWindowModeChanged 可能接连触发，
   * 先 removeCallbacks 合并为一次批次，配合 JS 层 refreshOnForeground 防抖，避免两次刷新导致
   * 画中画点击图标偶发闪烁；延迟同时保证 deeplink 路由处理完成后再刷新。
   *
   * 系统小窗（尤其是车机虚拟 PiP）的窗口 Surface 尺寸是分阶段收敛的：系统先给一个过渡尺寸，
   * 过渡动画结束后才稳定。原来只在 500ms 补刷一次，很容易落在过渡帧上，
   * 之后再没有任何重绘，小窗里就会一直停留在旧画面（画面不跟随当前状态）。
   * 因此在多个时间点各补刷一次：首段用于快速换帧，末段保证过渡结束后按最终尺寸重新布局。
   */
  private static final long[] REFRESH_DELAYS = { 160L, 480L, 900L, 1600L };

  private final Runnable delayedRefreshRunnable = new Runnable() {
    @Override
    public void run() {
      refreshReactRootView();
    }
  };

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // 车机小窗/多窗口毛玻璃：RN 就绪后把窗口背景置为透明，露出车机桌面壁纸；
    // 启动阶段窗口背景仍为品牌色（styles.xml #039893），避免闪白。
    try {
      ReactInstanceManager reactInstanceManager = ((NavigationApplication) getApplication())
          .getReactNativeHost()
          .getReactInstanceManager();
      reactInstanceManager.addReactInstanceEventListener(new ReactInstanceManager.ReactInstanceEventListener() {
        @Override
        public void onReactContextInitialized(ReactContext context) {
          applyTranslucentWindow();
        }
      });
      if (reactInstanceManager.getCurrentReactContext() != null) {
        applyTranslucentWindow();
      }
    } catch (Exception ignored) {
      // 透明化失败不影响启动，窗口保持品牌色兜底
    }
  }

  /**
   * 将 Activity 窗口背景设为透明（等价 windowBackground 透明化）。
   * 延迟 500ms 等待 RN 根视图完成首屏渲染后切换，避免启动画面品牌色提前消失。
   */
  private void applyTranslucentWindow() {
    mainHandler.postDelayed(() -> {
      if (getWindow() != null) {
        getWindow().setBackgroundDrawableResource(android.R.color.transparent);
      }
    }, 500);
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
    scheduleDelayedRefresh();
  }

  /**
   * 多窗口模式切换（含车机 ROM 强制小窗/画中画）时强制刷新 RN 根视图。
   * 进入与退出两个方向都要刷新：进入小窗时系统会把 Activity 的可见区域改为小窗，
   * 若此时不重绘，小窗里会继续显示上一次的旧画面（画面不跟随当前页面）；
   * 退出小窗回到全屏同理。与 onNewIntent 共用延迟补刷通道，防止连续触发时重复刷新。
   */
  @Override
  public void onMultiWindowModeChanged(boolean isInMultiWindowMode, Configuration newConfig) {
    super.onMultiWindowModeChanged(isInMultiWindowMode, newConfig);
    scheduleDelayedRefresh();
  }

  /**
   * 标准画中画状态回调（部分车机 ROM 走这条通道而不是 onMultiWindowModeChanged）。
   * 进/出 PIP 都补刷一次，保证小窗画面与全屏内容一致。
   */
  @Override
  public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
    scheduleDelayedRefresh();
  }

  /**
   * 回到前台：部分 ROM 小窗恢复只走 onResume，不触发多窗口回调，
   * 这里同样补刷，避免小窗停留在进入全屏前的旧画面。
   */
  @Override
  protected void onResume() {
    super.onResume();
    if (isFirstResume) {
      isFirstResume = false;
      return;
    }
    scheduleDelayedRefresh();
  }

  /**
   * 小窗↔全屏切换会带来屏幕尺寸/方向变化，RN 需要重新按新尺寸布局并重绘，
   * 否则窗口 Surface 上仍是旧尺寸的那一帧（画面不跟随）。
   */
  @Override
  public void onConfigurationChanged(Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    scheduleDelayedRefresh();
  }

  /**
   * 统一延迟补刷入口：同一批生命周期回调先清掉上一批，再按多个时间点各排一次，
   * 覆盖车机小窗过渡动画期间尺寸收敛的整个过程。
   */
  private void scheduleDelayedRefresh() {
    mainHandler.removeCallbacks(delayedRefreshRunnable);
    for (long delay : REFRESH_DELAYS) {
      mainHandler.postDelayed(delayedRefreshRunnable, delay);
    }
  }

  /**
   * 通过 ReactContext.emitDeviceEvent 向 JS 层发送 "lxMusicRefresh" 事件，
   * JS 层在 src/navigation/refreshOnForeground.ts 中监听并刷新当前界面；
   * 同时强制根视图重新布局与重绘，让窗口 Surface 立刻提交新帧，
   * 避免系统小窗缓存旧画面。
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
    forceRedrawRootView();
  }

  /**
   * 强制窗口内容重新测量、布局并绘制一次，触发 Surface 提交新帧。
   * 车机 ROM 的小窗会缓存上一帧画面，仅 requestLayout/invalidate 在部分机型上
   * 不足以让小窗刷新，这里额外重建一次根容器图层，丢弃系统缓存的旧帧。
   */
  private void forceRedrawRootView() {
    try {
      if (getWindow() == null) return;
      final android.view.View decorView = getWindow().getDecorView();
      if (decorView != null) {
        // forceLayout 会把 measure 请求标记为强制，即使尺寸数值没变也会重新测量一次，
        // 这是「全屏 → 小窗尺寸数值恰好相同但 Surface 已换」时唤醒重新布局的关键
        decorView.forceLayout();
        decorView.requestLayout();
        decorView.invalidate();
        decorView.postInvalidateOnAnimation();
      }
      final android.view.View contentView = findViewById(android.R.id.content);
      if (contentView != null) {
        contentView.forceLayout();
        contentView.requestLayout();
        contentView.invalidate();
        contentView.post(() -> {
          try {
            if (!contentView.isAttachedToWindow()) return;
            contentView.forceLayout();
            contentView.requestLayout();
            contentView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
            contentView.post(() -> {
              try {
                contentView.setLayerType(android.view.View.LAYER_TYPE_NONE, null);
              } catch (Exception ignored) {
                // 恢复默认图层失败不影响已提交的画面
              }
            });
          } catch (Exception ignored) {
            // 图层重建失败时保持上面已触发的普通重绘
          }
        });
      }
    } catch (Exception ignored) {
      // 重绘失败不影响业务逻辑
    }
  }
}
