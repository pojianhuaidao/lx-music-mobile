// JNI 桥接层：把 FFmpegDecoder 暴露给 Java 侧 FFmpegNative。
//
// 约定：所有 native 方法都在 Java 侧的工作线程调用（FFmpegAudioPlayer 的播放线程），
// 本层不做线程调度，只做参数转换与异常兜底。

#include <android/log.h>
#include <jni.h>

#include <cstdio>
#include <cstring>
#include <mutex>
#include <new>
#include <string>

#include "ffmpeg_decoder.h"

extern "C" {
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
}

#define LOG_TAG "FFmpegBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

std::mutex g_errorMutex;
std::string g_lastError;

void SetLastError(const std::string& error) {
  std::lock_guard<std::mutex> lock(g_errorMutex);
  g_lastError = error;
}

std::string GetLastError() {
  std::lock_guard<std::mutex> lock(g_errorMutex);
  return g_lastError;
}

FFmpegDecoder* FromHandle(jlong handle) {
  return reinterpret_cast<FFmpegDecoder*>(static_cast<intptr_t>(handle));
}

void ThrowIllegalState(JNIEnv* env, const char* message) {
  jclass clazz = env->FindClass("java/lang/IllegalStateException");
  if (clazz != nullptr) env->ThrowNew(clazz, message);
}

// FFmpeg 日志转发到 logcat，便于排查容器/解码异常。
void AvLogCallback(void* ptr, int level, const char* fmt, va_list vl) {
  if (level > AV_LOG_WARNING) return;
  char line[1024] = {0};
  vsnprintf(line, sizeof(line), fmt, vl);
  // FFmpeg 自带换行，去掉避免 logcat 出现空行。
  size_t len = strlen(line);
  if (len > 0 && line[len - 1] == '\n') line[len - 1] = '\0';
  int prio = level <= AV_LOG_ERROR ? ANDROID_LOG_ERROR
                                   : (level <= AV_LOG_WARNING ? ANDROID_LOG_WARN : ANDROID_LOG_INFO);
  __android_log_print(prio, LOG_TAG, "%s", line);
}

std::string JavaStringToUtf8(JNIEnv* env, jstring value) {
  if (value == nullptr) return std::string();
  const char* chars = env->GetStringUTFChars(value, nullptr);
  std::string result = chars == nullptr ? std::string() : std::string(chars);
  if (chars != nullptr) env->ReleaseStringUTFChars(value, chars);
  return result;
}

void ThrowIfOom(JNIEnv* env) {
  if (env->ExceptionCheck()) {
    env->ExceptionClear();
    jclass clazz = env->FindClass("java/lang/OutOfMemoryError");
    if (clazz != nullptr) env->ThrowNew(clazz, "FFmpeg 桥接层内存不足");
  }
}

}  // namespace

extern "C" jint JNI_OnLoad(JavaVM* vm, void* reserved) {
  (void)vm;
  (void)reserved;
  av_log_set_callback(AvLogCallback);
  LOGI("libffmpeg_bridge loaded, avutil=%d.%d.%d avformat=%d.%d.%d",
       LIBAVUTIL_VERSION_MAJOR, LIBAVUTIL_VERSION_MINOR, LIBAVUTIL_VERSION_MICRO,
       LIBAVFORMAT_VERSION_MAJOR, LIBAVFORMAT_VERSION_MINOR, LIBAVFORMAT_VERSION_MICRO);
  return JNI_VERSION_1_6;
}

extern "C" JNIEXPORT jstring JNICALL
Java_cn_toside_music_mobile_ffmpeg_FFmpegNative_nativeVersionInfo(JNIEnv* env, jclass) {
  char buf[192] = {0};
  snprintf(buf, sizeof(buf),
           "avformat=%d.%d.%d,avcodec=%d.%d.%d,swresample=%d.%d.%d,avutil=%d.%d.%d",
           LIBAVFORMAT_VERSION_MAJOR, LIBAVFORMAT_VERSION_MINOR, LIBAVFORMAT_VERSION_MICRO,
           LIBAVCODEC_VERSION_MAJOR, LIBAVCODEC_VERSION_MINOR, LIBAVCODEC_VERSION_MICRO,
           LIBSWRESAMPLE_VERSION_MAJOR, LIBSWRESAMPLE_VERSION_MINOR, LIBSWRESAMPLE_VERSION_MICRO,
           LIBAVUTIL_VERSION_MAJOR, LIBAVUTIL_VERSION_MINOR, LIBAVUTIL_VERSION_MICRO);
  return env->NewStringUTF(buf);
}

// 返回 [durationMs, sampleRate, channels, bitRate, codecName]；失败返回 null。
extern "C" JNIEXPORT jobjectArray JNICALL
Java_cn_toside_music_mobile_ffmpeg_FFmpegNative_nativeProbe(JNIEnv* env, jclass, jstring jpath) {
  std::string path = JavaStringToUtf8(env, jpath);
  if (path.empty()) {
    SetLastError("文件路径为空");
    return nullptr;
  }

  FFmpegMediaInfo info;
  std::string error;
  if (!FFmpegDecoder::Probe(path.c_str(), &info, &error)) {
    SetLastError(error);
    LOGW("probe failed: %s (%s)", path.c_str(), error.c_str());
    return nullptr;
  }

  jclass stringClass = env->FindClass("java/lang/String");
  if (stringClass == nullptr) return nullptr;
  jobjectArray result = env->NewObjectArray(5, stringClass, nullptr);
  if (result == nullptr) {
    ThrowIfOom(env);
    return nullptr;
  }

  char tmp[64] = {0};
  snprintf(tmp, sizeof(tmp), "%lld", static_cast<long long>(info.durationMs));
  env->SetObjectArrayElement(result, 0, env->NewStringUTF(tmp));
  snprintf(tmp, sizeof(tmp), "%d", info.sampleRate);
  env->SetObjectArrayElement(result, 1, env->NewStringUTF(tmp));
  snprintf(tmp, sizeof(tmp), "%d", info.channels);
  env->SetObjectArrayElement(result, 2, env->NewStringUTF(tmp));
  snprintf(tmp, sizeof(tmp), "%lld", static_cast<long long>(info.bitRate));
  env->SetObjectArrayElement(result, 3, env->NewStringUTF(tmp));
  env->SetObjectArrayElement(result, 4, env->NewStringUTF(info.codecName));
  return result;
}

extern "C" JNIEXPORT jlong JNICALL
Java_cn_toside_music_mobile_ffmpeg_FFmpegNative_nativeOpen(JNIEnv* env, jclass,
                                                           jstring jpath,
                                                           jint sampleRate,
                                                           jint channels) {
  std::string path = JavaStringToUtf8(env, jpath);
  if (path.empty()) {
    SetLastError("文件路径为空");
    return 0;
  }

  FFmpegDecoder* decoder = new (std::nothrow) FFmpegDecoder();
  if (decoder == nullptr) {
    SetLastError("创建解码器失败（内存不足）");
    ThrowIfOom(env);
    return 0;
  }
  if (!decoder->Open(path.c_str(), sampleRate, channels)) {
    SetLastError(decoder->last_error());
    LOGE("open failed: %s (%s)", path.c_str(), decoder->last_error().c_str());
    delete decoder;
    return 0;
  }
  LOGI("opened: %s -> %dHz/%dch", path.c_str(), sampleRate, channels);
  return static_cast<jlong>(reinterpret_cast<intptr_t>(decoder));
}

extern "C" JNIEXPORT jint JNICALL
Java_cn_toside_music_mobile_ffmpeg_FFmpegNative_nativeRead(JNIEnv* env, jclass,
                                                          jlong handle,
                                                          jbyteArray jbuffer,
                                                          jint offset,
                                                          jint length) {
  FFmpegDecoder* decoder = FromHandle(handle);
  if (decoder == nullptr || jbuffer == nullptr) {
    SetLastError("nativeRead 参数非法");
    return FFmpegDecoder::kError;
  }
  jsize arrayLength = env->GetArrayLength(jbuffer);
  if (offset < 0 || length <= 0 || offset + length > arrayLength) {
    SetLastError("nativeRead 缓冲区越界");
    return FFmpegDecoder::kError;
  }

  jbyte* bytes = env->GetByteArrayElements(jbuffer, nullptr);
  if (bytes == nullptr) {
    ThrowIfOom(env);
    return FFmpegDecoder::kError;
  }
  int read = decoder->Read(reinterpret_cast<uint8_t*>(bytes + offset), length);
  env->ReleaseByteArrayElements(jbuffer, bytes, 0);
  if (read == FFmpegDecoder::kError) SetLastError(decoder->last_error());
  return read;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_cn_toside_music_mobile_ffmpeg_FFmpegNative_nativeSeek(JNIEnv*, jclass,
                                                           jlong handle,
                                                           jlong positionMs) {
  FFmpegDecoder* decoder = FromHandle(handle);
  if (decoder == nullptr) {
    SetLastError("nativeSeek 句柄无效");
    return JNI_FALSE;
  }
  bool ok = decoder->Seek(static_cast<int64_t>(positionMs));
  if (!ok) SetLastError(decoder->last_error());
  return ok ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jlong JNICALL
Java_cn_toside_music_mobile_ffmpeg_FFmpegNative_nativePosition(JNIEnv*, jclass, jlong handle) {
  FFmpegDecoder* decoder = FromHandle(handle);
  if (decoder == nullptr) return 0;
  return static_cast<jlong>(decoder->PositionMs());
}

extern "C" JNIEXPORT jstring JNICALL
Java_cn_toside_music_mobile_ffmpeg_FFmpegNative_nativeLastError(JNIEnv* env, jclass, jlong handle) {
  std::string error;
  FFmpegDecoder* decoder = FromHandle(handle);
  error = decoder != nullptr ? decoder->last_error() : GetLastError();
  if (error.empty()) return nullptr;
  return env->NewStringUTF(error.c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_cn_toside_music_mobile_ffmpeg_FFmpegNative_nativeClose(JNIEnv*, jclass, jlong handle) {
  FFmpegDecoder* decoder = FromHandle(handle);
  if (decoder == nullptr) return;
  decoder->Close();
  delete decoder;
}
