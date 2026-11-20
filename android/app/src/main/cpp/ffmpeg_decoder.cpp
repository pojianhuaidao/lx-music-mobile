// FFmpeg 音频解码核心实现。
//
// 流程：avformat 解封装 → avcodec 解码 → swresample 重采样/混音 → interleaved S16 PCM。
// 目标格式固定为 S16（AudioTrack ENCODING_PCM_16BIT），声道数固定为用户传入值（通常 2）。

#include "ffmpeg_decoder.h"

#include <algorithm>
#include <cstdio>
#include <cstring>

namespace {
constexpr int kBytesPerSample = 2;  // S16

// FFmpeg 的错误码转可读文本，便于回传给 JS 层排查。
std::string AvErrToString(int averr) {
  char buf[AV_ERROR_MAX_STRING_SIZE] = {0};
  av_strerror(averr, buf, sizeof(buf));
  return std::string(buf);
}
}  // namespace

FFmpegDecoder::FFmpegDecoder() {
  packet_ = av_packet_alloc();
  frame_ = av_frame_alloc();
}

FFmpegDecoder::~FFmpegDecoder() { Close(); }

bool FFmpegDecoder::Probe(const char* path, FFmpegMediaInfo* info, std::string* error) {
  if (path == nullptr || info == nullptr) {
    if (error != nullptr) *error = "path 为空";
    return false;
  }
  AVFormatContext* ctx = nullptr;
  int ret = avformat_open_input(&ctx, path, nullptr, nullptr);
  if (ret < 0) {
    if (error != nullptr) *error = "avformat_open_input 失败: " + AvErrToString(ret);
    return false;
  }
  ret = avformat_find_stream_info(ctx, nullptr);
  if (ret < 0) {
    if (error != nullptr) *error = "avformat_find_stream_info 失败: " + AvErrToString(ret);
    avformat_close_input(&ctx);
    return false;
  }
  int streamIndex = av_find_best_stream(ctx, AVMEDIA_TYPE_AUDIO, -1, -1, nullptr, 0);
  if (streamIndex < 0) {
    if (error != nullptr) *error = "文件中没有可解码的音频流（不支持该容器或已损坏）";
    avformat_close_input(&ctx);
    return false;
  }

  AVStream* stream = ctx->streams[streamIndex];
  AVCodecParameters* par = stream->codecpar;

  int64_t durationMs = 0;
  if (ctx->duration != AV_NOPTS_VALUE && ctx->duration > 0) {
    durationMs = ctx->duration / (AV_TIME_BASE / 1000);
  } else if (stream->duration != AV_NOPTS_VALUE && stream->duration > 0) {
    durationMs = av_rescale_q(stream->duration, stream->time_base, AVRational{1, 1000});
  }

  int channels = par->ch_layout.nb_channels;
  if (channels <= 0) channels = 2;

  std::memset(info, 0, sizeof(FFmpegMediaInfo));
  info->durationMs = durationMs;
  info->sampleRate = par->sample_rate > 0 ? par->sample_rate : 44100;
  info->channels = channels;
  info->bitRate = par->bit_rate > 0 ? par->bit_rate : 0;
  const char* codecName = avcodec_get_name(par->codec_id);
  if (codecName != nullptr) {
    std::snprintf(info->codecName, sizeof(info->codecName), "%s", codecName);
  }

  avformat_close_input(&ctx);
  return true;
}

bool FFmpegDecoder::Open(const char* path, int outSampleRate, int outChannels) {
  std::lock_guard<std::mutex> lock(mutex_);
  Close();
  lastError_.clear();

  outSampleRate_ = outSampleRate > 0 ? outSampleRate : 48000;
  outChannels_ = outChannels > 0 ? outChannels : 2;

  if (!OpenInput(path)) {
    Close();
    return false;
  }
  if (!OpenDecoder()) {
    Close();
    return false;
  }
  if (!OpenResampler(outSampleRate_, outChannels_)) {
    Close();
    return false;
  }

  basePtsMs_ = 0;
  decodedSamples_ = 0;
  inputEof_ = false;
  decoderEof_ = false;
  resamplerFlushed_ = false;
  pcmBuffer_.clear();
  pcmOffset_ = 0;
  return true;
}

bool FFmpegDecoder::OpenInput(const char* path) {
  if (path == nullptr || path[0] == '\0') {
    lastError_ = "文件路径为空";
    return false;
  }
  int ret = avformat_open_input(&formatCtx_, path, nullptr, nullptr);
  if (ret < 0) {
    lastError_ = "打开文件失败: " + AvErrToString(ret);
    return false;
  }
  ret = avformat_find_stream_info(formatCtx_, nullptr);
  if (ret < 0) {
    lastError_ = "解析流信息失败: " + AvErrToString(ret);
    return false;
  }
  audioStreamIndex_ = av_find_best_stream(formatCtx_, AVMEDIA_TYPE_AUDIO, -1, -1, nullptr, 0);
  if (audioStreamIndex_ < 0) {
    lastError_ = "没有可用的音频流";
    return false;
  }
  return true;
}

bool FFmpegDecoder::OpenDecoder() {
  AVStream* stream = formatCtx_->streams[audioStreamIndex_];
  const AVCodec* codec = avcodec_find_decoder(stream->codecpar->codec_id);
  if (codec == nullptr) {
    lastError_ = std::string("缺少解码器: ") + avcodec_get_name(stream->codecpar->codec_id);
    return false;
  }
  codecCtx_ = avcodec_alloc_context3(codec);
  if (codecCtx_ == nullptr) {
    lastError_ = "avcodec_alloc_context3 失败（内存不足）";
    return false;
  }
  int ret = avcodec_parameters_to_context(codecCtx_, stream->codecpar);
  if (ret < 0) {
    lastError_ = "复制解码参数失败: " + AvErrToString(ret);
    return false;
  }
  // pkt_timebase 参与 pts 换算，部分容器缺失时会导致时间戳异常。
  codecCtx_->pkt_timebase = stream->time_base;
  // 0 表示由 FFmpeg 依据 CPU 核数自动决定解码线程数。
  codecCtx_->thread_count = 0;

  ret = avcodec_open2(codecCtx_, codec, nullptr);
  if (ret < 0) {
    lastError_ = std::string("打开解码器失败(") + codec->name + "): " + AvErrToString(ret);
    return false;
  }
  return true;
}

bool FFmpegDecoder::OpenResampler(int outSampleRate, int outChannels) {
  AVChannelLayout outLayout = {};
  av_channel_layout_default(&outLayout, outChannels > 0 ? outChannels : 2);

  // 注意：av_channel_layout_copy 会先 uninit 目标结构，dst 必须是已初始化的空结构，
  // 否则会 free 掉栈上的野指针。
  AVChannelLayout inLayout = {};
  av_channel_layout_copy(&inLayout, &codecCtx_->ch_layout);
  if (inLayout.nb_channels <= 0) {
    av_channel_layout_uninit(&inLayout);
    av_channel_layout_default(&inLayout, 2);
  }

  int ret = swr_alloc_set_opts2(&swrCtx_,
                                &outLayout,
                                AV_SAMPLE_FMT_S16,
                                outSampleRate,
                                &inLayout,
                                codecCtx_->sample_fmt,
                                codecCtx_->sample_rate > 0 ? codecCtx_->sample_rate : outSampleRate,
                                0,
                                nullptr);
  av_channel_layout_uninit(&inLayout);
  av_channel_layout_uninit(&outLayout);
  if (ret < 0 || swrCtx_ == nullptr) {
    lastError_ = "swr_alloc_set_opts2 失败: " + AvErrToString(ret);
    return false;
  }
  ret = swr_init(swrCtx_);
  if (ret < 0) {
    lastError_ = "swr_init 失败: " + AvErrToString(ret);
    return false;
  }
  return true;
}

int FFmpegDecoder::ConvertFrame(const AVFrame* frame) {
  const int inSampleRate = frame->sample_rate > 0 ? frame->sample_rate : codecCtx_->sample_rate;
  if (inSampleRate <= 0) {
    // 采样率未知时无法重采样，直接跳过该帧（极少出现）。
    return 0;
  }

  // 输出样本上限：输入样本 + 重采样器内部残留，再按采样率比例放大。
  const int64_t delay = swr_get_delay(swrCtx_, inSampleRate);
  int maxOutSamples = static_cast<int>(av_rescale_rnd(delay + frame->nb_samples,
                                                      outSampleRate_, inSampleRate,
                                                      AV_ROUND_UP));
  if (maxOutSamples <= 0) return 0;

  const size_t bytes = static_cast<size_t>(maxOutSamples) * outChannels_ * kBytesPerSample;
  pcmBuffer_.resize(bytes);
  uint8_t* out = pcmBuffer_.data();

  int converted = swr_convert(swrCtx_, &out, maxOutSamples,
                              (const uint8_t**)frame->extended_data,
                              frame->nb_samples);
  if (converted < 0) {
    SetError(converted, "swr_convert");
    return kError;
  }
  pcmBuffer_.resize(static_cast<size_t>(converted) * outChannels_ * kBytesPerSample);
  decodedSamples_ += converted;
  return converted;
}

int FFmpegDecoder::FlushResampler() {
  if (resamplerFlushed_) return kEndOfStream;
  resamplerFlushed_ = true;

  // 冲掉重采样器内部残留样本，避免结尾丢音。
  const int64_t delay = swr_get_delay(swrCtx_, outSampleRate_);
  int maxOutSamples = static_cast<int>(delay) + 1024;
  if (maxOutSamples <= 0) return kEndOfStream;

  const size_t bytes = static_cast<size_t>(maxOutSamples) * outChannels_ * kBytesPerSample;
  pcmBuffer_.resize(bytes);
  uint8_t* out = pcmBuffer_.data();
  int converted = swr_convert(swrCtx_, &out, maxOutSamples, nullptr, 0);
  if (converted < 0) {
    SetError(converted, "swr_convert(flush)");
    return kError;
  }
  pcmBuffer_.resize(static_cast<size_t>(converted) * outChannels_ * kBytesPerSample);
  decodedSamples_ += converted;
  return converted;
}

int FFmpegDecoder::DecodeToPcmBuffer() {
  pcmOffset_ = 0;
  pcmBuffer_.clear();

  for (;;) {
    // 1) 优先取解码器已产出的帧
    int ret = avcodec_receive_frame(codecCtx_, frame_);
    if (ret == 0) {
      int converted = ConvertFrame(frame_);
      av_frame_unref(frame_);
      if (converted == kError) return kError;
      // 重采样器可能只吃不吐（converted == 0），继续取下一帧。
      if (pcmBuffer_.empty()) {
        if (decoderEof_) return FlushResampler();
        continue;
      }
      return static_cast<int>(pcmBuffer_.size());
    }
    if (ret == AVERROR_EOF) {
      decoderEof_ = true;
      return FlushResampler();
    }
    if (ret != AVERROR(EAGAIN)) {
      SetError(ret, "avcodec_receive_frame");
      return kError;
    }

    // 2) 解码器需要新数据：从容器读包（EOF 时送入空包以冲刷解码器）
    if (inputEof_) {
      // 已送过空包且仍是 EAGAIN，说明解码器内部已无数据，视为流结束。
      decoderEof_ = true;
      return FlushResampler();
    }
    int readRet = av_read_frame(formatCtx_, packet_);
    if (readRet == AVERROR_EOF) {
      inputEof_ = true;
      avcodec_send_packet(codecCtx_, nullptr);
      continue;
    }
    if (readRet < 0) {
      SetError(readRet, "av_read_frame");
      return kError;
    }
    if (packet_->stream_index != audioStreamIndex_) {
      av_packet_unref(packet_);
      continue;
    }
    int sendRet = avcodec_send_packet(codecCtx_, packet_);
    av_packet_unref(packet_);
    if (sendRet < 0 && sendRet != AVERROR(EAGAIN)) {
      SetError(sendRet, "avcodec_send_packet");
      return kError;
    }
  }
}

int FFmpegDecoder::Read(uint8_t* buffer, int capacity) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (buffer == nullptr || capacity <= 0) return kError;
  if (codecCtx_ == nullptr) {
    lastError_ = "解码器未打开";
    return kError;
  }

  if (pcmOffset_ >= pcmBuffer_.size()) {
    int produced = DecodeToPcmBuffer();
    if (produced <= 0) return produced;
  }

  size_t remaining = pcmBuffer_.size() - pcmOffset_;
  size_t n = std::min(static_cast<size_t>(capacity), remaining);
  std::memcpy(buffer, pcmBuffer_.data() + pcmOffset_, n);
  pcmOffset_ += n;
  return static_cast<int>(n);
}

bool FFmpegDecoder::Seek(int64_t positionMs) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (formatCtx_ == nullptr || codecCtx_ == nullptr || audioStreamIndex_ < 0) return false;
  if (positionMs < 0) positionMs = 0;

  AVStream* stream = formatCtx_->streams[audioStreamIndex_];
  int64_t streamTs = av_rescale_q(positionMs, AVRational{1, 1000}, stream->time_base);
  int ret = avformat_seek_file(formatCtx_, audioStreamIndex_, INT64_MIN, streamTs, INT64_MAX, 0);
  if (ret < 0) {
    // 部分容器（如流式 ASF）不支持 avformat_seek_file，退回 av_seek_frame。
    int64_t globalTs = positionMs * (AV_TIME_BASE / 1000);
    ret = av_seek_frame(formatCtx_, -1, globalTs, AVSEEK_FLAG_BACKWARD);
  }
  if (ret < 0) {
    lastError_ = "跳转失败: " + AvErrToString(ret);
    return false;
  }

  avcodec_flush_buffers(codecCtx_);
  ResetAfterSeek();
  basePtsMs_ = positionMs;
  decodedSamples_ = 0;
  return true;
}

void FFmpegDecoder::ResetAfterSeek() {
  inputEof_ = false;
  decoderEof_ = false;
  resamplerFlushed_ = false;
  pcmBuffer_.clear();
  pcmOffset_ = 0;
  if (swrCtx_ != nullptr) {
    // 重置重采样器内部状态，丢弃跳转前的残留样本。
    swr_close(swrCtx_);
    swr_init(swrCtx_);
  }
}

int64_t FFmpegDecoder::PositionMs() const {
  std::lock_guard<std::mutex> lock(mutex_);
  if (outSampleRate_ <= 0) return basePtsMs_;
  return basePtsMs_ + decodedSamples_ * 1000 / outSampleRate_;
}

void FFmpegDecoder::Close() {
  if (swrCtx_ != nullptr) {
    swr_free(&swrCtx_);
  }
  if (codecCtx_ != nullptr) {
    avcodec_free_context(&codecCtx_);
  }
  if (formatCtx_ != nullptr) {
    avformat_close_input(&formatCtx_);
  }
  audioStreamIndex_ = -1;
  inputEof_ = false;
  decoderEof_ = false;
  resamplerFlushed_ = false;
  pcmBuffer_.clear();
  pcmOffset_ = 0;
  basePtsMs_ = 0;
  decodedSamples_ = 0;
}

void FFmpegDecoder::SetError(int averr, const char* what) {
  lastError_ = std::string(what) + " 失败: " + AvErrToString(averr);
}
