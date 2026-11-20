# FFmpeg 音频桥接模块（方案A）
#
# 依赖：由 scripts/build_ffmpeg_android.sh（CI 或本地手动执行）产出的 audio-only 裁剪静态库，
# 目录结构约定：
#   ${FFMPEG_LIBS_DIR}/<abi>/lib/libavformat.a
#   ${FFMPEG_LIBS_DIR}/<abi>/lib/libavcodec.a
#   ${FFMPEG_LIBS_DIR}/<abi>/lib/libswresample.a
#   ${FFMPEG_LIBS_DIR}/<abi>/lib/libavutil.a
#   ${FFMPEG_LIBS_DIR}/<abi>/include/...
#
# 可通过 -DFFMPEG_LIBS_DIR=/abs/path 覆盖默认位置。

cmake_minimum_required(VERSION 3.18)
project(ffmpeg_bridge CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT DEFINED FFMPEG_LIBS_DIR OR FFMPEG_LIBS_DIR STREQUAL "")
  set(FFMPEG_LIBS_DIR "${CMAKE_CURRENT_SOURCE_DIR}/ffmpeg/android-libs")
endif()

set(FFMPEG_ABI_DIR "${FFMPEG_LIBS_DIR}/${ANDROID_ABI}")
message(STATUS "ffmpeg_bridge: ABI=${ANDROID_ABI}, FFMPEG_LIBS_DIR=${FFMPEG_LIBS_DIR}")

if(NOT EXISTS "${FFMPEG_ABI_DIR}/lib/libavformat.a")
  message(FATAL_ERROR
    "未找到 ABI=${ANDROID_ABI} 的 FFmpeg 裁剪静态库：${FFMPEG_ABI_DIR}/lib/libavformat.a\n"
    "请先执行：bash android/app/src/main/cpp/scripts/build_ffmpeg_android.sh（FFMPEG_ABIS=${ANDROID_ABI}）\n"
    "或使用 -PffmpegUsePrebuiltSo=true 直接接入预编 libffmpeg_bridge.so（放在 src/main/jniLibs/<abi>/ 下）。")
endif()

foreach(ff_lib avformat avcodec swresample avutil)
  add_library(ffmpeg_${ff_lib} STATIC IMPORTED)
  set_target_properties(ffmpeg_${ff_lib} PROPERTIES
    IMPORTED_LOCATION "${FFMPEG_ABI_DIR}/lib/lib${ff_lib}.a")
endforeach()

add_library(ffmpeg_bridge SHARED
  ffmpeg_bridge.cpp
  ffmpeg_decoder.cpp)

target_include_directories(ffmpeg_bridge PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}"
  "${FFMPEG_ABI_DIR}/include")

target_compile_options(ffmpeg_bridge PRIVATE -O2 -fexceptions -frtti -Wall -Wextra -Wno-unused-parameter)

# FFmpeg 静态库互相存在循环依赖，使用 --start-group/--end-group 保证符号解析完整。
target_link_libraries(ffmpeg_bridge
  -Wl,--start-group
  ffmpeg_avformat
  ffmpeg_avcodec
  ffmpeg_swresample
  ffmpeg_avutil
  -Wl,--end-group
  android
  log
  z
  m)
