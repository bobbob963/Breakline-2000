import test from 'node:test';
import assert from 'node:assert/strict';
import { SpecialMeter } from '../src/special.js';

test('100 percent remains ready through waiting and wipeouts until consumed', () => {
  const meter = new SpecialMeter();
  meter.gain(.72); meter.gain(.45);
  for (let i = 0; i < 3600; i++) { meter.update(1 / 30); if (i % 100 === 0) meter.bail(); }
  assert.equal(meter.value, 1);
  assert.equal(meter.ready, true);
  assert.equal(meter.consume(), true);
  assert.equal(meter.value, 0);
  assert.equal(meter.consume(), false);
});

test('partial charge can decay but a restart clears a latched charge', () => {
  const meter = new SpecialMeter(); meter.gain(.5); meter.update(10);
  assert.ok(meter.value < .5 && meter.value > 0);
  assert.equal(meter.consume(), false);
  meter.gain(1); meter.reset(); assert.equal(meter.ready, false);
});
