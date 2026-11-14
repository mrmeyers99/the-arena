import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';

// Must match the --project passed to `firebase emulators:exec` in package.json.
const PROJECT_ID = 'demo-the-arena';
const COMP = 'comp1';
const ALICE = 'alice'; // competition creator
const BOB = 'bob'; // regular user who joins
const MALLORY = 'mallory'; // another signed-in user

let testEnv;

const db = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

// Mirrors the payload built in Dashboard.handleCreateCompetition.
const newCompetition = (uid, overrides = {}) => ({
  name: 'Spring Challenge',
  description: 'Get moving',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  accessType: 'open',
  teamConfig: {
    mode: 'individual',
    creation: 'admin',
    allowMultipleTeams: false,
    scoreCalculation: 'sum'
  },
  tasks: [
    {
      id: 'TASK0001',
      name: 'Walk',
      points: 10,
      frequency: 'daily',
      isUserDefinedGoal: false,
      checkinDueDateOffset: 2
    }
  ],
  creatorId: uid,
  adminIds: [uid],
  createdAt: serverTimestamp(),
  participantCount: 0,
  ...overrides
});

// Mirrors the payload built in CompetitionView.handleTaskCheck.
const newEntry = (uid, overrides = {}) => ({
  userId: uid,
  taskId: 'TASK0001',
  date: '2026-03-02',
  completedAt: serverTimestamp(),
  timezone: 'America/New_York',
  pointsAwarded: 10,
  ...overrides
});

const entryId = (uid, date = '2026-03-02') => `${uid}_TASK0001_${date}`;

// Seed data with rules disabled.
const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

const CODE = 'SECRET42';

const seedCompetition = (overrides = {}) =>
  seed(async (f) => {
    await setDoc(doc(f, 'competitions', COMP), {
      ...newCompetition(ALICE, overrides),
      createdAt: new Date()
    });
    if (overrides.accessType === 'code') {
      await setDoc(doc(f, 'competitions', COMP, 'private', 'access'), { accessCode: CODE });
    }
  });

// Mirrors Dashboard.handleCreateCompetition for a code competition.
const createCodeCompetition = (uid, { comp = {}, secret = { accessCode: CODE } } = {}) => {
  const f = db(uid);
  const ref = doc(collection(f, 'competitions'));
  const batch = writeBatch(f);
  batch.set(ref, newCompetition(uid, { accessType: 'code', ...comp }));
  if (secret) batch.set(doc(ref, 'private', 'access'), secret);
  return batch.commit();
};

// Mirrors CompetitionView.handleJoin: optional access grant, participant doc
// and competition counters in one batch.
const joinBatch = (uid, accessCode) => {
  const f = db(uid);
  const batch = writeBatch(f);
  if (accessCode !== undefined) {
    batch.set(doc(f, 'competitions', COMP, 'accessGrants', uid), { accessCode });
  }
  batch.set(doc(f, 'competitions', COMP, 'participants', uid), {
    displayName: uid,
    joinedAt: serverTimestamp(),
    score: 0
  });
  batch.update(doc(f, 'competitions', COMP), {
    participantIds: arrayUnion(uid),
    participantCount: increment(1)
  });
  return batch.commit();
};

const seedParticipant = (uid, score = 0) =>
  seed((f) =>
    setDoc(doc(f, 'competitions', COMP, 'participants', uid), {
      displayName: uid,
      joinedAt: new Date(),
      score
    })
  );

// Simulates a completed join for `uid` (participant doc + competition counters).
const seedJoined = async (uid) => {
  await seedParticipant(uid);
  await seed((f) =>
    updateDoc(doc(f, 'competitions', COMP), {
      participantIds: arrayUnion(uid),
      participantCount: increment(1)
    })
  );
};

const seedEntry = (uid, id = entryId(uid)) =>
  seed((f) =>
    setDoc(doc(f, 'competitions', COMP, 'entries', id), {
      ...newEntry(uid),
      completedAt: new Date()
    })
  );

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')
    }
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('unauthenticated users', () => {
  beforeEach(() => seedCompetition());

  it('cannot list or read competitions', async () => {
    await assertFails(getDocs(collection(anonDb(), 'competitions')));
    await assertFails(getDoc(doc(anonDb(), 'competitions', COMP)));
  });

  it('cannot create a competition', async () => {
    await assertFails(addDoc(collection(anonDb(), 'competitions'), newCompetition(ALICE)));
  });

  it('cannot read participants, teams or entries', async () => {
    const f = anonDb();
    await assertFails(getDocs(collection(f, 'competitions', COMP, 'participants')));
    await assertFails(getDocs(collection(f, 'competitions', COMP, 'teams')));
    await assertFails(getDocs(collection(f, 'competitions', COMP, 'entries')));
  });

  it('cannot create a participant doc', async () => {
    await assertFails(
      setDoc(doc(anonDb(), 'competitions', COMP, 'participants', BOB), {
        displayName: 'Bob',
        joinedAt: serverTimestamp(),
        score: 0
      })
    );
  });
});

describe('unknown collections', () => {
  it('are denied', async () => {
    await assertFails(getDoc(doc(db(ALICE), 'users', ALICE)));
    await assertFails(setDoc(doc(db(ALICE), 'users', ALICE), { a: 1 }));
    await assertFails(setDoc(doc(db(ALICE), 'competitions', COMP, 'messages', 'm1'), { a: 1 }));
  });
});

describe('competitions', () => {
  it('signed-in users can read a competition by id', async () => {
    await seedCompetition();
    await assertSucceeds(getDoc(doc(db(BOB), 'competitions', COMP)));
  });

  // The three dashboard queries from Dashboard's useEffect.
  const discoverable = (f) => query(collection(f, 'competitions'), where('accessType', 'in', ['open', 'code']));
  const memberOf = (f, uid) => query(collection(f, 'competitions'), where('participantIds', 'array-contains', uid));
  const adminOf = (f, uid) => query(collection(f, 'competitions'), where('adminIds', 'array-contains', uid));

  it("allows the dashboard's queries", async () => {
    await seedCompetition();
    const f = db(BOB);
    await assertSucceeds(getDocs(discoverable(f)));
    await assertSucceeds(getDocs(memberOf(f, BOB)));
    await assertSucceeds(getDocs(adminOf(f, BOB)));
  });

  it('rejects unfiltered listing, which would expose link competitions', async () => {
    await seedCompetition({ accessType: 'link' });
    await assertFails(getDocs(query(collection(db(MALLORY), 'competitions'))));
    await assertFails(getDocs(query(collection(db(MALLORY), 'competitions'), where('accessType', '==', 'link'))));
    // Asking for someone else's memberships is rejected too.
    await assertFails(getDocs(adminOf(db(MALLORY), ALICE)));
  });

  it('link competitions only show up for their members and admins', async () => {
    await seedCompetition({ accessType: 'link' });
    expect((await getDocs(discoverable(db(MALLORY)))).size).toBe(0);
    expect((await getDocs(adminOf(db(ALICE), ALICE))).size).toBe(1);
    await seedJoined(BOB);
    expect((await getDocs(memberOf(db(BOB), BOB))).size).toBe(1);
  });

  it('allows creating a competition exactly as the app does', async () => {
    await assertSucceeds(addDoc(collection(db(ALICE), 'competitions'), newCompetition(ALICE)));
  });

  it('allows creating a code competition together with its secret', async () => {
    await assertSucceeds(createCodeCompetition(ALICE));
  });

  it('rejects storing the access code on the (world-readable) competition doc', async () => {
    const col = collection(db(ALICE), 'competitions');
    await assertFails(addDoc(col, newCompetition(ALICE, { accessCode: CODE })));
    await assertFails(addDoc(col, newCompetition(ALICE, { accessCode: null })));
    await assertFails(createCodeCompetition(ALICE, { comp: { accessCode: CODE } }));
  });

  it('rejects a code competition without a valid secret', async () => {
    await assertFails(createCodeCompetition(ALICE, { secret: null }));
    await assertFails(createCodeCompetition(ALICE, { secret: { accessCode: 'SHORT' } }));
    await assertFails(createCodeCompetition(ALICE, { secret: { accessCode: CODE, extra: 1 } }));
  });

  it('rejects writing a secret for an existing competition or a non-code one', async () => {
    await seedCompetition();
    await assertFails(setDoc(doc(db(ALICE), 'competitions', COMP, 'private', 'access'), { accessCode: CODE }));
    const f = db(ALICE);
    const ref = doc(collection(f, 'competitions'));
    const batch = writeBatch(f);
    batch.set(ref, newCompetition(ALICE, { accessType: 'open' }));
    batch.set(doc(ref, 'private', 'access'), { accessCode: CODE });
    await assertFails(batch.commit());
  });

  it('allows tasks whose points are strings (number inputs yield strings)', async () => {
    await assertSucceeds(
      addDoc(
        collection(db(ALICE), 'competitions'),
        newCompetition(ALICE, {
          tasks: [{ id: 'T', name: 'x', points: '15', frequency: 'once' }]
        })
      )
    );
  });

  it('rejects a competition created on behalf of someone else', async () => {
    await assertFails(addDoc(collection(db(MALLORY), 'competitions'), newCompetition(ALICE)));
    await assertFails(
      addDoc(collection(db(MALLORY), 'competitions'), newCompetition(MALLORY, { adminIds: [MALLORY, ALICE] }))
    );
  });

  it('rejects bad initial counters, extra fields and bad types', async () => {
    const f = db(ALICE);
    const col = collection(f, 'competitions');
    await assertFails(addDoc(col, newCompetition(ALICE, { participantCount: 5 })));
    await assertFails(addDoc(col, newCompetition(ALICE, { participantIds: [BOB] })));
    await assertFails(addDoc(col, newCompetition(ALICE, { isFeatured: true })));
    await assertFails(addDoc(col, newCompetition(ALICE, { name: '' })));
    await assertFails(addDoc(col, newCompetition(ALICE, { name: 42 })));
    await assertFails(addDoc(col, newCompetition(ALICE, { accessType: 'secret' })));
    await assertFails(addDoc(col, newCompetition(ALICE, { tasks: 'nope' })));
    await assertFails(addDoc(col, newCompetition(ALICE, { createdAt: new Date('2020-01-01') })));
  });

  describe('joining', () => {
    beforeEach(() => seedCompetition());

    it("allows the app's batched join flow", async () => {
      await assertSucceeds(joinBatch(BOB));
    });

    it("allows the app's join flow (participant doc, then counters)", async () => {
      const f = db(BOB);
      await assertSucceeds(
        setDoc(doc(f, 'competitions', COMP, 'participants', BOB), {
          displayName: 'Bob',
          joinedAt: serverTimestamp(),
          score: 0
        })
      );
      await assertSucceeds(
        updateDoc(doc(f, 'competitions', COMP), {
          participantIds: arrayUnion(BOB),
          participantCount: increment(1)
        })
      );
    });

    it('allows a second user to join after the first', async () => {
      await seedJoined(BOB);
      await seedParticipant(MALLORY);
      await assertSucceeds(
        updateDoc(doc(db(MALLORY), 'competitions', COMP), {
          participantIds: arrayUnion(MALLORY),
          participantCount: increment(1)
        })
      );
    });

    it('rejects updating counters without a participant doc', async () => {
      await assertFails(
        updateDoc(doc(db(BOB), 'competitions', COMP), {
          participantIds: arrayUnion(BOB),
          participantCount: increment(1)
        })
      );
    });

    it('rejects adding someone else to participantIds', async () => {
      await seedParticipant(BOB);
      await assertFails(
        updateDoc(doc(db(BOB), 'competitions', COMP), {
          participantIds: arrayUnion(MALLORY),
          participantCount: increment(1)
        })
      );
      await assertFails(
        updateDoc(doc(db(BOB), 'competitions', COMP), {
          participantIds: arrayUnion(BOB, MALLORY),
          participantCount: increment(2)
        })
      );
    });

    it('rejects inflating participantCount or joining twice', async () => {
      await seedParticipant(BOB);
      await assertFails(
        updateDoc(doc(db(BOB), 'competitions', COMP), {
          participantIds: arrayUnion(BOB),
          participantCount: increment(10)
        })
      );
      await seedJoined(BOB);
      await assertFails(
        updateDoc(doc(db(BOB), 'competitions', COMP), {
          participantCount: increment(1)
        })
      );
    });

    it('rejects removing other participants', async () => {
      await seedJoined(MALLORY);
      await seedParticipant(BOB);
      await assertFails(
        updateDoc(doc(db(BOB), 'competitions', COMP), {
          participantIds: [BOB],
          participantCount: increment(1)
        })
      );
    });
  });

  describe('code competitions', () => {
    beforeEach(() => seedCompetition({ accessType: 'code' }));

    it('lets admins read the access code, and nobody else', async () => {
      await assertSucceeds(getDoc(doc(db(ALICE), 'competitions', COMP, 'private', 'access')));
      await assertFails(getDoc(doc(db(BOB), 'competitions', COMP, 'private', 'access')));
      await assertFails(getDocs(collection(db(BOB), 'competitions', COMP, 'private')));
    });

    it('does not expose the code on the competition doc', async () => {
      const snap = await getDoc(doc(db(MALLORY), 'competitions', COMP));
      expect(snap.data()).not.toHaveProperty('accessCode');
    });

    it('allows joining with the right code', async () => {
      await assertSucceeds(joinBatch(BOB, CODE));
    });

    it('rejects joining without a code or with the wrong one', async () => {
      await assertFails(joinBatch(MALLORY));
      await assertFails(joinBatch(MALLORY, 'WRONG123'));
      await assertFails(joinBatch(MALLORY, null));
      // The old two-step flow (participant doc, then counters) no longer works either.
      await assertFails(
        setDoc(doc(db(MALLORY), 'competitions', COMP, 'participants', MALLORY), {
          displayName: 'M',
          joinedAt: serverTimestamp(),
          score: 0
        })
      );
    });

    it("rejects forging, reusing or reading other users' grants", async () => {
      await assertSucceeds(joinBatch(BOB, CODE));
      await assertFails(setDoc(doc(db(MALLORY), 'competitions', COMP, 'accessGrants', BOB), { accessCode: CODE }));
      await assertFails(getDoc(doc(db(MALLORY), 'competitions', COMP, 'accessGrants', BOB)));
      await assertSucceeds(getDoc(doc(db(BOB), 'competitions', COMP, 'accessGrants', BOB)));
      await assertFails(updateDoc(doc(db(BOB), 'competitions', COMP, 'accessGrants', BOB), { accessCode: 'X' }));
      await assertFails(deleteDoc(doc(db(BOB), 'competitions', COMP, 'accessGrants', BOB)));
    });

    it('rejects changing or deleting the secret, even by the creator', async () => {
      const ref = doc(db(ALICE), 'competitions', COMP, 'private', 'access');
      await assertFails(setDoc(ref, { accessCode: 'NEWCODE99' }));
      await assertFails(deleteDoc(ref));
    });
  });

  describe('link competitions', () => {
    beforeEach(() => seedCompetition({ accessType: 'link' }));

    it('anyone with the id can open and join', async () => {
      await assertSucceeds(getDoc(doc(db(BOB), 'competitions', COMP)));
      await assertSucceeds(joinBatch(BOB));
    });

    it('rejects access grants (they only apply to code competitions)', async () => {
      await assertFails(setDoc(doc(db(BOB), 'competitions', COMP, 'accessGrants', BOB), { accessCode: CODE }));
    });
  });

  it('rejects changing protected competition fields, even by the creator', async () => {
    await seedCompetition();
    const ref = (uid) => doc(db(uid), 'competitions', COMP);
    await assertFails(updateDoc(ref(MALLORY), { adminIds: [ALICE, MALLORY] }));
    await assertFails(updateDoc(ref(MALLORY), { creatorId: MALLORY }));
    await assertFails(updateDoc(ref(MALLORY), { name: 'Hijacked' }));
    await assertFails(updateDoc(ref(MALLORY), { tasks: [] }));
    // The app has no edit UI, so the creator cannot edit either (yet).
    await assertFails(updateDoc(ref(ALICE), { name: 'Renamed' }));
  });

  it('rejects deleting a competition', async () => {
    await seedCompetition();
    await assertFails(deleteDoc(doc(db(MALLORY), 'competitions', COMP)));
    await assertFails(deleteDoc(doc(db(ALICE), 'competitions', COMP)));
  });
});

describe('participants', () => {
  beforeEach(() => seedCompetition());

  it('signed-in users can read the participant list (leaderboard)', async () => {
    await seedParticipant(BOB, 30);
    await assertSucceeds(getDocs(collection(db(MALLORY), 'competitions', COMP, 'participants')));
  });

  it('allows a participant doc with a null displayName', async () => {
    await assertSucceeds(
      setDoc(doc(db(BOB), 'competitions', COMP, 'participants', BOB), {
        displayName: null,
        joinedAt: serverTimestamp(),
        score: 0
      })
    );
  });

  it('rejects creating a participant doc for another user', async () => {
    await assertFails(
      setDoc(doc(db(MALLORY), 'competitions', COMP, 'participants', BOB), {
        displayName: 'Bob',
        joinedAt: serverTimestamp(),
        score: 0
      })
    );
  });

  it('rejects joining with a non-zero starting score or extra fields', async () => {
    const ref = doc(db(BOB), 'competitions', COMP, 'participants', BOB);
    await assertFails(setDoc(ref, { displayName: 'Bob', joinedAt: serverTimestamp(), score: 999 }));
    await assertFails(
      setDoc(ref, {
        displayName: 'Bob',
        joinedAt: serverTimestamp(),
        score: 0,
        isAdmin: true
      })
    );
  });

  it('rejects joining a competition that does not exist', async () => {
    await assertFails(
      setDoc(doc(db(BOB), 'competitions', 'nope', 'participants', BOB), {
        displayName: 'Bob',
        joinedAt: serverTimestamp(),
        score: 0
      })
    );
  });

  it('rejects re-joining (overwriting) an existing participant doc', async () => {
    await seedParticipant(BOB, 50);
    await assertFails(
      setDoc(doc(db(BOB), 'competitions', COMP, 'participants', BOB), {
        displayName: 'Bob',
        joinedAt: serverTimestamp(),
        score: 0
      })
    );
  });

  it('rejects any client change to a score, even your own', async () => {
    await seedParticipant(BOB, 10);
    const ref = doc(db(BOB), 'competitions', COMP, 'participants', BOB);
    await assertFails(updateDoc(ref, { score: increment(10) }));
    await assertFails(updateDoc(ref, { score: increment(-10) }));
    await assertFails(updateDoc(ref, { score: 1000000 }));
    await assertFails(setDoc(ref, { displayName: BOB, joinedAt: new Date(), score: 1000000 }));
  });

  it("rejects changing another user's score", async () => {
    await seedParticipant(BOB, 10);
    await assertFails(
      updateDoc(doc(db(MALLORY), 'competitions', COMP, 'participants', BOB), {
        score: increment(-10)
      })
    );
  });

  it('rejects changing other participant fields', async () => {
    await seedParticipant(BOB, 10);
    const ref = doc(db(BOB), 'competitions', COMP, 'participants', BOB);
    await assertFails(updateDoc(ref, { displayName: 'Someone else' }));
    await assertFails(updateDoc(ref, { joinedAt: new Date('2020-01-01') }));
  });

  it('rejects deleting participant docs', async () => {
    await seedParticipant(BOB, 10);
    await assertFails(deleteDoc(doc(db(BOB), 'competitions', COMP, 'participants', BOB)));
    await assertFails(deleteDoc(doc(db(MALLORY), 'competitions', COMP, 'participants', BOB)));
  });
});

describe('teams', () => {
  beforeEach(() => seedCompetition());

  it('signed-in users can read teams', async () => {
    await seed((f) => setDoc(doc(f, 'competitions', COMP, 'teams', 't1'), { name: 'Red', score: 0 }));
    await assertSucceeds(getDocs(collection(db(BOB), 'competitions', COMP, 'teams')));
  });

  it('no client can write teams', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'competitions', COMP, 'teams', 't1'), { name: 'Red' }));
    await assertFails(addDoc(collection(db(BOB), 'competitions', COMP, 'teams'), { name: 'Blue' }));
  });
});

describe('entries', () => {
  beforeEach(async () => {
    await seedCompetition();
    await seedJoined(BOB);
    await seedJoined(MALLORY);
  });

  // Entries are written only by the toggleTaskEntry Cloud Function (Admin
  // SDK, which bypasses rules). Clients may read their own and nothing more.
  it('allows reading your own entry', async () => {
    await seedEntry(BOB);
    await assertSucceeds(getDoc(doc(db(BOB), 'competitions', COMP, 'entries', entryId(BOB))));
  });

  it("allows the app's own-entries query", async () => {
    await seedEntry(BOB);
    await assertSucceeds(
      getDocs(query(collection(db(BOB), 'competitions', COMP, 'entries'), where('userId', '==', BOB)))
    );
  });

  it("rejects reading other users' entries", async () => {
    await seedEntry(BOB);
    const f = db(MALLORY);
    await assertFails(getDoc(doc(f, 'competitions', COMP, 'entries', entryId(BOB))));
    await assertFails(getDocs(collection(f, 'competitions', COMP, 'entries')));
    await assertFails(getDocs(query(collection(f, 'competitions', COMP, 'entries'), where('userId', '==', BOB))));
  });

  it('rejects creating entries from the client, even your own', async () => {
    const f = db(BOB);
    await assertFails(setDoc(doc(f, 'competitions', COMP, 'entries', entryId(BOB)), newEntry(BOB)));
    await assertFails(setDoc(doc(f, 'competitions', COMP, 'entries', `${BOB}_TASK0001`), newEntry(BOB)));
    await assertFails(addDoc(collection(f, 'competitions', COMP, 'entries'), newEntry(BOB)));
    await assertFails(setDoc(doc(db(MALLORY), 'competitions', COMP, 'entries', entryId(BOB)), newEntry(BOB)));
  });

  it('rejects modifying or deleting entries from the client, even your own', async () => {
    await seedEntry(BOB);
    const ref = doc(db(BOB), 'competitions', COMP, 'entries', entryId(BOB));
    await assertFails(updateDoc(ref, { pointsAwarded: 1000 }));
    await assertFails(setDoc(ref, newEntry(BOB, { pointsAwarded: 1000 })));
    await assertFails(deleteDoc(ref));
    await assertFails(deleteDoc(doc(db(MALLORY), 'competitions', COMP, 'entries', entryId(BOB))));
  });
});
