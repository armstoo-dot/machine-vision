import type { ExportAspect, FramingMode } from './types';

export interface VideoGeometry {
  scale: number;
  offsetX: number;
  offsetY: number;
  sourceWidth: number;
  sourceHeight: number;
  stageWidth: number;
  stageHeight: number;
}

export type ResolvedFraming = 'fit' | 'fill';

/** Auto uses fill only when the crop stays under this fraction of either edge. */
export const AUTO_FILL_CROP_LIMIT = 0.12;

export const EXPORT_LONG_EDGE = 1920;

export const EXPORT_ASPECTS = {
  '9:16': { width: 1080, height: 1920 },
  '4:5': { width: 1080, height: 1350 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
} as const;

export function aspectRatio(aspect: ExportAspect) {
  if (aspect === 'auto') return null;
  const frame = EXPORT_ASPECTS[aspect];
  return frame.width / frame.height;
}

/** Fit a locked aspect inside a stage. Auto uses the stage itself. */
export function fitAspectBox(boundsWidth: number, boundsHeight: number, aspect: ExportAspect) {
  const ratio = aspectRatio(aspect);
  const safeWidth = Math.max(1, boundsWidth);
  const safeHeight = Math.max(1, boundsHeight);
  if (!ratio) return { width: safeWidth, height: safeHeight };
  let width = safeWidth;
  let height = width / ratio;
  if (height > safeHeight) {
    height = safeHeight;
    width = height * ratio;
  }
  return { width, height };
}

export function fillCrop(
  sourceWidth: number,
  sourceHeight: number,
  stageWidth: number,
  stageHeight: number,
) {
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  const safeStageWidth = Math.max(1, stageWidth);
  const safeStageHeight = Math.max(1, stageHeight);
  const scale = Math.max(safeStageWidth / safeSourceWidth, safeStageHeight / safeSourceHeight);
  return {
    x: 1 - (safeStageWidth / scale) / safeSourceWidth,
    y: 1 - (safeStageHeight / scale) / safeSourceHeight,
  };
}

export function resolveFraming(
  sourceWidth: number,
  sourceHeight: number,
  stageWidth: number,
  stageHeight: number,
  framing: FramingMode,
): ResolvedFraming {
  if (framing !== 'auto') return framing;
  const crop = fillCrop(sourceWidth, sourceHeight, stageWidth, stageHeight);
  return Math.max(crop.x, crop.y) > AUTO_FILL_CROP_LIMIT ? 'fit' : 'fill';
}

export function getVideoGeometry(
  sourceWidth: number,
  sourceHeight: number,
  stageWidth: number,
  stageHeight: number,
  framing: FramingMode,
): VideoGeometry {
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  const safeStageWidth = Math.max(1, stageWidth);
  const safeStageHeight = Math.max(1, stageHeight);
  const resolved = resolveFraming(safeSourceWidth, safeSourceHeight, safeStageWidth, safeStageHeight, framing);
  const scale = resolved === 'fill'
    ? Math.max(safeStageWidth / safeSourceWidth, safeStageHeight / safeSourceHeight)
    : Math.min(safeStageWidth / safeSourceWidth, safeStageHeight / safeSourceHeight);
  return {
    scale,
    offsetX: (safeStageWidth - safeSourceWidth * scale) / 2,
    offsetY: (safeStageHeight - safeSourceHeight * scale) / 2,
    sourceWidth: safeSourceWidth,
    sourceHeight: safeSourceHeight,
    stageWidth: safeStageWidth,
    stageHeight: safeStageHeight,
  };
}

export function mapVideoPoint(x: number, y: number, geometry: VideoGeometry) {
  return {
    x: geometry.offsetX + x * geometry.sourceWidth * geometry.scale,
    y: geometry.offsetY + y * geometry.sourceHeight * geometry.scale,
  };
}

export function mapVideoLength(normalized: number, geometry: VideoGeometry) {
  return normalized * Math.min(geometry.sourceWidth, geometry.sourceHeight) * geometry.scale;
}

function even(value: number) {
  const rounded = Math.max(2, Math.round(value));
  return rounded - (rounded % 2);
}

/**
 * Locked aspects export at an exact delivery size and letterbox the source.
 * Auto/Fit keep the full picture at the source aspect. Fill exports the stage crop.
 */
export function exportFrameSize(
  sourceWidth: number,
  sourceHeight: number,
  stageWidth: number,
  stageHeight: number,
  framing: FramingMode,
  longEdge = EXPORT_LONG_EDGE,
  exportAspect: ExportAspect = 'auto',
) {
  if (exportAspect !== 'auto') return { ...EXPORT_ASPECTS[exportAspect] };
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  const safeStageWidth = Math.max(1, stageWidth);
  const safeStageHeight = Math.max(1, stageHeight);
  const resolved = resolveFraming(safeSourceWidth, safeSourceHeight, safeStageWidth, safeStageHeight, framing);
  const aspect = resolved === 'fit'
    ? safeSourceWidth / safeSourceHeight
    : safeStageWidth / safeStageHeight;
  if (aspect >= 1) return { width: even(longEdge), height: even(longEdge / aspect) };
  return { width: even(longEdge * aspect), height: even(longEdge) };
}
