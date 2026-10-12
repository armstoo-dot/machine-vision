import { resolveOverlayOpacity } from '../vision/envelope';
import { renderOverlay } from '../vision/overlayRenderer';
import type { FrameOverlay, VisionConfig } from '../vision/types';
import { getVideoGeometry } from '../vision/videoGeometry';

export function imageFilter(mode: VisionConfig['imageMode']) {
  if (mode === 'mono') return 'grayscale(1) contrast(1.08)';
  if (mode === 'invert') return 'grayscale(1) invert(1) contrast(1.12) brightness(1.04)';
  if (mode === 'contrast') return 'saturate(.25) contrast(1.55) brightness(.92)';
  return 'none';
}

export function paintCompositeFrame(
  target: CanvasRenderingContext2D,
  overlayCanvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  config: VisionConfig,
  overlay: FrameOverlay | null,
  layerActive: boolean,
  silent: boolean,
  previewWidth: number,
  previewHeight: number,
) {
  const sourceWidth = video.videoWidth || 16;
  const sourceHeight = video.videoHeight || 9;
  const stageWidth = target.canvas.width;
  const stageHeight = target.canvas.height;
  const geometry = getVideoGeometry(sourceWidth, sourceHeight, stageWidth, stageHeight, config.framing);
  const preview = getVideoGeometry(sourceWidth, sourceHeight, Math.max(1, previewWidth), Math.max(1, previewHeight), config.framing);
  const sizeScale = Math.min(6, Math.max(0.5, geometry.scale / Math.max(0.001, preview.scale)));
  const showOverlay = layerActive && !silent;

  if (showOverlay) {
    renderOverlay(overlayCanvas, overlay, config, {
      sourceWidth,
      sourceHeight,
      stageWidth,
      stageHeight,
      transitionAlpha: 1,
      opacity: resolveOverlayOpacity(config, video.currentTime, video.duration || 0),
      pixelRatio: 1,
      sizeScale,
    });
  }

  target.save();
  target.fillStyle = '#080808';
  target.fillRect(0, 0, stageWidth, stageHeight);
  target.filter = imageFilter(config.imageMode);
  target.drawImage(
    video,
    geometry.offsetX,
    geometry.offsetY,
    geometry.sourceWidth * geometry.scale,
    geometry.sourceHeight * geometry.scale,
  );
  target.restore();
  if (showOverlay) target.drawImage(overlayCanvas, 0, 0);
}
