#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDL3_ROOT="${SDL3_ROOT:-$ROOT/web/deps/sdl3}"
ZLIB_ROOT="${ZLIB_ROOT:-$ROOT/web/deps/zlib}"
OUT="${OUT:-$ROOT/web/dist}"
OBJ="${OBJ_DIR:-$ROOT/web/obj}"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 4)}"
mkdir -p "$OUT" "$OBJ"

DEFS=(
  -DRELEASE=1
  -DCRS_APP_DRIVER_SDL=1
  -DCRS_VIDEO_DRIVER_SDL_GENERIC=1
  -DCRS_VIDEO_DRIVER_WEBGL=1
  -DCRS_INPUT_DRIVER_SDL=1
  -DSOUND_ENABLED=1
)
CFLAGS=(
  -O2 ${CFLAGS_EXTRA:-} -std=gnu11 -fno-strict-aliasing
  -Wno-pointer-to-int-cast -Wno-deprecated-non-prototype -Wno-tautological-overlap-compare
  -Wno-c2x-extensions -Wno-c23-extensions -Wno-incompatible-pointer-types -Wno-int-conversion
  -Wno-unused-variable -Wno-unused-function -Wno-unused-but-set-variable
  -I"$ROOT/src" -I"$ROOT/src/sdk" -I"$SDL3_ROOT/include" -I"$ZLIB_ROOT/include"
)

mapfile -t SRCS < <(cd "$ROOT" && find src -name '*.c' \
  -not -path 'src/imgui/*' \
  -not -path 'src/platform/netplay/*' \
  -not -path 'src/platform/video/opengl/*' \
  -not -path 'src/platform/video/sdl_gpu/*' \
  -not -path 'src/platform/video/psp/*' \
  -not -path 'src/platform/app/psp/*' \
  -not -path 'src/platform/input/statcheck/*' \
  -not -path 'src/test/*' | sort)

compile() {
  local src="$1"
  local obj="$OBJ/${src//\//_}.o"
  if [ ! -f "$obj" ] || [ "$ROOT/$src" -nt "$obj" ]; then
    emcc "${CFLAGS[@]}" "${DEFS[@]}" -c "$ROOT/$src" -o "$obj" || { echo "FAILED: $src"; return 1; }
  fi
  echo "$obj"
}
export -f compile
export ROOT OBJ
export CFLAGS_STR="${CFLAGS[*]}" DEFS_STR="${DEFS[*]}"

printf '%s\n' "${SRCS[@]}" | xargs -P "$JOBS" -I{} bash -c 'src="{}"; obj="$OBJ/${src//\//_}.o"; if [ ! -f "$obj" ] || [ "$ROOT/$src" -nt "$obj" ]; then emcc $CFLAGS_STR $DEFS_STR -c "$ROOT/$src" -o "$obj" 2>>"$OBJ/errors.log" || echo "FAILED: $src"; fi'

OBJS=()
for src in "${SRCS[@]}"; do OBJS+=("$OBJ/${src//\//_}.o"); done

emcc -O2 ${LINK_EXTRA:-} "${OBJS[@]}" ${EXTRA_OBJS:-} "$SDL3_ROOT/lib/libSDL3.a" "$ZLIB_ROOT/lib/libz.a" \
  -sMAX_WEBGL_VERSION=2 -sMIN_WEBGL_VERSION=2 \
  -sEMULATE_FUNCTION_POINTER_CASTS=1 \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=134217728 -sSTACK_SIZE=4194304 \
  -sFORCE_FILESYSTEM=1 -sEXIT_RUNTIME=0 -sINVOKE_RUN=0 \
  -sMODULARIZE=1 -sEXPORT_NAME=create3SX -sENVIRONMENT=web \
  -sEXPORTED_RUNTIME_METHODS=FS,IDBFS,callMain,addRunDependency,removeRunDependency -lidbfs.js \
  --preload-file "$ROOT/assets@/assets" \
  -o "$OUT/3sx.js"
cp "$ROOT"/web/shell/* "$OUT"/
echo "built $OUT/3sx.js"
