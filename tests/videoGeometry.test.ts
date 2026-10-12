import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exportFrameSize, fitAspectBox, getVideoGeometry, resolveFraming } from '../src/vision/videoGeometry.ts';

describe('resolveFraming', () => {
  it('keeps an explicit fit or fill', () => {
    assert.equal(resolveFraming(1080, 1920, 1920, 1576, 'fit'), 'fit');
    assert.equal(resolveFraming(1920, 1080, 1920, 1080, 'fill'), 'fill');
  });

  it('fits portrait sources into a landscape stage instead of cropping the head', () => {
    assert.equal(resolveFraming(1080, 1920, 1920, 1576, 'auto'), 'fit');
    assert.equal(resolveFraming(1080, 1350, 1920, 1576, 'auto'), 'fit');
  });

  it('fills when the stage and source aspects nearly match', () => {
    assert.equal(resolveFraming(1920, 1080, 1920, 1080, 'auto'), 'fill');
    assert.equal(resolveFraming(1920, 1080, 1900, 1080, 'auto'), 'fill');
  });

  it('fits a tall portrait into a shorter portrait stage', () => {
    assert.equal(resolveFraming(1080, 1920, 800, 1000, 'auto'), 'fit');
  });
});

describe('exportFrameSize', () => {
  it('exports 9:16 and 4:5 at the source aspect with a 1920 long edge', () => {
    assert.deepEqual(exportFrameSize(1080, 1920, 1920, 1576, 'auto'), { width: 1080, height: 1920 });
    assert.deepEqual(exportFrameSize(1080, 1350, 1920, 1576, 'auto'), { width: 1536, height: 1920 });
  });

  it('does not emit the landscape stage size for a portrait fit', () => {
    const frame = exportFrameSize(1080, 1920, 1920, 1576, 'fit');
    assert.notDeepEqual(frame, { width: 1920, height: 1576 });
    assert.equal(frame.width < frame.height, true);
  });

  it('exports an explicit fill at the stage aspect', () => {
    assert.deepEqual(exportFrameSize(1080, 1920, 1920, 1576, 'fill'), { width: 1920, height: 1576 });
  });

  it('exports 16:9 fit at 1920x1080', () => {
    assert.deepEqual(exportFrameSize(1920, 1080, 800, 600, 'fit'), { width: 1920, height: 1080 });
  });

  it('locks delivery sizes for the aspect presets', () => {
    assert.deepEqual(exportFrameSize(1920, 1080, 800, 600, 'fill', 1920, '9:16'), { width: 1080, height: 1920 });
    assert.deepEqual(exportFrameSize(1920, 1080, 800, 600, 'auto', 1920, '4:5'), { width: 1080, height: 1350 });
    assert.deepEqual(exportFrameSize(640, 480, 800, 600, 'fit', 1920, '1:1'), { width: 1080, height: 1080 });
    assert.deepEqual(exportFrameSize(1080, 1920, 400, 800, 'auto', 1920, '16:9'), { width: 1920, height: 1080 });
  });
});

describe('letterbox', () => {
  it('keeps a 16:9 picture inside a 9:16 plate with vertical bars', () => {
    const geometry = getVideoGeometry(1920, 1080, 1080, 1920, 'fit');
    assert.equal(geometry.offsetX, 0);
    assert.ok(geometry.offsetY > 0);
    assert.equal(geometry.sourceWidth * geometry.scale, 1080);
    assert.ok(geometry.sourceHeight * geometry.scale < 1920);
  });

  it('fits a portrait preset inside a landscape stage', () => {
    const box = fitAspectBox(1000, 500, '9:16');
    assert.ok(box.height <= 500);
    assert.ok(box.width < box.height);
    assert.ok(Math.abs(box.width / box.height - 1080 / 1920) < 0.001);
  });
});
