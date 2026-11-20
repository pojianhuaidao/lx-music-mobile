#!/usr/bin/env bash
#
# 编译 audio-only 裁剪版 FFmpeg 静态库（供 android/app/src/main/cpp/CMakeLists.txt 使用）
#
# 裁剪原则：
#   - 只保留 libavformat / libavcodec / libswresample / libavutil
#   - 关闭 video / 编码器 / muxer / filter / 设备 / 网络 / 硬件加速
#   - 只开启本地音乐播放所需的 demuxer + decoder + parser + file 协议
#   - 产物不纳入 git（见 .gitignore），由 CI 或本地按需生成
#
# 用法：
#   bash android/app/src/main/cpp/scripts/build_ffmpeg_android.sh
#   FFMPEG_ABIS=armeabi-v7a,arm64-v8a,x86,x86_64 bash ...
#   FFMPEG_VERSION=6.0.1 ANDROID_API=21 bash ...
#
# 环境变量：
#   FFMPEG_VERSION  默认 6.0.1
#   ANDROID_API     默认 21（与 app minSdk 保持一致）
#   FFMPEG_ABIS     逗号分隔，默认 arm64-v8a
#   ANDROID_NDK_HOME / ANDROID_NDK_ROOT / ANDROID_HOME  用于定位 NDK（26.1.10909125）
#   JOBS            并行编译数，默认 CPU 核数
#
# 产物：android/app/src/main/cpp/ffmpeg/android-libs/<abi>/{lib,include}
# 已存在 libavformat.a 的 ABI 会跳过（配合 CI cache 可复用）。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CPP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FFMPEG_ROOT="${CPP_DIR}/ffmpeg"
DL_DIR="${FFMPEG_ROOT}/dl"
BUILD_DIR="${FFMPEG_ROOT}/build"
LIBS_DIR="${FFMPEG_ROOT}/android-libs"

FFMPEG_VERSION="${FFMPEG_VERSION:-6.0.1}"
ANDROID_API="${ANDROID_API:-21}"
FFMPEG_ABIS="${FFMPEG_ABIS:-arm64-v8a}"
JOBS="${JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)}"
NDK_VERSION="${NDK_VERSION:-26.1.10909125}"

# ---------------------------------------------------------------------------
# 定位 NDK
# ---------------------------------------------------------------------------
resolve_ndk() {
  if [ -n "${ANDROID_NDK_HOME:-}" ] && [ -d "${ANDROID_NDK_HOME}" ]; then
    echo "${ANDROID_NDK_HOME}"; return 0
  fi
  if [ -n "${ANDROID_NDK_ROOT:-}" ] && [ -d "${ANDROID_NDK_ROOT}" ]; then
    echo "${ANDROID_NDK_ROOT}"; return 0
  fi
  if [ -n "${ANDROID_HOME:-}" ]; then
    if [ -d "${ANDROID_HOME}/ndk/${NDK_VERSION}" ]; then
      echo "${ANDROID_HOME}/ndk/${NDK_VERSION}"; return 0
    fi
    if [ -d "${ANDROID_SDK_ROOT:-}/ndk/${NDK_VERSION}" ]; then
      echo "${ANDROID_SDK_ROOT}/ndk/${NDK_VERSION}"; return 0
    fi
    local candidate
    candidate="$(ls -d "${ANDROID_HOME}"/ndk/* 2>/dev/null | sort -V | tail -n 1 || true)"
    if [ -n "${candidate}" ]; then
      echo "${candidate}"; return 0
    fi
  fi
  return 1
}

NDK="$(resolve_ndk || true)"
if [ -z "${NDK}" ]; then
  echo "[ffmpeg] 未找到 Android NDK，请设置 ANDROID_NDK_HOME 或安装 ndk;${NDK_VERSION}" >&2
  exit 1
fi
if [ ! -d "${NDK}/toolchains/llvm/prebuilt" ]; then
  echo "[ffmpeg] NDK 目录结构异常：${NDK}" >&2
  exit 1
fi
HOST_TAG="$(ls "${NDK}/toolchains/llvm/prebuilt" | head -n 1)"
TOOLCHAIN="${NDK}/toolchains/llvm/prebuilt/${HOST_TAG}"
if [ ! -d "${TOOLCHAIN}/bin" ]; then
  echo "[ffmpeg] 找不到 clang 工具链：${TOOLCHAIN}/bin" >&2
  exit 1
fi
echo "[ffmpeg] NDK=${NDK}"
echo "[ffmpeg] version=${FFMPEG_VERSION} api=${ANDROID_API} abis=${FFMPEG_ABIS}"

mkdir -p "${DL_DIR}" "${BUILD_DIR}" "${LIBS_DIR}"

# ---------------------------------------------------------------------------
# 下载并解压源码（缓存到 ffmpeg/dl）
# ---------------------------------------------------------------------------
SRC_ARCHIVE="${DL_DIR}/ffmpeg-${FFMPEG_VERSION}.tar.xz"
SRC_DIR="${BUILD_DIR}/ffmpeg-${FFMPEG_VERSION}"

if [ ! -f "${SRC_ARCHIVE}" ]; then
  echo "[ffmpeg] 下载 ffmpeg-${FFMPEG_VERSION}.tar.xz ..."
  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 3 -o "${SRC_ARCHIVE}" "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz"
  else
    wget -O "${SRC_ARCHIVE}" "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz"
  fi
fi

if [ ! -d "${SRC_DIR}" ]; then
  echo "[ffmpeg] 解压源码 ..."
  tar -xf "${SRC_ARCHIVE}" -C "${BUILD_DIR}"
fi

# ---------------------------------------------------------------------------
# 裁剪组件清单（本地音乐播放所需：ape/wma/dsf/dff/tak/tta + 常见无损/有损格式）
# ---------------------------------------------------------------------------
DEMUXERS="aac,ac3,aiff,ape,asf,caf,dsf,dts,flac,iff,matroska,mov,mp3,mpc,mpc8,ogg,tak,tta,w64,wav,wv"
DECODERS="aac,ac3,alac,ape,dca,dsd_lsbf,dsd_lsbf_planar,dsd_msbf,dsd_msbf_planar,eac3,flac,mlp,mp1,mp2,mp3,mp3float,mpc7,mpc8,opus,pcm_alaw,pcm_f32be,pcm_f32le,pcm_mulaw,pcm_s16be,pcm_s16le,pcm_s24be,pcm_s24le,pcm_s32be,pcm_s32le,pcm_u8,tak,truehd,tta,vorbis,wavpack,wmalossless,wmapro,wmav1,wmav2,wmavoice"
PARSERS="aac,aac_latm,ac3,dca,flac,mpegaudio,opus,vorbis"
PROTOCOLS="file,pipe,data"

build_abi() {
  local abi="$1"
  local arch cpu triple extra_cflags extra_configure

  case "${abi}" in
    arm64-v8a)
      arch="aarch64"; cpu="armv8-a"; triple="aarch64-linux-android"
      extra_configure="--enable-neon"
      ;;
    armeabi-v7a)
      arch="arm"; cpu="armv7-a"; triple="armv7a-linux-androideabi"
      extra_configure="--enable-neon --enable-thumb"
      ;;
    x86)
      arch="x86"; cpu="i686"; triple="i686-linux-android"
      extra_configure="--disable-x86asm"
      ;;
    x86_64)
      arch="x86_64"; cpu="x86-64"; triple="x86_64-linux-android"
      extra_configure="--disable-x86asm"
      ;;
    *)
      echo "[ffmpeg] 不支持的 ABI: ${abi}" >&2
      return 1
      ;;
  esac

  local prefix="${LIBS_DIR}/${abi}"
  if [ -f "${prefix}/lib/libavformat.a" ]; then
    echo "[ffmpeg] ${abi} 已存在产物，跳过（如需重编请删除 ${prefix}）"
    return 0
  fi

  # FFmpeg 不支持 out-of-tree 构建（configure 必须在源码目录内运行），
  # 因此为每个 ABI 复制一份独立源码树：互不干扰，且中断后可原地续跑。
  local abi_src="${BUILD_DIR}/src-${abi}-api${ANDROID_API}"
  if [ ! -d "${abi_src}" ]; then
    echo "[ffmpeg] 准备 ${abi} 独立源码树：${abi_src}"
    cp -a "${SRC_DIR}" "${abi_src}"
  fi
  mkdir -p "${prefix}"
  pushd "${abi_src}" >/dev/null

  local cc="${TOOLCHAIN}/bin/${triple}${ANDROID_API}-clang"
  local cxx="${TOOLCHAIN}/bin/${triple}${ANDROID_API}-clang++"
  if [ ! -x "${cc}" ]; then
    echo "[ffmpeg] 找不到编译器：${cc}" >&2
    popd >/dev/null
    return 1
  fi

  echo "[ffmpeg] 开始编译 ${abi}（api=${ANDROID_API}, prefix=${prefix}）"
  ./configure \
    --prefix="${prefix}" \
    --target-os=android \
    --arch="${arch}" \
    --cpu="${cpu}" \
    --enable-cross-compile \
    --sysroot="${TOOLCHAIN}/sysroot" \
    --cc="${cc}" \
    --cxx="${cxx}" \
    --ar="${TOOLCHAIN}/bin/llvm-ar" \
    --ranlib="${TOOLCHAIN}/bin/llvm-ranlib" \
    --strip="${TOOLCHAIN}/bin/llvm-strip" \
    --nm="${TOOLCHAIN}/bin/llvm-nm" \
    --enable-static \
    --disable-shared \
    --enable-pic \
    --enable-small \
    --disable-autodetect \
    --disable-symver \
    --disable-programs \
    --disable-doc \
    --disable-debug \
    --disable-network \
    --disable-avdevice \
    --disable-avfilter \
    --disable-swscale \
    --disable-postproc \
    --disable-mediacodec \
    --disable-zlib \
    --disable-bzlib \
    --disable-lzma \
    --disable-iconv \
    --disable-sdl2 \
    --disable-everything \
    --enable-swresample \
    --enable-protocol=${PROTOCOLS} \
    --enable-demuxer=${DEMUXERS} \
    --enable-decoder=${DECODERS} \
    --enable-parser=${PARSERS} \
    --extra-cflags="-O2 -fPIC -fvisibility=hidden ${extra_cflags:-}" \
    ${extra_configure}

  make -j"${JOBS}"
  make install

  popd >/dev/null
  echo "[ffmpeg] ${abi} 完成："
  ls -lh "${prefix}/lib"/*.a
}

IFS=',' read -r -a ABI_LIST <<< "${FFMPEG_ABIS}"
for abi in "${ABI_LIST[@]}"; do
  abi="$(echo "${abi}" | tr -d '[:space:]')"
  [ -z "${abi}" ] && continue
  build_abi "${abi}"
done

echo "[ffmpeg] 全部完成。产物目录：${LIBS_DIR}"
