import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEntryId, isFutureDate, taskPoints, validateRequest } from '../validate.js';

const valid = { competitionId: 'c1', taskId: 't1', date: '2026-01-05', completed: true };

test('validateRequest accepts a well-formed request', () => {
  assert.equal(validateRequest(valid), null);
  assert.equal(validateRequest({ ...valid, completed: false, timezone: 'UTC' }), null);
});

test('validateRequest rejects bad input', () => {
  assert.ok(validateRequest(null));
  assert.ok(validateRequest({ ...valid, competitionId: '' }));
  assert.ok(validateRequest({ ...valid, competitionId: 'a/b' }));
  assert.ok(validateRequest({ ...valid, taskId: 3 }));
  assert.ok(validateRequest({ ...valid, date: '2026-1-5' }));
  assert.ok(validateRequest({ ...valid, date: '2026-13-45' }));
  assert.ok(validateRequest({ ...valid, completed: 'yes' }));
  assert.ok(validateRequest({ ...valid, timezone: 5 }));
});

test('buildEntryId matches the client format', () => {
  assert.equal(buildEntryId('u', { id: 't', frequency: 'once' }, '2026-01-05'), 'u_t');
  assert.equal(buildEntryId('u', { id: 't', frequency: 'daily' }, '2026-01-05'), 'u_t_2026-01-05');
});

test('isFutureDate allows one day of timezone slack', () => {
  const now = new Date('2026-01-05T12:00:00Z');
  assert.equal(isFutureDate('2026-01-05', now), false);
  assert.equal(isFutureDate('2026-01-06', now), false);
  assert.equal(isFutureDate('2026-01-07', now), true);
});

test('taskPoints reads numbers and numeric strings only', () => {
  assert.equal(taskPoints({ points: 10 }), 10);
  assert.equal(taskPoints({ points: '15' }), 15);
  assert.equal(taskPoints({ points: 'abc' }), null);
  assert.equal(taskPoints({ points: 1.5 }), null);
  assert.equal(taskPoints({}), null);
});
