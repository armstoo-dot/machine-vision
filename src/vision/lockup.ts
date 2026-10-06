/** AFL VISUALS lockup burned into the plate. Grey on near-black. No colour outside the picture. */
export function drawAflLockup(context: CanvasRenderingContext2D, width: number, height: number) {
  const bar = Math.max(28, Math.round(Math.min(width, height) * 0.046));
  const pad = Math.max(14, Math.round(width * 0.018));
  context.save();
  context.globalAlpha = 1;
  context.fillStyle = 'rgba(8,8,8,0.82)';
  context.fillRect(0, 0, width, bar);
  context.fillRect(0, height - bar, width, bar);
  context.strokeStyle = '#5a5a5a';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(pad, bar - 0.5);
  context.lineTo(width - pad, bar - 0.5);
  context.moveTo(pad, height - bar + 0.5);
  context.lineTo(width - pad, height - bar + 0.5);
  context.stroke();

  const fontSize = Math.max(11, Math.round(bar * 0.36));
  context.fillStyle = '#8a8a8a';
  context.textBaseline = 'middle';
  context.font = `500 ${fontSize}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  context.textAlign = 'left';
  context.fillText('>>  ARMSTRONG FUTURE LABS', pad, bar / 2);
  context.font = `400 ${Math.max(9, fontSize - 2)}px "IBM Plex Mono", ui-monospace, monospace`;
  context.textAlign = 'right';
  context.fillText('AFL', width - pad, bar / 2);

  context.font = `500 ${Math.max(10, fontSize - 1)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  context.textAlign = 'left';
  context.fillText('HUMAN TASTE. AI WORKFLOWS.', pad, height - bar / 2);
  context.textAlign = 'right';
  context.fillText('>>', width - pad, height - bar / 2);
  context.restore();
}
