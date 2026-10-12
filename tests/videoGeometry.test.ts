import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exportFrameSize, resolveFraming } from '../src/vision/videoGeometry.ts';

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
});
