import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEntryId, checkEntryDate, isFutureDate, taskPoints, validateRequest } from '../validate.js';

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

test('checkEntryDate keeps daily and one-and-done entries inside the competition', () => {
  for (const frequency of ['daily', 'once']) {
    const task = { id: 't', frequency };
    assert.equal(checkEntryDate(task, '2026-01-05', '2026-01-05', '2026-02-15'), null);
    assert.equal(checkEntryDate(task, '2026-02-15', '2026-01-05', '2026-02-15'), null);
    assert.ok(checkEntryDate(task, '2026-01-04', '2026-01-05', '2026-02-15'));
    assert.ok(checkEntryDate(task, '0001-01-01', '2026-01-05', '2026-02-15'));
    assert.ok(checkEntryDate(task, '2026-02-16', '2026-01-05', '2026-02-15'));
  }
});

test('checkEntryDate allows one weekly entry per week, keyed by Sunday', () => {
  const weekly = { id: 'w', frequency: 'weekly' };
  // Competition starts Wednesday 2026-01-07; its first week is keyed Sunday 2026-01-04.
  assert.equal(checkEntryDate(weekly, '2026-01-04', '2026-01-07', '2026-02-15'), null);
  assert.equal(checkEntryDate(weekly, '2026-02-15', '2026-01-07', '2026-02-15'), null);
  // Other days of the week would let one week score up to 7 times.
  assert.ok(checkEntryDate(weekly, '2026-01-05', '2026-01-07', '2026-02-15'));
  assert.ok(checkEntryDate(weekly, '2026-01-10', '2026-01-07', '2026-02-15'));
  // Weeks entirely before or after the competition.
  assert.ok(checkEntryDate(weekly, '2025-12-28', '2026-01-07', '2026-02-15'));
  assert.ok(checkEntryDate(weekly, '2026-02-22', '2026-01-07', '2026-02-15'));
});

test('checkEntryDate fails closed without valid competition dates', () => {
  assert.ok(checkEntryDate({ frequency: 'daily' }, '2026-01-05', undefined, '2026-02-15'));
  assert.ok(checkEntryDate({ frequency: 'daily' }, '2026-01-05', '2026-01-01', 'soon'));
});
