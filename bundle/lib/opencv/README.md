# OpenCV.js (vendored)

This feature uses OpenCV.js (WASM) for offline wall detection.

## Why this folder exists
The build pipeline treats `./lib/*` as external (see `build.js`), so large third‑party libraries can live here without being bundled.

## Files expected
Place the following files here:

- `opencv.js`

This project expects the **single-file** OpenCV.js build (WASM embedded).

### Where to download (prebuilt)

OpenCV publishes a prebuilt `opencv.js` in its online documentation:

- Latest 4.x build: https://docs.opencv.org/4.x/opencv.js
- Versioned build (example): https://docs.opencv.org/4.12.0/opencv.js

You can also get `opencv.js` from the GitHub release docs archive:

- https://github.com/opencv/opencv/releases (download `opencv-{VERSION}-docs.zip`, then extract `opencv.js`)

Note: the docs-hosted `opencv.js` is typically a **single-file build** with the WASM embedded (no separate `opencv.wasm`). If you use that build, you only need to vendor `opencv.js`.

## Notes
- The wall detection loader will try to load:
  - `modules/boobastudio/lib/opencv/opencv.js`
- No network/CDN is used; this is intended to work offline.
