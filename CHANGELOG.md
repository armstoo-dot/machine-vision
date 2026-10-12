# Changelog

## Unreleased

- Armstrong Future Labs / Armstrong Studios interface for the lab.
- AFL preset with heavier marks and a soft dark underlay.
- Auto framing keeps the full picture when a fill would crop it. Fit exports use the source aspect.
- Locked export sizes: 9:16, 4:5, 1:1 and 16:9, with near-black bars when the source aspect differs.
- Adaptive stroke on every preset: dark halo and light core, plus the AFL underlay.
- Motion density, so marks gather on movement and thin out on a static plate.
- Preset pack: Editorial, Documentary, Tech Demo, AFL and AFL Dark. AFL Dark burns in the lab lockup.
- Batch queue for up to 10 clips, timeline scrub, and sequential export from the playhead.
- Face, eye and hand lock, with the previous field placement when detection finds nothing.
- Clean plate and a start / mid / end opacity envelope.
- Pro H.264 export with bitrate control, a silent master, and a fast recorder fallback. Playback pauses when the encoder falls behind so the file keeps the full window.
- Export runs from the playhead through the end of the clip, instead of stopping at five seconds.

## 0.1.0 — 2026-08-28

- Initial open-source release.
- Local video upload and browser-based frame analysis.
- Procedural points, connections, labels, brackets and persistent tracking boxes.
- Auto, Fit and Fill framing modes.
- Custom overlay colour and image treatments.
- Full technical randomisation with deterministic seeds.
- Five-second composite clip export.
