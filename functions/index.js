import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { ScoringError, toggleTaskEntry as applyToggle } from './scoring.js';

initializeApp();

// Called by the app when a user checks or unchecks a task. The only way
// entries and participant scores change (Firestore rules deny client writes).
export const toggleTaskEntry = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  try {
    return await applyToggle(getFirestore(), request.auth.uid, request.data);
  } catch (error) {
    if (error instanceof ScoringError) throw new HttpsError(error.code, error.message);
    logger.error('toggleTaskEntry failed', error);
    throw new HttpsError('internal', 'Could not update the task.');
  }
});
