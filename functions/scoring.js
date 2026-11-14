// Server-side scoring. Clients may not write entries or scores directly
// (see firestore.rules); they call toggleTaskEntry, which runs this.

import { FieldValue } from 'firebase-admin/firestore';
import { buildEntryId, isFutureDate, taskPoints, validateRequest } from './validate.js';

// Thrown for requests that should be rejected. `code` is a Functions
// HttpsError code.
export class ScoringError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Mark a task complete (or not) for `uid` and adjust their score by the
// points the competition defines for that task. Entry and score change in one
// transaction, so they can't drift apart. Returns { score }.
export const toggleTaskEntry = async (db, uid, data, now = new Date()) => {
  const problem = validateRequest(data);
  if (problem) throw new ScoringError('invalid-argument', problem);
  const { competitionId, taskId, date, completed, timezone } = data;

  const competitionRef = db.collection('competitions').doc(competitionId);
  const participantRef = competitionRef.collection('participants').doc(uid);

  return db.runTransaction(async (tx) => {
    const [competitionSnap, participantSnap] = await Promise.all([tx.get(competitionRef), tx.get(participantRef)]);
    if (!competitionSnap.exists) throw new ScoringError('not-found', 'Competition not found.');
    if (!participantSnap.exists) throw new ScoringError('permission-denied', 'Join the competition first.');

    const tasks = competitionSnap.get('tasks') || [];
    const task = tasks.find((t) => t && t.id === taskId);
    if (!task) throw new ScoringError('not-found', 'Task not found.');

    const entryRef = competitionRef.collection('entries').doc(buildEntryId(uid, task, date));
    const entrySnap = await tx.get(entryRef);
    const currentScore = participantSnap.get('score') || 0;

    if (completed) {
      // Already recorded: nothing to do (also makes retries safe).
      if (entrySnap.exists) return { score: currentScore };
      if (isFutureDate(date, now)) throw new ScoringError('invalid-argument', 'Date is in the future.');
      const points = taskPoints(task);
      if (points === null) throw new ScoringError('failed-precondition', 'Task has no valid points value.');

      const entry = {
        userId: uid,
        taskId,
        date,
        completedAt: FieldValue.serverTimestamp(),
        pointsAwarded: points
      };
      if (timezone) entry.timezone = timezone;
      tx.create(entryRef, entry);
      tx.update(participantRef, { score: FieldValue.increment(points) });
      return { score: currentScore + points };
    }

    if (!entrySnap.exists) return { score: currentScore };
    // Remove exactly what was awarded, which the server recorded.
    const awarded = entrySnap.get('pointsAwarded') || 0;
    tx.delete(entryRef);
    tx.update(participantRef, { score: FieldValue.increment(-awarded) });
    return { score: currentScore - awarded };
  });
};
