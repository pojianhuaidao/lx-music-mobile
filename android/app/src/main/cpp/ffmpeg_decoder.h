// FFmpeg 音频解码核心（解封装 + 解码 + 重采样 → 16bit PCM）
//
// 设计要点：
// 1. 每个 FFmpegDecoder 实例对应一个音频文件，输出统一为 interleaved S16 PCM。
// 2. Read() 内部维护一段已转换好的 PCM 缓冲（pcmBuffer_），Java 侧按固定大小数组拉取。
// 3. 所有对外方法都持锁，允许 Java 侧在多线程调用（当前实现为单线程复用以降低复杂度）。
//
// 版本要求：FFmpeg >= 5.1（使用 AVChannelLayout / swr_alloc_set_opts2），推荐 6.0.1。

#ifndef LX_FFMPEG_DECODER_H_
#define LX_FFMPEG_DECODER_H_

#include <cstdint>
#include <mutex>
#include <string>
#include <vector>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/channel_layout.h>
#include <libavutil/error.h>
#include <libavutil/opt.h>
#include <libavutil/samplefmt.h>
#include <libswresample/swresample.h>
}

struct FFmpegMediaInfo {
  int64_t durationMs;
  int sampleRate;
  int channels;
  int64_t bitRate;
  char codecName[64];
};

class FFmpegDecoder {
 public:
  // Read() 的返回约定：> 0 为读到的字节数，kEndOfStream 为播放结束，kError 为出错。
  static const int kError = -1;
  static const int kEndOfStream = 0;

  FFmpegDecoder();
  ~FFmpegDecoder();

  FFmpegDecoder(const FFmpegDecoder&) = delete;
  FFmpegDecoder& operator=(const FFmpegDecoder&) = delete;

  // 只读探测：打开容器/流信息后立即关闭，用于取时长、采样率、声道数、编码器名。
  static bool Probe(const char* path, FFmpegMediaInfo* info, std::string* error);

  // 打开文件并初始化解码器与重采样器。outSampleRate / outChannels 为期望的输出参数。
  bool Open(const char* path, int outSampleRate, int outChannels);

  // 拉取 PCM 数据；返回值语义见 kError / kEndOfStream。
  int Read(uint8_t* buffer, int capacity);

  // 跳转到指定毫秒位置（关键帧/最近可解码位置）。
  bool Seek(int64_t positionMs);

  // 最近一次解码帧对应的绝对时间（毫秒）。
  int64_t PositionMs() const;

  void Close();

  const std::string& last_error() const { return lastError_; }

 private:
  bool OpenInput(const char* path);
  bool OpenDecoder();
  bool OpenResampler(int outSampleRate, int outChannels);
  int DecodeToPcmBuffer();
  int ConvertFrame(const AVFrame* frame);
  int FlushResampler();
  void SetError(int averr, const char* what);
  void ResetAfterSeek();

  AVFormatContext* formatCtx_ = nullptr;
  AVCodecContext* codecCtx_ = nullptr;
  SwrContext* swrCtx_ = nullptr;
  AVPacket* packet_ = nullptr;
  AVFrame* frame_ = nullptr;
  int audioStreamIndex_ = -1;

  int outSampleRate_ = 48000;
  int outChannels_ = 2;

  bool inputEof_ = false;
  bool decoderEof_ = false;
  bool resamplerFlushed_ = false;

  std::vector<uint8_t> pcmBuffer_;
  size_t pcmOffset_ = 0;

  // 播放位置用「跳转基准 + 已输出样本数」估算，避免部分容器 pts 缺失导致进度不动。
  int64_t basePtsMs_ = 0;
  int64_t decodedSamples_ = 0;

  std::string lastError_;
  mutable std::mutex mutex_;
};

#endif  // LX_FFMPEG_DECODER_H_
