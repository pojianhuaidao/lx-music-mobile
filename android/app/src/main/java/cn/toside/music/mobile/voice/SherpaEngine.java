package cn.toside.music.mobile.voice;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Log;

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

  private volatile String wakeWord = "你好小马";
  private volatile float sensitivity = 0.7f;
  // 敏感度 -> keywordsScore：sensitivity 越大越灵敏（阈值越低）
  private volatile int spotterVersion = 0;

  private long asrStartTime = 0;
  private long lastTextChangeTime = 0;
  private String lastAsrText = "";
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

  private float keywordsScore() {
    return 1.5f - sensitivity;
  }

  /** 加载 ASR 与 KWS 模型，失败返回 false。线程安全：调用方负责在后台线程执行。 */
  public synchronized boolean init() {
    try {
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
      return false;
    }
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
    kwsModelConfig.setModelType("zipformer");
    KeywordSpotterConfig kwsConfig = new KeywordSpotterConfig();
    kwsConfig.setFeatConfig(featConfig);
    kwsConfig.setModelConfig(kwsModelConfig);
    kwsConfig.setKeywordsFile(KWS_KEYWORDS_FILE);
    kwsConfig.setKeywordsScore(keywordsScore());
    return new KeywordSpotter(context.getAssets(), kwsConfig);
  }

  public synchronized void startListening() {
    if (!hasRecordPermission()) {
      notifyError("no record audio permission");
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
    if (captureThread != null) {
      captureThread.interrupt();
      captureThread = null;
    }
    releaseAudioRecord();
    releaseStreams();
    mode = MODE_KWS;
    running = false;
    notifyState(STATE_IDLE);
  }

  public synchronized void destroy() {
    listening = false;
    running = false;
    if (captureThread != null) {
      captureThread.interrupt();
      captureThread = null;
    }
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
    audioRecord.startRecording();

    short[] buffer = new short[1600]; // 0.1s
    int currentSpotterVersion = spotterVersion;
    KeywordSpotter currentSpotter = spotter;

    while (running && listening && !Thread.currentThread().isInterrupted()) {
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
            notifyError("rebuild spotter failed");
            break;
          }
        }
        if (kwsStream == null) {
          kwsStream = currentSpotter.createStream(wakeWord);
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
      } else {
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
    if (listener != null) listener.onResult(text == null ? "" : text.trim());
    backToKws();
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
