import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AFL_CONFIG } from '../src/vision/config.ts';
import { resolveOverlayOpacity } from '../src/vision/envelope.ts';

describe('resolveOverlayOpacity', () => {
  it('uses the slider when the envelope is off', () => {
    assert.equal(resolveOverlayOpacity({ ...AFL_CONFIG, overlayOpacity: 50, envelopeEnabled: false }, 2, 4), 0.5);
  });

  it('ramps in at the start, holds the mid point, and falls at the end', () => {
    const config = {
      ...AFL_CONFIG,
      overlayOpacity: 100,
      envelopeEnabled: true,
      opacityStart: 0,
      opacityMid: 80,
      opacityEnd: 0,
    };
    assert.equal(resolveOverlayOpacity(config, 0, 10), 0);
    assert.equal(resolveOverlayOpacity(config, 5, 10), 0.8);
    assert.equal(resolveOverlayOpacity(config, 10, 10), 0);
    assert.ok(resolveOverlayOpacity(config, 2.5, 10) > 0.3);
    assert.ok(resolveOverlayOpacity(config, 7.5, 10) < 0.5);
  });

  it('scales the envelope by the master opacity', () => {
    const config = {
      ...AFL_CONFIG,
      overlayOpacity: 50,
      envelopeEnabled: true,
      opacityStart: 0,
      opacityMid: 100,
      opacityEnd: 0,
    };
    assert.equal(resolveOverlayOpacity(config, 5, 10), 0.5);
  });
});
