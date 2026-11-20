package cn.toside.music.mobile.ffmpeg;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Collections;
import java.util.List;

/** 注册 FFmpegAudioPlayer 模块，需在 MainApplication.getPackages() 中手动添加。 */
public class FFmpegAudioPlayerPackage implements ReactPackage {

  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    return Collections.<NativeModule>singletonList(new FFmpegAudioPlayerModule(reactContext));
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
