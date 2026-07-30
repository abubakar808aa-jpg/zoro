'use strict';

// Security-rules tests for firestore.rules. Run against the Firestore emulator
// via `firebase emulators:exec` (see the root `test:rules` script and
// .github/workflows/rules-tests.yml). Uses Node's built-in test runner.

const { readFileSync } = require('node:fs');
const path = require('node:path');
const { before, after, beforeEach, describe, test } = require('node:test');

const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  doc, getDoc, setDoc, updateDoc, addDoc, collection, deleteDoc,
} = require('firebase/firestore');

const PROJECT_ID = 'demo-jobman';
const RULES = readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');

let testEnv;

// Seed a document bypassing rules (setup only).
async function seed(pathStr, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), pathStr), data);
  });
}

const db = (uid) => testEnv.authenticatedContext(uid).firestore();

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: RULES, host: '127.0.0.1', port: 8080 },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// ── users: no self-granted admin / ban ──────────────────────────────────────
describe('users', () => {
  test('can create own profile', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice'), {
      uid: 'alice', name: 'Alice', email: 'a@x.com', accountType: 'worker',
    }));
  });

  test('cannot grant self admin at create', async () => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice'), {
      uid: 'alice', name: 'Alice', accountType: 'worker', isAdmin: true,
    }));
  });

  test('cannot ban self / anyone via update', async () => {
    await seed('users/alice', { uid: 'alice', name: 'Alice', accountType: 'worker' });
    await assertFails(updateDoc(doc(db('alice'), 'users/alice'), { banned: true }));
    await assertFails(updateDoc(doc(db('alice'), 'users/alice'), { isAdmin: true }));
  });

  test('cannot write another user doc', async () => {
    await assertFails(setDoc(doc(db('alice'), 'users/bob'), {
      uid: 'bob', name: 'Bob', accountType: 'worker',
    }));
  });

  test('can update own non-privileged fields', async () => {
    await seed('users/alice', { uid: 'alice', name: 'Alice', accountType: 'worker' });
    await assertSucceeds(updateDoc(doc(db('alice'), 'users/alice'), { name: 'Alice B.' }));
  });
});

// ── jobs: owner control, boost protection, applicantCount exception ──────────
describe('jobs', () => {
  const jobBase = {
    title: 'Barista', postedBy: 'emp', postedByName: 'Cafe',
    status: 'open', applicantCount: 0, type: 'parttime',
  };

  test('owner can create with own uid', async () => {
    await assertSucceeds(setDoc(doc(db('emp'), 'jobs/j1'), jobBase));
  });

  test('cannot create a job pre-boosted', async () => {
    await assertFails(setDoc(doc(db('emp'), 'jobs/j1'), { ...jobBase, boosted: true }));
  });

  test('cannot create a job owned by someone else', async () => {
    await assertFails(setDoc(doc(db('mallory'), 'jobs/j1'), jobBase));
  });

  test('non-owner may increment applicantCount by exactly 1', async () => {
    await seed('jobs/j1', jobBase);
    await assertSucceeds(updateDoc(doc(db('applicant'), 'jobs/j1'), { applicantCount: 1 }));
  });

  test('non-owner cannot jump applicantCount by 2', async () => {
    await seed('jobs/j1', jobBase);
    await assertFails(updateDoc(doc(db('applicant'), 'jobs/j1'), { applicantCount: 2 }));
  });

  test('non-owner cannot edit other fields', async () => {
    await seed('jobs/j1', jobBase);
    await assertFails(updateDoc(doc(db('applicant'), 'jobs/j1'), { title: 'Hacked' }));
  });

  test('owner cannot self-set boost fields', async () => {
    await seed('jobs/j1', jobBase);
    await assertFails(updateDoc(doc(db('emp'), 'jobs/j1'), { boosted: true }));
  });

  test('owner can edit normal fields', async () => {
    await seed('jobs/j1', jobBase);
    await assertSucceeds(updateDoc(doc(db('emp'), 'jobs/j1'), { title: 'Senior Barista' }));
  });
});

// ── applications: private to applicant + job poster ─────────────────────────
describe('applications', () => {
  const appBase = {
    jobId: 'j1', jobTitle: 'Barista', jobPostedBy: 'emp',
    applicantId: 'alice', applicantName: 'Alice', coverLetter: 'hi', status: 'pending',
  };

  test('applicant can create own pending application', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'applications/a1'), appBase));
  });

  test('cannot apply on behalf of someone else', async () => {
    await assertFails(setDoc(doc(db('mallory'), 'applications/a1'), appBase));
  });

  test('cannot create pre-accepted application', async () => {
    await assertFails(setDoc(doc(db('alice'), 'applications/a1'), { ...appBase, status: 'accepted' }));
  });

  test('applicant and poster can read; strangers cannot', async () => {
    await seed('applications/a1', appBase);
    await assertSucceeds(getDoc(doc(db('alice'), 'applications/a1')));
    await assertSucceeds(getDoc(doc(db('emp'), 'applications/a1')));
    await assertFails(getDoc(doc(db('bob'), 'applications/a1')));
  });

  test('only the poster may change status, and only status', async () => {
    await seed('applications/a1', appBase);
    await assertSucceeds(updateDoc(doc(db('emp'), 'applications/a1'), { status: 'accepted' }));
    await assertFails(updateDoc(doc(db('alice'), 'applications/a1'), { status: 'accepted' }));
    await assertFails(updateDoc(doc(db('emp'), 'applications/a1'), { coverLetter: 'tampered' }));
  });
});

// ── conversations + messages: participants only ─────────────────────────────
describe('conversations & messages', () => {
  test('participant can create a conversation; outsider cannot', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'conversations/c1'), {
      participants: ['alice', 'bob'],
    }));
    await assertFails(setDoc(doc(db('carol'), 'conversations/c1'), {
      participants: ['alice', 'bob'],
    }));
  });

  test('only participants read messages', async () => {
    await seed('conversations/c1', { participants: ['alice', 'bob'] });
    await seed('conversations/c1/messages/m1', { senderId: 'alice', text: 'hey' });
    await assertSucceeds(getDoc(doc(db('bob'), 'conversations/c1/messages/m1')));
    await assertFails(getDoc(doc(db('carol'), 'conversations/c1/messages/m1')));
  });

  test('message sender must be self and a participant', async () => {
    await seed('conversations/c1', { participants: ['alice', 'bob'] });
    await assertSucceeds(addDoc(collection(db('alice'), 'conversations/c1/messages'), {
      senderId: 'alice', text: 'hi',
    }));
    await assertFails(addDoc(collection(db('alice'), 'conversations/c1/messages'), {
      senderId: 'bob', text: 'spoofed',
    }));
    await assertFails(addDoc(collection(db('carol'), 'conversations/c1/messages'), {
      senderId: 'carol', text: 'intruder',
    }));
  });
});

// ── social: follows & activities owned by the actor ─────────────────────────
describe('follows & activities', () => {
  test('can only follow as yourself', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'follows/alice_bob'), {
      followerId: 'alice', followedId: 'bob',
    }));
    await assertFails(setDoc(doc(db('bob'), 'follows/alice_bob'), {
      followerId: 'alice', followedId: 'bob',
    }));
  });

  test('can only post activity as yourself', async () => {
    await assertSucceeds(addDoc(collection(db('alice'), 'activities'), {
      actorId: 'alice', type: 'tip', payload: { text: 'apply early' },
    }));
    await assertFails(addDoc(collection(db('alice'), 'activities'), {
      actorId: 'bob', type: 'tip', payload: { text: 'impersonation' },
    }));
  });
});

// ── reports: create as self, read only by admins ────────────────────────────
describe('reports', () => {
  const reportBase = {
    targetType: 'job', targetId: 'j1', reporterId: 'alice', reason: 'spam', resolved: false,
  };

  test('can file a report as yourself', async () => {
    await assertSucceeds(addDoc(collection(db('alice'), 'reports'), reportBase));
  });

  test('cannot file a report as someone else', async () => {
    await assertFails(addDoc(collection(db('mallory'), 'reports'), reportBase));
  });

  test('non-admins cannot read reports; admins can', async () => {
    await seed('reports/r1', reportBase);
    await seed('users/boss', { uid: 'boss', name: 'Boss', accountType: 'employer', isAdmin: true });
    await assertFails(getDoc(doc(db('bob'), 'reports/r1')));
    await assertSucceeds(getDoc(doc(db('boss'), 'reports/r1')));
  });
});
