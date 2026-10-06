import { DEBUG_VISION } from './config';
import { drawAflLockup } from './lockup';
import { getVideoGeometry, mapVideoLength, mapVideoPoint } from './videoGeometry';
import type { FrameOverlay, VisionConfig } from './types';

interface RenderOptions {
  sourceWidth: number;
  sourceHeight: number;
  stageWidth: number;
  stageHeight: number;
  transitionAlpha: number;
  /** Resolved 0–1 opacity, including the envelope. Falls back to the config slider. */
  opacity?: number;
  pixelRatio?: number;
  sizeScale?: number;
}

const LABEL_FONT = '"IBM Plex Mono", ui-monospace, monospace';

function inStage(x: number, y: number, width: number, height: number) {
  return x > -30 && y > -30 && x < width + 30 && y < height + 30;
}

function lineAlpha(config: VisionConfig, alpha: number) {
  return config.underlay ? Math.max(alpha, 0.82) : alpha;
}

function strokeGlyph(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  lineWidth: number,
  alpha: number,
) {
  context.lineWidth = lineWidth;
  context.strokeStyle = color;
  context.lineJoin = 'round';
  context.globalAlpha = alpha;
  context.strokeText(text, x, y);
}

function fillPlate(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  if (typeof context.roundRect === 'function') context.roundRect(x, y, width, height, radius);
  else context.rect(x, y, width, height);
  context.fill();
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  config: VisionConfig,
  masterAlpha: number,
  sizeScale: number,
) {
  const fontSize = config.labelSize * sizeScale;
  context.font = `500 ${fontSize}px ${LABEL_FONT}`;
  context.textAlign = align;
  context.textBaseline = 'middle';
  if (config.underlay) {
    const width = context.measureText(text).width;
    const padX = 5 * sizeScale;
    const padY = 3.5 * sizeScale;
    const left = align === 'right' ? x - width - padX : align === 'center' ? x - width / 2 - padX : x - padX;
    context.globalAlpha = masterAlpha * 0.82;
    context.fillStyle = 'rgba(8,8,8,0.9)';
    fillPlate(context, left, y - fontSize / 2 - padY, width + padX * 2, fontSize + padY * 2, 2 * sizeScale);
  }
  const halo = (config.contrastAssist ? 3.6 : 2.6) * sizeScale;
  strokeGlyph(context, text, x, y, '#080808', halo, masterAlpha * 0.96);
  strokeGlyph(context, text, x, y, '#f7f8f3', Math.max(1.2, halo * 0.38) * (config.underlay ? 0.7 : 1), masterAlpha * 0.9);
  context.globalAlpha = masterAlpha * 0.98;
  context.fillStyle = config.overlayColor;
  context.fillText(text, x, y);
}

export function renderOverlay(
  canvas: HTMLCanvasElement,
  overlay: FrameOverlay | null,
  config: VisionConfig,
  options: RenderOptions,
) {
  const dpr = options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2);
  const sizeScale = options.sizeScale ?? 1;
  const pixelWidth = Math.max(1, Math.round(options.stageWidth * dpr));
  const pixelHeight = Math.max(1, Math.round(options.stageHeight * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, options.stageWidth, options.stageHeight);
  if (!overlay) return;

  const geometry = getVideoGeometry(
    options.sourceWidth, options.sourceHeight, options.stageWidth, options.stageHeight, config.framing,
  );
  const masterAlpha = (options.opacity ?? config.overlayOpacity / 100) * options.transitionAlpha;
  context.lineCap = 'square';
  context.lineJoin = 'miter';
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;

  const drawGeometry = (color: string, lineWidth: number, alphaMultiplier: number) => {
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = lineWidth * sizeScale;
    context.globalAlpha = masterAlpha * alphaMultiplier;

    for (const line of overlay.lines) {
      const a = mapVideoPoint(line.ax, line.ay, geometry);
      const b = mapVideoPoint(line.bx, line.by, geometry);
      if (!inStage(a.x, a.y, options.stageWidth, options.stageHeight) && !inStage(b.x, b.y, options.stageWidth, options.stageHeight)) continue;
      context.globalAlpha = masterAlpha * alphaMultiplier * lineAlpha(config, line.alpha);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }

    context.globalAlpha = masterAlpha * alphaMultiplier;
    for (const anchor of overlay.anchors) {
      const point = mapVideoPoint(anchor.x, anchor.y, geometry);
      if (!inStage(point.x, point.y, options.stageWidth, options.stageHeight)) continue;
      const size = Math.max(1, anchor.size * sizeScale);
      context.save();
      context.translate(point.x, point.y);
      if (anchor.kind === 'point') {
        context.beginPath();
        context.arc(0, 0, size * 0.72, 0, Math.PI * 2);
        context.fill();
      } else if (anchor.kind === 'cross') {
        context.beginPath();
        context.moveTo(-size * 1.8, 0); context.lineTo(size * 1.8, 0);
        context.moveTo(0, -size * 1.8); context.lineTo(0, size * 1.8);
        context.stroke();
      } else {
        context.strokeRect(-size, -size, size * 2, size * 2);
      }
      context.restore();
    }

    for (const bracket of overlay.brackets) {
      const point = mapVideoPoint(bracket.x, bracket.y, geometry);
      if (!inStage(point.x, point.y, options.stageWidth, options.stageHeight)) continue;
      const size = mapVideoLength(bracket.size, geometry);
      context.save();
      context.translate(point.x, point.y);
      context.beginPath();
      context.moveTo(-size, -size * 0.3); context.lineTo(-size, -size); context.lineTo(-size * 0.3, -size);
      context.moveTo(size * 0.3, size); context.lineTo(size, size); context.lineTo(size, size * 0.3);
      context.stroke();
      context.restore();
    }

    const boxAlpha = config.boxStrength / 100;
    for (const box of overlay.boxes) {
      const topLeft = mapVideoPoint(box.x, box.y, geometry);
      const bottomRight = mapVideoPoint(box.x + box.width, box.y + box.height, geometry);
      const width = bottomRight.x - topLeft.x;
      const height = bottomRight.y - topLeft.y;
      if (width <= 0 || height <= 0) continue;
      const corner = Math.min(18 * sizeScale, width * 0.24, height * 0.24);
      const lead = 8 * sizeScale;
      context.globalAlpha = masterAlpha * alphaMultiplier * boxAlpha;
      context.beginPath();
      context.moveTo(topLeft.x, topLeft.y + corner); context.lineTo(topLeft.x, topLeft.y); context.lineTo(topLeft.x + corner, topLeft.y);
      context.moveTo(topLeft.x + width - corner, topLeft.y); context.lineTo(topLeft.x + width, topLeft.y); context.lineTo(topLeft.x + width, topLeft.y + corner);
      context.moveTo(topLeft.x + width, topLeft.y + height - corner); context.lineTo(topLeft.x + width, topLeft.y + height); context.lineTo(topLeft.x + width - corner, topLeft.y + height);
      context.moveTo(topLeft.x + corner, topLeft.y + height); context.lineTo(topLeft.x, topLeft.y + height); context.lineTo(topLeft.x, topLeft.y + height - corner);
      context.stroke();
      context.beginPath();
      context.moveTo(topLeft.x + width, topLeft.y + lead);
      context.lineTo(topLeft.x + width + 13 * sizeScale, topLeft.y + lead);
      context.stroke();
    }

    for (const subject of overlay.subjects) {
      const topLeft = mapVideoPoint(subject.x, subject.y, geometry);
      const bottomRight = mapVideoPoint(subject.x + subject.width, subject.y + subject.height, geometry);
      const width = bottomRight.x - topLeft.x;
      const height = bottomRight.y - topLeft.y;
      if (width <= 2 || height <= 2) continue;
      const corner = Math.min(subject.kind === 'eye' ? 8 * sizeScale : 16 * sizeScale, width * 0.28, height * 0.28);
      context.globalAlpha = masterAlpha * alphaMultiplier * (subject.kind === 'face' ? 1 : 0.9);
      context.beginPath();
      context.moveTo(topLeft.x, topLeft.y + corner); context.lineTo(topLeft.x, topLeft.y); context.lineTo(topLeft.x + corner, topLeft.y);
      context.moveTo(topLeft.x + width - corner, topLeft.y); context.lineTo(topLeft.x + width, topLeft.y); context.lineTo(topLeft.x + width, topLeft.y + corner);
      context.moveTo(topLeft.x + width, topLeft.y + height - corner); context.lineTo(topLeft.x + width, topLeft.y + height); context.lineTo(topLeft.x + width - corner, topLeft.y + height);
      context.moveTo(topLeft.x + corner, topLeft.y + height); context.lineTo(topLeft.x, topLeft.y + height); context.lineTo(topLeft.x, topLeft.y + height - corner);
      context.stroke();
    }
  };

  const haloBoost = config.contrastAssist ? 1 : 0.72;
  if (config.underlay) {
    context.shadowColor = 'rgba(0,0,0,0.72)';
    context.shadowBlur = 6 * sizeScale;
    drawGeometry('#080808', config.lineWeight + 3.4 * haloBoost, 0.94);
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
  }
  drawGeometry('#080808', config.lineWeight + 3.1 * haloBoost, 0.92);
  drawGeometry('#f7f8f3', config.lineWeight + 1.15 * haloBoost, 0.88);
  drawGeometry(config.overlayColor, config.lineWeight, 1);

  for (const label of overlay.labels) {
    const point = mapVideoPoint(label.x, label.y, geometry);
    if (!inStage(point.x, point.y, options.stageWidth, options.stageHeight)) continue;
    drawLabel(context, label.text, point.x, point.y, label.align, config, masterAlpha, sizeScale);
  }

  for (const subject of overlay.subjects) {
    const point = mapVideoPoint(subject.x, subject.y, geometry);
    drawLabel(
      context,
      subject.label,
      point.x + 4 * sizeScale,
      point.y - 8 * sizeScale,
      'left',
      { ...config, labelSize: Math.max(8, config.labelSize - (subject.kind === 'eye' ? 2 : 0)) },
      masterAlpha * Math.max(0.82, subject.score),
      sizeScale,
    );
  }

  for (const box of overlay.boxes) {
    const point = mapVideoPoint(box.x + box.width, box.y, geometry);
    const boxAlpha = masterAlpha * config.boxStrength / 100;
    drawLabel(
      context,
      `B${String(box.id).padStart(2, '0')}  ${box.confidence.toFixed(2)}`,
      point.x + 5 * sizeScale,
      point.y - 5 * sizeScale,
      'left',
      { ...config, labelSize: Math.max(8, config.labelSize - 1) },
      boxAlpha,
      sizeScale,
    );
  }

  if (config.burnLockup) drawAflLockup(context, options.stageWidth, options.stageHeight);

  if (DEBUG_VISION) {
    context.globalAlpha = 0.9;
    context.fillStyle = '#00ff88';
    context.font = '11px monospace';
    context.textAlign = 'left';
    context.fillText(`${config.analysisFPS} SPS  /  ${overlay.featureCount} FEATURES  /  F ${overlay.frameBucket}`, 12, 18);
  }
  context.globalAlpha = 1;
}
