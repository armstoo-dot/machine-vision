# MACHINE VISION / AFL LAB

Armstrong Future Labs and Armstrong Studios. A browser instrument that reads a local video and draws a procedural field of points, signals, labels and tracking boxes.

## What it does

- Analyses contrast, edges, luminance and motion locally in the browser.
- Generates deterministic procedural overlays with points, connections, brackets, labels and tracking boxes.
- Supports local MP4, WebM and MOV uploads without sending frames to a server.
- Adapts framing with Auto, Fit and Fill. Auto keeps the full frame when a fill would crop it, and Fit exports at the source aspect.
- Exports at locked delivery sizes: 9:16 (1080×1920), 4:5 (1080×1350), 1:1 (1080×1080) and 16:9 (1920×1080). A mismatched source is letterboxed or pillarboxed on near-black.
- Draws a dark halo and a light core on every mark so labels stay readable on light skin and bright frames. The AFL preset still adds the heavier line and soft dark underlay.
- Biases points and lines toward motion. A Motion density control in Tune quiets the static background.
- Ships one-click presets: Editorial, Documentary, Tech Demo, AFL and AFL Dark. AFL Dark burns the Armstrong Future Labs lockup into the plate.
- Queues up to 10 clips, scrubs the timeline, and renders the queue in order from the playhead.
- Prefers brackets on a detected face, eyes or hands, and falls back to the usual field when nothing is found.
- Offers a clean plate and a start / mid / end opacity envelope.
- Exports the clip from the playhead through the end of the file. Pro encode writes H.264 at a chosen bitrate and can also save a silent master. If that path is unavailable, the browser recorder is used.

The repository intentionally ships without a bundled video. Bring any local clip to start; this keeps the project lightweight and avoids redistributing third-party footage.

## Run locally

Requirements: Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173/`.

### Windows one-click launcher

Double-click `START_MACHINE_VISION.cmd`. Use `STOP_MACHINE_VISION.cmd` when you are finished.

Do not open `index.html` directly. Vite needs to serve the application.

## Use your own video

1. Select **Upload video**, or drop up to 10 clips onto the stage.
2. Choose a local MP4, WebM or MOV file.
3. Pick an export size, scrub the timeline, and open **Tune** for the preset, motion density, subject lock and opacity envelope.
4. Select **Export clip** or **Export queue**. Export starts at the playhead and runs through the end of that clip. **Clean plate** hides the overlay.

The source video stays on your device. Uploaded files are represented by a temporary browser URL and are forgotten when the page is refreshed.

## Privacy

The lab has no upload endpoint, database, analytics SDK or application backend. Video frames and exports are processed in browser memory and are never sent to the host. The deployed build also blocks outbound application connections with a restrictive Content Security Policy. Fonts are bundled with the app.

Only the selected visual configuration and preset are saved in local browser storage. Hosting infrastructure may still receive ordinary request metadata when the page and its static assets are loaded; it never receives the selected video. See [PRIVACY.md](PRIVACY.md) for the complete data-flow summary.

## Export compatibility

Pro encode uses WebCodecs H.264 and muxes a silent MP4 in the browser at the selected bitrate. Exact sizes are 1080×1920, 1080×1350, 1080×1080 and 1920×1080. Auto and Fit still export the full picture at the source aspect with a 1920 px long edge. Fill crops to the stage. A silent master is a second file with no overlay; the burn-in file keeps the marks and, on AFL Dark, the lockup.

If H.264 is unavailable, export falls back to the browser's `MediaRecorder` and prefers MP4, then WebM. Each queued clip records from its playhead, or stored in-point, through the end of the file. A fresh recorder is created per clip.

Current Chrome, Edge and Safari are recommended. Very large source files may be limited by available device memory.

## Production build

```bash
pnpm build
pnpm preview
```

## Contributing

Issues and focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
