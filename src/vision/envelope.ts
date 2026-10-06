import type { VisionConfig } from './types';

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Overlay opacity at a point in the clip. The envelope is start → mid → end. */
export function resolveOverlayOpacity(config: VisionConfig, time: number, duration: number) {
  const base = Math.max(0, Math.min(1, config.overlayOpacity / 100));
  if (!config.envelopeEnabled) return base;
  const span = duration > 0.05 ? duration : 5;
  const t = Math.max(0, Math.min(1, time / span));
  const start = config.opacityStart / 100;
  const mid = config.opacityMid / 100;
  const end = config.opacityEnd / 100;
  const shaped = t <= 0.5 ? lerp(start, mid, t / 0.5) : lerp(mid, end, (t - 0.5) / 0.5);
  return Math.max(0, Math.min(1, base * shaped));
}
