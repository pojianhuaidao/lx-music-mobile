# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

-keep class com.reactnativenavigation.views.element.animators.** { *; }
# -keepclassmembers class com.reactnativenavigation.views.element.animators.** { *; }


-keep class org.jaudiotagger.tag.** { *; }


-keep public class com.dylanvann.fastimage.* {*;}
-keep public class com.dylanvann.fastimage.** {*;}


# sherpa-onnx 离线语音引擎：Java 类是 JNI 桥接层，native 通过 GetFieldID/GetMethodID
# 按字段/方法名反射访问。R8 混淆会改写字段名，导致 JNI 抛
# "RuntimeException: Failed to get field ID for decodingMethod"，init 必然失败。
# 完整保留类名、字段名、方法名（含 getter/setter 与 native 构造参数名）。
-keep class com.k2fsa.sherpa.onnx.** { *; }
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep public class * extends com.bumptech.glide.module.AppGlideModule
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
  **[] $VALUES;
  public *;
}
