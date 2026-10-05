package cn.toside.music.mobile.voice;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Log;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import androidx.core.content.ContextCompat;

import com.k2fsa.sherpa.onnx.FeatureConfig;
import com.k2fsa.sherpa.onnx.KeywordSpotter;
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineRecognizer;
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;

/**
 * sherpa-onnx 离线语音引擎：
 * - 模型直接从 assets/voice 加载（v1.13.8 Android API 仅支持 AssetManager 构造，
 *   故不做私有目录解压，改为 assets 直读，省磁盘且加载更快）；
 * - 16kHz/16bit/mono AudioRecord 采集，同时喂给 KWS（唤醒词）与 ASR（指令识别）；
 * - 唤醒词命中后进入指令识别态，超时或文本稳定后回调结果并回到唤醒监听态。
 */
public class SherpaEngine {

  private static final String TAG = "VoiceSherpaEngine";

  public static final int STATE_IDLE = 0;
  public static final int STATE_LISTENING = 1;    // 唤醒词监听中
  public static final int STATE_RECOGNIZING = 2;  // 已唤醒，指令识别中

  public interface Listener {
    void onWakeUp();
    void onResult(String text);
    void onError(String message);
    void onState(int state);
  }

  private static final int SAMPLE_RATE = 16000;
  private static final int MODE_KWS = 0;
  private static final int MODE_ASR = 1;
  private static final int MODE_ASR_FREE = 2;  // 免唤醒：持续 ASR 识别，不依赖 KWS

  // assets 内模型路径（相对 assets 根目录）
  private static final String ASR_ENCODER = "voice/asr/encoder.onnx";
  private static final String ASR_DECODER = "voice/asr/decoder.onnx";
  private static final String ASR_JOINER = "voice/asr/joiner.onnx";
  private static final String ASR_TOKENS = "voice/asr/tokens.txt";
  private static final String KWS_ENCODER = "voice/kws/encoder.onnx";
  private static final String KWS_DECODER = "voice/kws/decoder.onnx";
  private static final String KWS_JOINER = "voice/kws/joiner.onnx";
  private static final String KWS_TOKENS = "voice/kws/tokens.txt";
  private static final String KWS_KEYWORDS_FILE = "voice/kws/keywords.txt";

  private final Context context;
  private Listener listener;

  private OnlineRecognizer recognizer;
  private KeywordSpotter spotter;
  private OnlineStream asrStream;
  private OnlineStream kwsStream;

  private AudioRecord audioRecord;
  private Thread captureThread;
  private volatile boolean running = false;
  private volatile boolean listening = false;
  private volatile int mode = MODE_KWS;
  // 免唤醒开关：true=需要喊唤醒词（默认）；false=直接说"播放XXX"触发搜歌
  private volatile boolean enableWakeWord = true;

  private volatile String wakeWord = "你好小马";
  private volatile float sensitivity = 0.7f;
  // 敏感度 -> keywordsScore：sensitivity 越大越灵敏（阈值越低）
  private volatile int spotterVersion = 0;

  // 中文唤醒词 -> keywords.txt 中的 token 串（空格分隔，每个 token 必须存在于 kws/tokens.txt）
  // createStream(keywords) 的 keywords 需为 token 序列；直接传中文短语会被 C++ 视为单个 OOV token
  private final Map<String, String> wakeWordToTokens = new HashMap<>();

  private long asrStartTime = 0;
  private long lastTextChangeTime = 0;
  private String lastAsrText = "";
  // 最近一次 init() 失败的具体原因（供 ensureEngineInit 上报给 RN，便于 toast 显示真实错误）
  private volatile String lastInitError = null;
  private static final long RECOGNIZE_TIMEOUT_MS = 6000;
  private static final long MIN_ASR_TIME_MS = 2000;
  private static final long STABLE_TEXT_MS = 1200;

  public SherpaEngine(Context context) {
    this.context = context.getApplicationContext();
  }

  public void setListener(Listener listener) {
    this.listener = listener;
  }

  public void setWakeWord(String wakeWord) {
    if (wakeWord == null || wakeWord.trim().isEmpty()) return;
    this.wakeWord = wakeWord.trim();
  }

  public void setSensitivity(float sensitivity) {
    if (sensitivity < 0) sensitivity = 0;
    if (sensitivity > 1) sensitivity = 1;
    if (Math.abs(this.sensitivity - sensitivity) < 0.01f) return;
    this.sensitivity = sensitivity;
    this.spotterVersion++; // 触发重建 spotter（capture 线程内执行）
  }

  /** 免唤醒模式开关：true=需要唤醒词；false=直接持续 ASR 识别命令。运行时切换即时生效。 */
  public void setEnableWakeWord(boolean enable) {
    this.enableWakeWord = enable;
  }

  private float keywordsScore() {
    return 1.5f - sensitivity;
  }

  /** 加载 ASR 与 KWS 模型，失败返回 false。线程安全：调用方负责在后台线程执行。 */
  public synchronized boolean init() {
    lastInitError = null;
    try {
      // 预检 assets 模型完整性：缺失时不进 native，避免 C++ 层模型文件读取失败直接 _Exit 闪退
      String missing = checkModelAssets();
      if (missing != null) {
        lastInitError = "missing model asset: " + missing;
        Log.e(TAG, lastInitError);
        return false;
      }
      loadWakeWordMap();
      FeatureConfig featConfig = new FeatureConfig();
      featConfig.setSampleRate(SAMPLE_RATE);
      featConfig.setFeatureDim(80);

      OnlineTransducerModelConfig asrTransducer = new OnlineTransducerModelConfig();
      asrTransducer.setEncoder(ASR_ENCODER);
      asrTransducer.setDecoder(ASR_DECODER);
      asrTransducer.setJoiner(ASR_JOINER);
      OnlineModelConfig asrModelConfig = new OnlineModelConfig();
      asrModelConfig.setTransducer(asrTransducer);
      asrModelConfig.setTokens(ASR_TOKENS);
      asrModelConfig.setNumThreads(2);
      asrModelConfig.setDebug(false);
      asrModelConfig.setModelType("zipformer");
      OnlineRecognizerConfig asrConfig = new OnlineRecognizerConfig();
      asrConfig.setFeatConfig(featConfig);
      asrConfig.setModelConfig(asrModelConfig);
      asrConfig.setDecodingMethod("greedy_search");
      recognizer = new OnlineRecognizer(context.getAssets(), asrConfig);
      Log.i(TAG, "ASR recognizer loaded");

      spotter = buildSpotter();
      Log.i(TAG, "KWS spotter loaded, wakeWord=" + wakeWord + ", score=" + keywordsScore());
      return true;
    } catch (Throwable e) {
      Log.e(TAG, "Failed to init engine", e);
      lastInitError = e.getClass().getSimpleName() + ": "
          + (e.getMessage() == null ? "" : e.getMessage());
      return false;
    }
  }

  /** 校验 assets/voice 下全部模型文件是否存在，缺失返回相对 assets 的路径；全部存在返回 null。 */
  private String checkModelAssets() {
    String[] required = {
        ASR_ENCODER, ASR_DECODER, ASR_JOINER, ASR_TOKENS,
        KWS_ENCODER, KWS_DECODER, KWS_JOINER, KWS_TOKENS, KWS_KEYWORDS_FILE
    };
    for (String path : required) {
      try {
        java.io.InputStream is = context.getAssets().open(path);
        if (is != null) is.close();
      } catch (IOException e) {
        return path;
      }
    }
    return null;
  }

  /** 最近一次 init() 失败的具体原因；未失败或未初始化时返回 null。 */
  public synchronized String getLastInitError() {
    return lastInitError;
  }

  private KeywordSpotter buildSpotter() {
    FeatureConfig featConfig = new FeatureConfig();
    featConfig.setSampleRate(SAMPLE_RATE);
    featConfig.setFeatureDim(80);

    OnlineTransducerModelConfig kwsTransducer = new OnlineTransducerModelConfig();
    kwsTransducer.setEncoder(KWS_ENCODER);
    kwsTransducer.setDecoder(KWS_DECODER);
    kwsTransducer.setJoiner(KWS_JOINER);
    OnlineModelConfig kwsModelConfig = new OnlineModelConfig();
    kwsModelConfig.setTransducer(kwsTransducer);
    kwsModelConfig.setTokens(KWS_TOKENS);
    kwsModelConfig.setNumThreads(1);
    kwsModelConfig.setDebug(false);
    // 注意：KWS 模型为 zipformer2（encoder metadata 无 attention_dims、含 query_head_dims/value_head_dims/num_heads）。
    // 若误设 "zipformer"，C++ OnlineZipformerTransducerModel::InitEncoder 读取缺失的 attention_dims
    // 会触发 SHERPA_ONNX_EXIT(-1) 直接终止进程（Java try-catch 无法捕获），表现为初始化即闪退。
    kwsModelConfig.setModelType("zipformer2");
    KeywordSpotterConfig kwsConfig = new KeywordSpotterConfig();
    kwsConfig.setFeatConfig(featConfig);
    kwsConfig.setModelConfig(kwsModelConfig);
    kwsConfig.setKeywordsFile(KWS_KEYWORDS_FILE);
    kwsConfig.setKeywordsScore(keywordsScore());
    return new KeywordSpotter(context.getAssets(), kwsConfig);
  }

  /**
   * 从 assets/voice/kws/keywords.txt 解析「中文唤醒词 -> token 串」映射。
   * 每行格式：`token token ... @中文短语`，@ 前为模型词表中的 token 序列（空格分隔）。
   */
  private void loadWakeWordMap() {
    wakeWordToTokens.clear();
    try (BufferedReader reader = new BufferedReader(
        new InputStreamReader(context.getAssets().open(KWS_KEYWORDS_FILE), StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (line.trim().isEmpty()) continue;
        int at = line.lastIndexOf('@');
        if (at <= 0) continue;
        String tokenPart = line.substring(0, at).trim();
        String phrase = line.substring(at + 1).trim();
        if (!tokenPart.isEmpty() && !phrase.isEmpty()) {
          wakeWordToTokens.put(phrase, tokenPart);
        }
      }
    } catch (IOException e) {
      Log.w(TAG, "Failed to read keywords file: " + KWS_KEYWORDS_FILE, e);
    }
  }

  /** 将中文唤醒词解析为 createStream 可用的 token 串；解析失败时兜底到默认唤醒词/首个唤醒词。 */
  private String resolveWakeWordTokens(String wakeWord) {
    String tokens = wakeWordToTokens.get(wakeWord);
    if (tokens != null && !tokens.isEmpty()) return tokens;
    String def = wakeWordToTokens.get("你好小马");
    if (def != null && !def.isEmpty()) return def;
    for (String v : wakeWordToTokens.values()) {
      if (!v.isEmpty()) return v;
    }
    return "";
  }

  public synchronized void startListening() {
    if (!hasRecordPermission()) {
      notifyError("no record audio permission");
      return;
    }
    // 防御：引擎尚未初始化完成或初始化失败（spotter 为 null）时不得启动采集线程，
    // 否则 captureLoop 内 currentSpotter.createStream 会 NPE 崩溃后台线程导致 RN 红屏。
    if (spotter == null) {
      String reason = (lastInitError != null && !lastInitError.isEmpty())
          ? lastInitError : "not initialized";
      notifyError("engine not ready: " + reason);
      return;
    }
    listening = true;
    if (!running) {
      running = true;
      captureThread = new Thread(this::captureLoop, "voice-capture");
      captureThread.setPriority(Thread.MAX_PRIORITY);
      captureThread.start();
    }
    notifyState(STATE_LISTENING);
  }

  public synchronized void stopListening() {
    listening = false;
    running = false;
    stopCaptureThreadSafely();
    // 采集线程已退出时，其尾部已自行释放 AudioRecord/streams（判空保护），
    // 此处再释放仅兜底线程卡死场景，避免双重释放。
    releaseAudioRecord();
    releaseStreams();
    mode = MODE_KWS;
    notifyState(STATE_IDLE);
  }

  public synchronized void destroy() {
    listening = false;
    running = false;
    stopCaptureThreadSafely();
    releaseAudioRecord();
    releaseStreams();
    if (spotter != null) {
      try { spotter.release(); } catch (Throwable ignored) {}
      spotter = null;
    }
    if (recognizer != null) {
      try { recognizer.release(); } catch (Throwable ignored) {}
      recognizer = null;
    }
    notifyState(STATE_IDLE);
  }

  /**
   * 安全停止协议（修复 use-after-free 闪退的核心）：
   * 置停止标志 + interrupt 后必须 join 等待采集线程完全退出，调用方才能释放
   * AudioRecord / sherpa-onnx stream / spotter / recognizer 等 native 资源。
   *
   * 背景：采集线程每帧执行 audioRecord.read / acceptWaveform / decode / getResult
   * 等 JNI 调用；若另一线程在它运行中途 release 底层 native 对象，后续调用即为
   * 野指针访问（use-after-free），在 C++ 层直接 SIGSEGV 杀死进程——Java 层
   * try-catch(Throwable) 无法拦截，表现为"应用直接闪退"而非 RN 红屏。
   *
   * 实现要点：
   * 1) interrupt 后短 join（正常每 0.1s 一帧，很快退出）；
   * 2) 若线程阻塞在 AudioRecord.read（native 阻塞，interrupt 无法唤醒），
   *    先 audioRecord.stop() 令 read 返回错误退出，再等待；
   * 3) 仍超时则记录错误并继续（极小概率，绝不无限阻塞主线程）。
   */
  private void stopCaptureThreadSafely() {
    Thread t = captureThread;
    captureThread = null;
    if (t == null) return;
    t.interrupt();
    try {
      // 第一段：普通路径，线程收到中断后在下个循环检查退出
      for (int i = 0; i < 20 && t.isAlive(); i++) {
        t.join(50); // 最多等 1s
      }
      if (t.isAlive()) {
        // 第二段：线程可能阻塞在 AudioRecord.read 的 native 等待，
        // 先 stop 录音唤醒 read（返回错误码后捕获退出），再等其退出
        if (audioRecord != null) {
          try {
            audioRecord.stop();
          } catch (Throwable ignored) {}
        }
        for (int i = 0; i < 30 && t.isAlive(); i++) {
          t.join(50); // 再等最多 1.5s
        }
      }
      if (t.isAlive()) {
        Log.e(TAG, "capture thread still alive after stop protocol, releasing anyway");
      } else {
        Log.i(TAG, "capture thread stopped safely");
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      Log.w(TAG, "interrupted while waiting capture thread exit");
    }
  }

  private boolean hasRecordPermission() {
    return ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
        == PackageManager.PERMISSION_GRANTED;
  }

  private void releaseAudioRecord() {
    if (audioRecord != null) {
      try {
        audioRecord.stop();
      } catch (Throwable ignored) {}
      audioRecord.release();
      audioRecord = null;
    }
  }

  private void releaseStreams() {
    if (kwsStream != null) {
      try { kwsStream.release(); } catch (Throwable ignored) {}
      kwsStream = null;
    }
    if (asrStream != null) {
      try { asrStream.release(); } catch (Throwable ignored) {}
      asrStream = null;
    }
  }

  private void captureLoop() {
    int minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
    if (minBuf <= 0) minBuf = SAMPLE_RATE * 2;
    audioRecord = new AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, minBuf * 2);
    if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
      releaseAudioRecord();
      notifyError("failed to init audio record");
      return;
    }
    try {
      audioRecord.startRecording();
    } catch (Throwable e) {
      // startRecording 与 stopListening 的 releaseAudioRecord 存在竞态：
      // 释放瞬间 startRecording 会抛 IllegalStateException，未捕获会崩掉采集线程
      // 并触发 RN 原生未捕获异常错误屏（Critical Error）。此处安全退出。
      Log.e(TAG, "failed to start recording", e);
      releaseAudioRecord();
      notifyError("failed to start recording: " + e.getClass().getSimpleName());
      return;
    }

    // 启动时若免唤醒开关已开启（capture 线程启动前 enableWakeWord 已为 false），
    // 必须直接进入 MODE_ASR_FREE。否则 mode 初始为 MODE_KWS，且 lastEnableWakeWord
    // 与 enableWakeWord 相等，下方运行时切换检测永不触发，免唤醒会静默失效
    //（表现为：语音助手开着直接说"播放XXX"无反应，仍需喊唤醒词）。
    if (!enableWakeWord) {
      mode = MODE_ASR_FREE;
      lastAsrText = "";
      asrStartTime = System.currentTimeMillis();
      lastTextChangeTime = asrStartTime;
      notifyState(STATE_RECOGNIZING);
      Log.i(TAG, "start in wake-word-free mode");
    }

    short[] buffer = new short[1600]; // 0.1s
    int currentSpotterVersion = spotterVersion;
    KeywordSpotter currentSpotter = spotter;
    boolean lastEnableWakeWord = enableWakeWord;

    while (running && listening && !Thread.currentThread().isInterrupted()) {
      try {
      int n;
      try {
        n = audioRecord.read(buffer, 0, buffer.length);
      } catch (Throwable e) {
        // 录音被释放/中断等场景，安全退出采集线程
        break;
      }
      if (n <= 0) continue;

      float[] samples = new float[n];
      for (int i = 0; i < n; i++) {
        samples[i] = buffer[i] / 32768f;
      }

      // 免唤醒开关运行时切换：统一在 capture 线程内释放/重建流，避免跨线程并发释放
      if (enableWakeWord != lastEnableWakeWord) {
        if (enableWakeWord) {
          mode = MODE_KWS;
          lastAsrText = "";
          releaseStreams();
          notifyState(STATE_LISTENING);
          Log.i(TAG, "switch to wake-word mode");
        } else {
          mode = MODE_ASR_FREE;
          lastAsrText = "";
          asrStartTime = System.currentTimeMillis();
          lastTextChangeTime = asrStartTime;
          // 释放 KWS 与 ASR 全部流：避免 MODE_ASR 遗留的 asrStream 被免唤醒分支复用，
          // 导致上一句命令的残余解码状态被当成新识别文本再次提交
          releaseStreams();
          notifyState(STATE_RECOGNIZING);
          Log.i(TAG, "switch to wake-word-free mode");
        }
        lastEnableWakeWord = enableWakeWord;
      }

      if (mode == MODE_KWS) {
        // 敏感度变化 -> 重建 spotter
        if (spotterVersion != currentSpotterVersion) {
          releaseKwsStream();
          try {
            currentSpotter = buildSpotter();
            spotter = currentSpotter;
            currentSpotterVersion = spotterVersion;
          } catch (Throwable e) {
            Log.e(TAG, "rebuild spotter failed", e);
            notifyError("rebuild spotter failed: " + e.getClass().getSimpleName() + ": "
                + (e.getMessage() == null ? "" : e.getMessage()));
            break;
          }
        }
        if (kwsStream == null) {
          // 防御：spotter 为 null（初始化未完成/失败/重建失败）时安全退出而非 NPE 崩溃
          if (currentSpotter == null) {
            String reason = (lastInitError != null && !lastInitError.isEmpty())
                ? lastInitError : "not initialized";
            notifyError("kws spotter not ready: " + reason);
            break;
          }
          // 必须传 token 串而非中文：C++ EncodeBase 会将整串中文视为单个 token，
          // 查不到即 OOV，createStream 返回 nullptr，随后 acceptWaveform 触发 NPE。
          kwsStream = currentSpotter.createStream(resolveWakeWordTokens(wakeWord));
          if (kwsStream == null) {
            notifyError("create kws stream failed: keyword tokens OOV?");
            break;
          }
        }
        kwsStream.acceptWaveform(samples, SAMPLE_RATE);
        while (currentSpotter.isReady(kwsStream)) {
          currentSpotter.decode(kwsStream);
        }
        String keyword = currentSpotter.getResult(kwsStream).getKeyword();
        if (!keyword.isEmpty()) {
          currentSpotter.reset(kwsStream);
          Log.i(TAG, "Wake up keyword: " + keyword);
          enterAsrMode();
        }
      } else if (mode == MODE_ASR) {
        if (asrStream == null) asrStream = recognizer.createStream("");
        asrStream.acceptWaveform(samples, SAMPLE_RATE);
        while (recognizer.isReady(asrStream)) {
          recognizer.decode(asrStream);
        }
        String text = recognizer.getResult(asrStream).getText();
        long elapsed = System.currentTimeMillis() - asrStartTime;
        if (!text.isEmpty()) {
          if (!text.equals(lastAsrText)) {
            lastAsrText = text;
            lastTextChangeTime = System.currentTimeMillis();
          }
        }
        boolean stable = !lastAsrText.isEmpty()
            && elapsed > MIN_ASR_TIME_MS
            && (System.currentTimeMillis() - lastTextChangeTime) > STABLE_TEXT_MS;
        if (stable || elapsed > RECOGNIZE_TIMEOUT_MS) {
          submitAsrResult(lastAsrText);
        }
      } else {
        // MODE_ASR_FREE：免唤醒持续识别（不依赖 KWS）。非命令文本由 JS 侧静默忽略
        if (asrStream == null) {
          asrStream = recognizer.createStream("");
          lastAsrText = "";
          asrStartTime = System.currentTimeMillis();
          lastTextChangeTime = asrStartTime;
        }
        asrStream.acceptWaveform(samples, SAMPLE_RATE);
        while (recognizer.isReady(asrStream)) {
          recognizer.decode(asrStream);
        }
        String text = recognizer.getResult(asrStream).getText();
        long elapsed = System.currentTimeMillis() - asrStartTime;
        if (!text.isEmpty()) {
          if (!text.equals(lastAsrText)) {
            lastAsrText = text;
            lastTextChangeTime = System.currentTimeMillis();
          }
        }
        boolean stable = !lastAsrText.isEmpty()
            && elapsed > MIN_ASR_TIME_MS
            && (System.currentTimeMillis() - lastTextChangeTime) > STABLE_TEXT_MS;
        if (stable) {
          submitFreeAsrResult(lastAsrText);
        }
      }
      } catch (Throwable e) {
        // 采集线程内任何 sherpa-onnx / AudioRecord 调用的未捕获异常
        //（典型：与 stopListening 的 releaseStreams/releaseAudioRecord 并发竞态，
        //  释放后调用已释放 native 对象抛 IllegalStateException，或字段已置 null 抛 NPE）。
        // 线程崩溃会触发 RN 原生未捕获异常错误屏（Critical Error），统一捕获后安全退出，
        // 并将状态复位为待机，保证后续 startListening 能重新拉起采集线程。
        Log.e(TAG, "capture loop exception, exit safely", e);
        running = false;
        listening = false;
        notifyState(STATE_IDLE);
        break;
      }
    }

    releaseAudioRecord();
    releaseStreams();
    Log.i(TAG, "capture loop ended");
  }

  private void enterAsrMode() {
    mode = MODE_ASR;
    lastAsrText = "";
    asrStartTime = System.currentTimeMillis();
    lastTextChangeTime = asrStartTime;
    notifyState(STATE_RECOGNIZING);
    if (listener != null) listener.onWakeUp();
  }

  private void submitAsrResult(String text) {
    String trimmed = text == null ? "" : text.trim();
    // 任务A排查日志：打印最终识别文本，便于真机 logcat 定位识别质量问题
    Log.i(TAG, "ASR result text: [" + trimmed + "]");
    if (listener != null) listener.onResult(trimmed);
    backToKws();
  }

  /** 免唤醒模式：提交识别文本后 reset 流继续识别下一句，不回到 KWS */
  private void submitFreeAsrResult(String text) {
    String trimmed = text == null ? "" : text.trim();
    Log.i(TAG, "ASR free result text: [" + trimmed + "]");
    if (listener != null) listener.onResult(trimmed);
    if (asrStream != null) {
      try {
        recognizer.reset(asrStream);
      } catch (Throwable ignored) {}
    }
    lastAsrText = "";
    asrStartTime = System.currentTimeMillis();
    lastTextChangeTime = asrStartTime;
  }

  private void backToKws() {
    if (asrStream != null) {
      try {
        recognizer.reset(asrStream);
        asrStream.release();
      } catch (Throwable ignored) {}
      asrStream = null;
    }
    lastAsrText = "";
    mode = MODE_KWS;
    notifyState(STATE_LISTENING);
  }

  private void releaseKwsStream() {
    if (kwsStream != null) {
      try { kwsStream.release(); } catch (Throwable ignored) {}
      kwsStream = null;
    }
  }

  private void notifyState(int state) {
    if (listener != null) listener.onState(state);
  }

  private void notifyError(String message) {
    Log.e(TAG, message);
    if (listener != null) listener.onError(message);
  }
}
