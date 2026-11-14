import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
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
} from "firebase/firestore";

// Must match the --project passed to `firebase emulators:exec` in package.json.
const PROJECT_ID = "demo-the-arena";
const COMP = "comp1";
const ALICE = "alice"; // competition creator
const BOB = "bob"; // regular user who joins
const MALLORY = "mallory"; // another signed-in user

let testEnv;

const db = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

// Mirrors the payload built in Dashboard.handleCreateCompetition.
const newCompetition = (uid, overrides = {}) => ({
  name: "Spring Challenge",
  description: "Get moving",
  startDate: "2026-03-01",
  endDate: "2026-03-31",
  accessType: "open",
  teamConfig: {
    mode: "individual",
    creation: "admin",
    allowMultipleTeams: false,
    scoreCalculation: "sum",
  },
  tasks: [
    {
      id: "TASK0001",
      name: "Walk",
      points: 10,
      frequency: "daily",
      isUserDefinedGoal: false,
      checkinDueDateOffset: 2,
    },
  ],
  creatorId: uid,
  adminIds: [uid],
  createdAt: serverTimestamp(),
  accessCode: null,
  participantCount: 0,
  ...overrides,
});

// Mirrors the payload built in CompetitionView.handleTaskCheck.
const newEntry = (uid, overrides = {}) => ({
  userId: uid,
  taskId: "TASK0001",
  date: "2026-03-02",
  completedAt: serverTimestamp(),
  timezone: "America/New_York",
  pointsAwarded: 10,
  ...overrides,
});

const entryId = (uid, date = "2026-03-02") => `${uid}_TASK0001_${date}`;

// Seed data with rules disabled.
const seed = (fn) =>
  testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

const seedCompetition = () =>
  seed((f) =>
    setDoc(doc(f, "competitions", COMP), {
      ...newCompetition(ALICE),
      createdAt: new Date(),
    }),
  );

const seedParticipant = (uid, score = 0) =>
  seed((f) =>
    setDoc(doc(f, "competitions", COMP, "participants", uid), {
      displayName: uid,
      joinedAt: new Date(),
      score,
    }),
  );

// Simulates a completed join for `uid` (participant doc + competition counters).
const seedJoined = async (uid) => {
  await seedParticipant(uid);
  await seed((f) =>
    updateDoc(doc(f, "competitions", COMP), {
      participantIds: arrayUnion(uid),
      participantCount: increment(1),
    }),
  );
};

const seedEntry = (uid, id = entryId(uid)) =>
  seed((f) =>
    setDoc(doc(f, "competitions", COMP, "entries", id), {
      ...newEntry(uid),
      completedAt: new Date(),
    }),
  );

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("unauthenticated users", () => {
  beforeEach(seedCompetition);

  it("cannot list or read competitions", async () => {
    await assertFails(getDocs(collection(anonDb(), "competitions")));
    await assertFails(getDoc(doc(anonDb(), "competitions", COMP)));
  });

  it("cannot create a competition", async () => {
    await assertFails(
      addDoc(collection(anonDb(), "competitions"), newCompetition(ALICE)),
    );
  });

  it("cannot read participants, teams or entries", async () => {
    const f = anonDb();
    await assertFails(getDocs(collection(f, "competitions", COMP, "participants")));
    await assertFails(getDocs(collection(f, "competitions", COMP, "teams")));
    await assertFails(getDocs(collection(f, "competitions", COMP, "entries")));
  });

  it("cannot create a participant doc", async () => {
    await assertFails(
      setDoc(doc(anonDb(), "competitions", COMP, "participants", BOB), {
        displayName: "Bob",
        joinedAt: serverTimestamp(),
        score: 0,
      }),
    );
  });
});

describe("unknown collections", () => {
  it("are denied", async () => {
    await assertFails(getDoc(doc(db(ALICE), "users", ALICE)));
    await assertFails(setDoc(doc(db(ALICE), "users", ALICE), { a: 1 }));
    await assertFails(
      setDoc(doc(db(ALICE), "competitions", COMP, "messages", "m1"), { a: 1 }),
    );
  });
});

describe("competitions", () => {
  it("signed-in users can list and read competitions", async () => {
    await seedCompetition();
    await assertSucceeds(getDocs(query(collection(db(BOB), "competitions"))));
    await assertSucceeds(getDoc(doc(db(BOB), "competitions", COMP)));
  });

  it("allows creating a competition exactly as the app does", async () => {
    await assertSucceeds(
      addDoc(collection(db(ALICE), "competitions"), newCompetition(ALICE)),
    );
  });

  it("allows creating a code-access competition with an access code", async () => {
    await assertSucceeds(
      addDoc(
        collection(db(ALICE), "competitions"),
        newCompetition(ALICE, { accessType: "code", accessCode: "ABC123" }),
      ),
    );
  });

  it("allows tasks whose points are strings (number inputs yield strings)", async () => {
    await assertSucceeds(
      addDoc(
        collection(db(ALICE), "competitions"),
        newCompetition(ALICE, {
          tasks: [{ id: "T", name: "x", points: "15", frequency: "once" }],
        }),
      ),
    );
  });

  it("rejects a competition created on behalf of someone else", async () => {
    await assertFails(
      addDoc(collection(db(MALLORY), "competitions"), newCompetition(ALICE)),
    );
    await assertFails(
      addDoc(
        collection(db(MALLORY), "competitions"),
        newCompetition(MALLORY, { adminIds: [MALLORY, ALICE] }),
      ),
    );
  });

  it("rejects bad initial counters, extra fields and bad types", async () => {
    const f = db(ALICE);
    const col = collection(f, "competitions");
    await assertFails(addDoc(col, newCompetition(ALICE, { participantCount: 5 })));
    await assertFails(addDoc(col, newCompetition(ALICE, { participantIds: [BOB] })));
    await assertFails(addDoc(col, newCompetition(ALICE, { isFeatured: true })));
    await assertFails(addDoc(col, newCompetition(ALICE, { name: "" })));
    await assertFails(addDoc(col, newCompetition(ALICE, { name: 42 })));
    await assertFails(addDoc(col, newCompetition(ALICE, { accessType: "secret" })));
    await assertFails(addDoc(col, newCompetition(ALICE, { tasks: "nope" })));
    await assertFails(
      addDoc(col, newCompetition(ALICE, { createdAt: new Date("2020-01-01") })),
    );
  });

  describe("joining", () => {
    beforeEach(seedCompetition);

    it("allows the app's join flow (participant doc, then counters)", async () => {
      const f = db(BOB);
      await assertSucceeds(
        setDoc(doc(f, "competitions", COMP, "participants", BOB), {
          displayName: "Bob",
          joinedAt: serverTimestamp(),
          score: 0,
        }),
      );
      await assertSucceeds(
        updateDoc(doc(f, "competitions", COMP), {
          participantIds: arrayUnion(BOB),
          participantCount: increment(1),
        }),
      );
    });

    it("allows a second user to join after the first", async () => {
      await seedJoined(BOB);
      await seedParticipant(MALLORY);
      await assertSucceeds(
        updateDoc(doc(db(MALLORY), "competitions", COMP), {
          participantIds: arrayUnion(MALLORY),
          participantCount: increment(1),
        }),
      );
    });

    it("rejects updating counters without a participant doc", async () => {
      await assertFails(
        updateDoc(doc(db(BOB), "competitions", COMP), {
          participantIds: arrayUnion(BOB),
          participantCount: increment(1),
        }),
      );
    });

    it("rejects adding someone else to participantIds", async () => {
      await seedParticipant(BOB);
      await assertFails(
        updateDoc(doc(db(BOB), "competitions", COMP), {
          participantIds: arrayUnion(MALLORY),
          participantCount: increment(1),
        }),
      );
      await assertFails(
        updateDoc(doc(db(BOB), "competitions", COMP), {
          participantIds: arrayUnion(BOB, MALLORY),
          participantCount: increment(2),
        }),
      );
    });

    it("rejects inflating participantCount or joining twice", async () => {
      await seedParticipant(BOB);
      await assertFails(
        updateDoc(doc(db(BOB), "competitions", COMP), {
          participantIds: arrayUnion(BOB),
          participantCount: increment(10),
        }),
      );
      await seedJoined(BOB);
      await assertFails(
        updateDoc(doc(db(BOB), "competitions", COMP), {
          participantCount: increment(1),
        }),
      );
    });

    it("rejects removing other participants", async () => {
      await seedJoined(MALLORY);
      await seedParticipant(BOB);
      await assertFails(
        updateDoc(doc(db(BOB), "competitions", COMP), {
          participantIds: [BOB],
          participantCount: increment(1),
        }),
      );
    });
  });

  it("rejects changing protected competition fields, even by the creator", async () => {
    await seedCompetition();
    const ref = (uid) => doc(db(uid), "competitions", COMP);
    await assertFails(updateDoc(ref(MALLORY), { adminIds: [ALICE, MALLORY] }));
    await assertFails(updateDoc(ref(MALLORY), { creatorId: MALLORY }));
    await assertFails(updateDoc(ref(MALLORY), { name: "Hijacked" }));
    await assertFails(updateDoc(ref(MALLORY), { tasks: [] }));
    // The app has no edit UI, so the creator cannot edit either (yet).
    await assertFails(updateDoc(ref(ALICE), { name: "Renamed" }));
  });

  it("rejects deleting a competition", async () => {
    await seedCompetition();
    await assertFails(deleteDoc(doc(db(MALLORY), "competitions", COMP)));
    await assertFails(deleteDoc(doc(db(ALICE), "competitions", COMP)));
  });
});

describe("participants", () => {
  beforeEach(seedCompetition);

  it("signed-in users can read the participant list (leaderboard)", async () => {
    await seedParticipant(BOB, 30);
    await assertSucceeds(
      getDocs(collection(db(MALLORY), "competitions", COMP, "participants")),
    );
  });

  it("allows a participant doc with a null displayName", async () => {
    await assertSucceeds(
      setDoc(doc(db(BOB), "competitions", COMP, "participants", BOB), {
        displayName: null,
        joinedAt: serverTimestamp(),
        score: 0,
      }),
    );
  });

  it("rejects creating a participant doc for another user", async () => {
    await assertFails(
      setDoc(doc(db(MALLORY), "competitions", COMP, "participants", BOB), {
        displayName: "Bob",
        joinedAt: serverTimestamp(),
        score: 0,
      }),
    );
  });

  it("rejects joining with a non-zero starting score or extra fields", async () => {
    const ref = doc(db(BOB), "competitions", COMP, "participants", BOB);
    await assertFails(
      setDoc(ref, { displayName: "Bob", joinedAt: serverTimestamp(), score: 999 }),
    );
    await assertFails(
      setDoc(ref, {
        displayName: "Bob",
        joinedAt: serverTimestamp(),
        score: 0,
        isAdmin: true,
      }),
    );
  });

  it("rejects joining a competition that does not exist", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "competitions", "nope", "participants", BOB), {
        displayName: "Bob",
        joinedAt: serverTimestamp(),
        score: 0,
      }),
    );
  });

  it("rejects re-joining (overwriting) an existing participant doc", async () => {
    await seedParticipant(BOB, 50);
    await assertFails(
      setDoc(doc(db(BOB), "competitions", COMP, "participants", BOB), {
        displayName: "Bob",
        joinedAt: serverTimestamp(),
        score: 0,
      }),
    );
  });

  it("allows incrementing and decrementing your own score", async () => {
    await seedParticipant(BOB, 10);
    const ref = doc(db(BOB), "competitions", COMP, "participants", BOB);
    await assertSucceeds(updateDoc(ref, { score: increment(10) }));
    await assertSucceeds(updateDoc(ref, { score: increment(-10) }));
  });

  it("rejects changing another user's score", async () => {
    await seedParticipant(BOB, 10);
    await assertFails(
      updateDoc(doc(db(MALLORY), "competitions", COMP, "participants", BOB), {
        score: increment(-10),
      }),
    );
  });

  it("rejects changing fields other than score", async () => {
    await seedParticipant(BOB, 10);
    const ref = doc(db(BOB), "competitions", COMP, "participants", BOB);
    await assertFails(updateDoc(ref, { displayName: "Someone else" }));
    await assertFails(updateDoc(ref, { joinedAt: new Date("2020-01-01") }));
    await assertFails(updateDoc(ref, { score: "lots" }));
  });

  it("rejects deleting participant docs", async () => {
    await seedParticipant(BOB, 10);
    await assertFails(
      deleteDoc(doc(db(BOB), "competitions", COMP, "participants", BOB)),
    );
    await assertFails(
      deleteDoc(doc(db(MALLORY), "competitions", COMP, "participants", BOB)),
    );
  });
});

describe("teams", () => {
  beforeEach(seedCompetition);

  it("signed-in users can read teams", async () => {
    await seed((f) =>
      setDoc(doc(f, "competitions", COMP, "teams", "t1"), { name: "Red", score: 0 }),
    );
    await assertSucceeds(
      getDocs(collection(db(BOB), "competitions", COMP, "teams")),
    );
  });

  it("no client can write teams", async () => {
    await assertFails(
      setDoc(doc(db(ALICE), "competitions", COMP, "teams", "t1"), { name: "Red" }),
    );
    await assertFails(
      addDoc(collection(db(BOB), "competitions", COMP, "teams"), { name: "Blue" }),
    );
  });
});

describe("entries", () => {
  beforeEach(async () => {
    await seedCompetition();
    await seedJoined(BOB);
    await seedJoined(MALLORY);
  });

  it("allows the app's check flow: create entry, then bump own score", async () => {
    const f = db(BOB);
    await assertSucceeds(
      setDoc(doc(f, "competitions", COMP, "entries", entryId(BOB)), newEntry(BOB)),
    );
    await assertSucceeds(
      updateDoc(doc(f, "competitions", COMP, "participants", BOB), {
        score: increment(10),
      }),
    );
  });

  it("allows one-and-done entries keyed by <uid>_<taskId>", async () => {
    await assertSucceeds(
      setDoc(
        doc(db(BOB), "competitions", COMP, "entries", `${BOB}_TASK0001`),
        newEntry(BOB),
      ),
    );
  });

  it("allows the app's uncheck flow: get, delete, decrement score", async () => {
    await seedEntry(BOB);
    const f = db(BOB);
    const ref = doc(f, "competitions", COMP, "entries", entryId(BOB));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(deleteDoc(ref));
    await assertSucceeds(
      updateDoc(doc(f, "competitions", COMP, "participants", BOB), {
        score: increment(-10),
      }),
    );
  });

  it("allows getting your own entry id even if it does not exist yet", async () => {
    await assertSucceeds(
      getDoc(doc(db(BOB), "competitions", COMP, "entries", entryId(BOB))),
    );
  });

  it("allows the app's own-entries query", async () => {
    await seedEntry(BOB);
    await assertSucceeds(
      getDocs(
        query(
          collection(db(BOB), "competitions", COMP, "entries"),
          where("userId", "==", BOB),
        ),
      ),
    );
  });

  it("rejects reading other users' entries", async () => {
    await seedEntry(BOB);
    const f = db(MALLORY);
    await assertFails(getDoc(doc(f, "competitions", COMP, "entries", entryId(BOB))));
    await assertFails(getDocs(collection(f, "competitions", COMP, "entries")));
    await assertFails(
      getDocs(
        query(
          collection(f, "competitions", COMP, "entries"),
          where("userId", "==", BOB),
        ),
      ),
    );
  });

  it("rejects writing an entry for another user", async () => {
    const f = db(MALLORY);
    // userId set to the victim
    await assertFails(
      setDoc(doc(f, "competitions", COMP, "entries", entryId(BOB)), newEntry(BOB)),
    );
    // own userId but the victim's doc id
    await assertFails(
      setDoc(
        doc(f, "competitions", COMP, "entries", entryId(BOB)),
        newEntry(MALLORY),
      ),
    );
  });

  it("rejects entries whose id does not match the task/date", async () => {
    await assertFails(
      setDoc(
        doc(db(BOB), "competitions", COMP, "entries", `${BOB}_OTHER_2026-03-02`),
        newEntry(BOB),
      ),
    );
    await assertFails(
      addDoc(collection(db(BOB), "competitions", COMP, "entries"), newEntry(BOB)),
    );
  });

  it("rejects entries from non-participants", async () => {
    await assertFails(
      setDoc(
        doc(db(ALICE), "competitions", COMP, "entries", entryId(ALICE)),
        newEntry(ALICE),
      ),
    );
  });

  it("rejects entries with extra fields or bad types", async () => {
    const ref = doc(db(BOB), "competitions", COMP, "entries", entryId(BOB));
    await assertFails(setDoc(ref, newEntry(BOB, { verified: true })));
    await assertFails(setDoc(ref, newEntry(BOB, { pointsAwarded: "10" })));
    await assertFails(
      setDoc(ref, newEntry(BOB, { completedAt: new Date("2020-01-01") })),
    );
  });

  it("rejects modifying an existing entry (even your own)", async () => {
    await seedEntry(BOB);
    const ref = doc(db(BOB), "competitions", COMP, "entries", entryId(BOB));
    await assertFails(updateDoc(ref, { pointsAwarded: 1000 }));
    await assertFails(setDoc(ref, newEntry(BOB, { pointsAwarded: 1000 })));
  });

  it("rejects deleting another user's entry", async () => {
    await seedEntry(BOB);
    await assertFails(
      deleteDoc(doc(db(MALLORY), "competitions", COMP, "entries", entryId(BOB))),
    );
  });
});
