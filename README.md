# 3SX Web

A WebAssembly build of [3SX](https://github.com/crowded-street/3sx), the native port of
*Street Fighter III: 3rd Strike*. It runs in the browser and needs `SF33RD.AFS` from your own
PS2 copy of the game. No game data is included.

## Play

- **Windows:** double-click `play.bat` (needs Python). It serves this folder at
  http://localhost:8030 and opens it.
- The first time, pick or drag in `SF33RD.AFS`. It gets checksum-verified and stored in the
  browser, so after that you just hit FIGHT.
- If a copy of `SF33RD.AFS` sits in this folder, the page uses it automatically. Don't do that
  on a public host, since that would be serving Capcom's data.
- It must be served over `http://localhost` or `https://`. Plain file:// won't work, and the
  checksum step needs a secure context.

Controls: arrows/WASD move, U I J K / O P L ; attacks, Enter start, Backspace back,
F11 or Alt+Enter fullscreen. Gamepads work through the browser's Gamepad API. Settings and
saves persist in the browser (IndexedDB).

Tested: boots, intro, title, mode menu, arcade fights, audio (headless Chromium, WebGL2 via
SwiftShader). A desktop Chrome/Edge/Firefox with WebGL2 is required. Needs roughly 1 GB of RAM,
because the 642 MB AFS is held in memory, so phones will likely struggle.

## Hosting (itch.io etc.)

Upload `index.html`, `loader.js`, `shell.css`, `3sx.js`, `3sx.wasm`, `3sx.data` (never the
AFS). 3SX is GPLv3: if you publish this build, also publish the source, meaning `source/` plus
the upstream commit in `source/UPSTREAM_COMMIT.txt`.

## What was changed from upstream 3SX (`source/3sx-web.patch`)

- **WebGL2 renderer** (`src/platform/video/webgl/`): a port of the OpenGL 3.3 backend. 1D
  palette textures become 2D, BGRA and RGB5A1 data are converted to RGBA8 on upload,
  shaders are GLSL ES 3.00 embedded in the source, and depth uses a renderbuffer.
- **Frame pacing:** the browser drives frames with requestAnimationFrame. The game still runs
  at its 59.6 fps target, so high-refresh monitors don't speed it up.
- **Resources:** the AFS is read from an in-memory file (`/afs/SF33RD.AFS`) provided by the
  page. The ISO extraction wizard (libcdio) is compiled out.
- **Bug fix, worth sending upstream:** `SPU_SDL_CB` overflowed its 4096-sample `outbuf`
  whenever the audio device requested more than 2048 frames at once. Desktop drivers never ask
  for that much, but browsers do. The overflow wiped out the sound timer callback and crashed
  the game. Found with AddressSanitizer.
- **Fixed six K&R prototype mismatches** (e.g. `pp_pulpara_remake_at*`, `setSeVolume`,
  `effect_A2_init`), where callers pass an argument the definition doesn't declare. Native
  builds tolerate this; wasm traps. Indirect calls through the decomp's jump tables use
  `-sEMULATE_FUNCTION_POINTER_CASTS` for the same reason.
- Netplay, the arcade-ROM balance option, the in-game checksum, and ImGui are left out of
  the web build. The page does the SHA-256 check with WebCrypto instead.

## Rebuilding

Needs Emscripten 4.0.x (built here with 4.0.23 + LLVM 22.1.8 + binaryen 124), SDL3
`release-3.4.12` built with emcmake, and zlib built with emcc.

```
git clone https://github.com/crowded-street/3sx && cd 3sx
git checkout $(cat ../source/UPSTREAM_COMMIT.txt)
git apply ../source/3sx-web.patch
SDL3_ROOT=/path/to/sdl3-wasm ZLIB_ROOT=/path/to/zlib-wasm ./web/build.sh
```

Output goes to `web/dist/`.
