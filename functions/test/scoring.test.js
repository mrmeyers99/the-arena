// Runs against the Firestore emulator: `npm run test:emulator`.
import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { toggleTaskEntry } from '../scoring.js';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run with the Firestore emulator.');

const app = initializeApp({ projectId: 'demo-the-arena' });
const db = getFirestore(app);
const comp = db.collection('competitions').doc('c1');
const now = new Date('2026-01-05T12:00:00Z');

const clear = async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-the-arena/databases/(default)/documents`,
    { method: 'DELETE' }
  );
};

beforeEach(async () => {
  await clear();
  await comp.set({
    name: 'C',
    startDate: '2026-01-01',
    endDate: '2026-02-11',
    tasks: [
      { id: 'run', name: 'Run', points: '10', frequency: 'daily' },
      { id: 'walk', name: 'Walk', points: 20, frequency: 'weekly' },
      { id: 'big', name: 'Big', points: 50, frequency: 'once' }
    ]
  });
  await comp.collection('participants').doc('alice').set({ score: 0 });
});

after(clear);

const score = async () => (await comp.collection('participants').doc('alice').get()).get('score');
const req = (extra) => ({ competitionId: 'c1', taskId: 'run', date: '2026-01-05', completed: true, ...extra });

test('awards the competition-defined points, ignoring client values', async () => {
  const result = await toggleTaskEntry(db, 'alice', { ...req(), points: 9999, pointsAwarded: 9999 }, now);
  assert.deepEqual(result, { score: 10 });
  assert.equal(await score(), 10);
  const entry = await comp.collection('entries').doc('alice_run_2026-01-05').get();
  assert.equal(entry.get('pointsAwarded'), 10);
  assert.equal(entry.get('userId'), 'alice');
});

test('checking twice only scores once', async () => {
  await toggleTaskEntry(db, 'alice', req(), now);
  await toggleTaskEntry(db, 'alice', req(), now);
  assert.equal(await score(), 10);
});

test('unchecking removes the entry and its points', async () => {
  await toggleTaskEntry(db, 'alice', req(), now);
  await toggleTaskEntry(db, 'alice', req({ taskId: 'big' }), now);
  assert.equal(await score(), 60);
  await toggleTaskEntry(db, 'alice', req({ completed: false }), now);
  assert.equal(await score(), 50);
  assert.equal((await comp.collection('entries').doc('alice_run_2026-01-05').get()).exists, false);
  // Unchecking something not checked is a no-op.
  await toggleTaskEntry(db, 'alice', req({ completed: false }), now);
  assert.equal(await score(), 50);
});

test('one-and-done tasks have one entry regardless of date', async () => {
  await toggleTaskEntry(db, 'alice', req({ taskId: 'big' }), now);
  await toggleTaskEntry(db, 'alice', req({ taskId: 'big', date: '2026-01-04' }), now);
  assert.equal(await score(), 50);
});

test('rejects non-participants, unknown tasks and future dates', async () => {
  await assert.rejects(toggleTaskEntry(db, 'mallory', req(), now), { code: 'permission-denied' });
  await assert.rejects(toggleTaskEntry(db, 'alice', req({ taskId: 'nope' }), now), { code: 'not-found' });
  await assert.rejects(toggleTaskEntry(db, 'alice', req({ competitionId: 'nope' }), now), { code: 'not-found' });
  await assert.rejects(toggleTaskEntry(db, 'alice', req({ date: '2026-02-01' }), now), {
    code: 'invalid-argument'
  });
  await assert.rejects(toggleTaskEntry(db, 'alice', req({ completed: 'yes' }), now), { code: 'invalid-argument' });
  assert.equal(await score(), 0);
});

test('rejects dates outside the competition, so past days cannot be farmed', async () => {
  await assert.rejects(toggleTaskEntry(db, 'alice', req({ date: '2025-12-31' }), now), { code: 'invalid-argument' });
  await assert.rejects(toggleTaskEntry(db, 'alice', req({ date: '0001-01-01' }), now), { code: 'invalid-argument' });
  const late = new Date('2026-03-01T12:00:00Z');
  await assert.rejects(toggleTaskEntry(db, 'alice', req({ date: '2026-02-12' }), late), { code: 'invalid-argument' });
  assert.equal(await score(), 0);
});

test('a weekly task scores once per week', async () => {
  // 2026-01-04 is a Sunday, the key for the week of 2026-01-05.
  await toggleTaskEntry(db, 'alice', req({ taskId: 'walk', date: '2026-01-04' }), now);
  await assert.rejects(toggleTaskEntry(db, 'alice', req({ taskId: 'walk', date: '2026-01-05' }), now), {
    code: 'invalid-argument'
  });
  await toggleTaskEntry(db, 'alice', req({ taskId: 'walk', date: '2026-01-04' }), now);
  assert.equal(await score(), 20);
});
