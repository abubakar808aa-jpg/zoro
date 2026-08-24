import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
  deleteDoc, increment, Timestamp, startAfter,
  type QueryDocumentSnapshot, type DocumentData,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import type {
  JobListing, GigProfile, ProfessionalProfile, Message, Conversation,
  Application, ApplicationStatus, JobStatus,
  Follow, FeedEvent, Report, User, CreateServiceRequestInput, WorkerGigPreferences,
} from '@jobman/shared/src/types';

export const JOBS_PAGE_SIZE = 20;
const DISCOVERY_SAMPLE_SIZE = 5;
const DISCOVERY_PROVIDERS = ['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'recruitee'] as const;

// ── Jobs ──────────────────────────────────────────────────────────────────

export async function createJob(data: Omit<JobListing, 'id' | 'applicantCount' | 'createdAt'>) {
  const ref = await addDoc(collection(db, 'jobs'), {
    ...data,
    applicantCount: 0,
    createdAt: serverTimestamp(),
  });
  createActivity({
    actorId: data.postedBy,
    actorName: data.postedByName,
    actorPhoto: data.postedByPhoto ?? '',
    type: 'job_posted',
    payload: { jobId: ref.id, jobTitle: data.title },
  }).catch(() => {});  // feed write is best-effort; never block posting
  return ref.id;
}

export async function getJobs(
  filters?: { type?: string },
  cursor?: QueryDocumentSnapshot<DocumentData> | null
): Promise<{ jobs: JobListing[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  const constraints: any[] = [where('status', '==', 'open')];
  if (filters?.type) constraints.push(where('type', '==', filters.type));
  constraints.push(orderBy('createdAt', 'desc'));
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(JOBS_PAGE_SIZE));

  const snap = await getDocs(query(collection(db, 'jobs'), ...constraints));
  return {
    jobs: snap.docs.map(d => ({ ...d.data(), id: d.id } as JobListing)),
    lastDoc: snap.docs.length === JOBS_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
  };
}

function jobTimestamp(job: JobListing) {
  const value = job.lastSeenAt || job.createdAt;
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return Number((value as unknown as { toMillis: () => number }).toMillis());
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    return Number((value as unknown as { seconds: number }).seconds) * 1_000;
  }
  const parsed = Date.parse(String(value || ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function diversifyByCompany(jobs: JobListing[]) {
  const groups = new Map<string, JobListing[]>();
  for (const job of jobs) {
    const company = job.postedByName.trim().toLowerCase() || 'unknown';
    const group = groups.get(company) ?? [];
    group.push(job);
    groups.set(company, group);
  }

  const pools = Array.from(groups.values())
    .map(group => group.sort((a, b) => jobTimestamp(b) - jobTimestamp(a)))
    .sort((a, b) => jobTimestamp(b[0]) - jobTimestamp(a[0]));
  const diversified: JobListing[] = [];
  while (pools.some(pool => pool.length)) {
    for (const pool of pools) {
      const next = pool.shift();
      if (next) diversified.push(next);
    }
  }
  return diversified;
}

// The newest batch can be dominated by one large ATS import. Blend a small
// sample from every supported provider into the first page, then interleave by
// company so users see an actual marketplace instead of one employer wall.
export async function getDiscoveryJobs(filters?: { type?: string }) {
  const recentRequest = getJobs(filters);
  const providerRequests = DISCOVERY_PROVIDERS.map(provider => {
    const constraints: any[] = [
      where('status', '==', 'open'),
      where('sourceProvider', '==', provider),
    ];
    if (filters?.type) constraints.push(where('type', '==', filters.type));
    constraints.push(limit(DISCOVERY_SAMPLE_SIZE));
    return getDocs(query(collection(db, 'jobs'), ...constraints));
  });

  const [recent, ...providerSnapshots] = await Promise.all([recentRequest, ...providerRequests]);
  const unique = new Map(recent.jobs.map(job => [job.id, job]));
  for (const snapshot of providerSnapshots) {
    for (const document of snapshot.docs) {
      unique.set(document.id, { ...document.data(), id: document.id } as JobListing);
    }
  }

  return {
    jobs: diversifyByCompany(Array.from(unique.values())),
    lastDoc: recent.lastDoc,
  };
}
// Boosted jobs are queried separately (not merged into the paginated query):
// orderBy('boosted') would exclude every job doc that predates the field.
export async function getBoostedJobs(): Promise<JobListing[]> {
  const snap = await getDocs(query(
    collection(db, 'jobs'),
    where('status', '==', 'open'),
    where('boosted', '==', true),
    orderBy('createdAt', 'desc'),
    limit(10),
  ));
  const now = Date.now();
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as JobListing))
    .filter(j => {
      const until = j.boostedUntil as unknown as Timestamp | undefined;
      return until ? until.toMillis() > now : false;
    });
}

export async function getJob(id: string) {
  const snap = await getDoc(doc(db, 'jobs', id));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as JobListing) : null;
}

export async function updateJob(id: string, data: Partial<Omit<JobListing, 'id'>>) {
  await updateDoc(doc(db, 'jobs', id), data as DocumentData);
}

export async function setJobStatus(id: string, status: JobStatus) {
  await updateDoc(doc(db, 'jobs', id), { status });
}

export async function deleteJob(id: string) {
  await deleteDoc(doc(db, 'jobs', id));
}

// ── Applications ──────────────────────────────────────────────────────────

export async function applyToJob(
  job: Pick<JobListing, 'id' | 'title' | 'postedBy'>,
  applicantId: string,
  applicantName: string,
  coverLetter: string
) {
  const dup = await getDocs(query(
    collection(db, 'applications'),
    where('jobId', '==', job.id),
    where('applicantId', '==', applicantId),
  ));
  if (!dup.empty) throw new Error('You have already applied to this job.');

  await addDoc(collection(db, 'applications'), {
    jobId: job.id,
    jobTitle: job.title,
    jobPostedBy: job.postedBy,
    applicantId, applicantName, coverLetter,
    status: 'pending',
    appliedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'jobs', job.id), { applicantCount: increment(1) });
}

export async function getApplicationsForJob(jobId: string) {
  const snap = await getDocs(query(
    collection(db, 'applications'),
    where('jobId', '==', jobId),
    orderBy('appliedAt', 'desc'),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Application));
}

export async function getMyApplications(applicantId: string) {
  const snap = await getDocs(query(
    collection(db, 'applications'),
    where('applicantId', '==', applicantId),
    orderBy('appliedAt', 'desc'),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Application));
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus) {
  await updateDoc(doc(db, 'applications', id), { status });
}

// ── Home services ─────────────────────────────────────────────────────────

export async function createServiceRequest(data: CreateServiceRequestInput) {
  const requestRef = await addDoc(collection(db, 'serviceRequests'), {
    ...data,
    status: 'open',
    createdAt: serverTimestamp(),
  });
  return requestRef.id;
}

export async function getWorkerGigPreferences(uid: string) {
  const snap = await getDoc(doc(db, 'workerGigPreferences', uid));
  return snap.exists() ? snap.data() as WorkerGigPreferences : null;
}

export async function saveWorkerGigPreferences(
  uid: string,
  data: Pick<WorkerGigPreferences, 'serviceArea' | 'serviceRadiusMiles' | 'minimumHourlyTakeHome'>,
) {
  await setDoc(doc(db, 'workerGigPreferences', uid), {
    ...data,
    workerId: uid,
    updatedAt: serverTimestamp(),
  });
}

// ── Profiles ─────────────────────────────────────────────────────────────

export async function saveGigProfile(uid: string, data: Omit<GigProfile, 'uid' | 'type' | 'rating' | 'reviewCount' | 'createdAt' | 'portfolioUrls'> & { portfolioUrls?: string[] }) {
  const existing = await getDoc(doc(db, 'profiles', uid));
  if (existing.exists()) {
    // Editing: keep rating/reviewCount/createdAt intact
    await setDoc(doc(db, 'profiles', uid), { ...data, uid, type: 'gig' }, { merge: true });
  } else {
    await setDoc(doc(db, 'profiles', uid), {
      portfolioUrls: [], ...data, uid, type: 'gig', rating: 0, reviewCount: 0, createdAt: serverTimestamp(),
    });
    createActivity({
      actorId: uid, actorName: data.name, actorPhoto: data.photoURL ?? '',
      type: 'joined', payload: { role: data.category },
    }).catch(() => {});
  }
}

export async function saveProfessionalProfile(uid: string, data: Omit<ProfessionalProfile, 'uid' | 'type' | 'rating' | 'reviewCount' | 'createdAt'>) {
  const existing = await getDoc(doc(db, 'profiles', uid));
  if (existing.exists()) {
    await setDoc(doc(db, 'profiles', uid), { ...data, uid, type: 'professional' }, { merge: true });
  } else {
    await setDoc(doc(db, 'profiles', uid), {
      ...data, uid, type: 'professional', rating: 0, reviewCount: 0, createdAt: serverTimestamp(),
    });
    createActivity({
      actorId: uid, actorName: data.name, actorPhoto: data.photoURL ?? '',
      type: 'joined', payload: { role: data.title },
    }).catch(() => {});
  }
}

export async function getProfile(uid: string) {
  const snap = await getDoc(doc(db, 'profiles', uid));
  return snap.exists() ? snap.data() as GigProfile | ProfessionalProfile : null;
}

export async function getGigProfiles(category?: string) {
  const constraints: any[] = [where('type', '==', 'gig'), orderBy('rating', 'desc'), limit(50)];
  if (category) constraints.splice(1, 0, where('category', '==', category));
  const snap = await getDocs(query(collection(db, 'profiles'), ...constraints));
  return snap.docs.map(d => d.data() as GigProfile);
}

export async function getProfessionalProfiles(category?: string) {
  const constraints: any[] = [where('type', '==', 'professional'), orderBy('rating', 'desc'), limit(50)];
  if (category) constraints.splice(1, 0, where('category', '==', category));
  const snap = await getDocs(query(collection(db, 'profiles'), ...constraints));
  return snap.docs.map(d => d.data() as ProfessionalProfile);
}

// ── Messaging ─────────────────────────────────────────────────────────────

export async function getOrCreateConversation(
  uid1: string, uid2: string,
  names: Record<string, string>, photos: Record<string, string>
): Promise<string> {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', uid1)
  );
  const snap = await getDocs(q);
  const existing = snap.docs.find(d => d.data().participants.includes(uid2));
  if (existing) return existing.id;

  const ref = await addDoc(collection(db, 'conversations'), {
    participants: [uid1, uid2],
    participantNames: names,
    participantPhotos: photos,
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    lastSenderId: '',
  });
  return ref.id;
}

export function subscribeToConversations(uid: string, cb: (convos: Conversation[]) => void) {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', uid),
    orderBy('lastMessageAt', 'desc')
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation)));
  });
}

export async function markConversationRead(conversationId: string, uid: string) {
  await updateDoc(doc(db, 'conversations', conversationId), {
    [`lastRead.${uid}`]: serverTimestamp(),
  });
}

export function subscribeToMessages(conversationId: string, cb: (msgs: Message[]) => void) {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
  });
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  file?: File
) {
  let fileUrl = '';
  let fileName = '';
  let fileType: 'image' | 'document' | 'none' = 'none';

  if (file) {
    const storageRef = ref(storage, `messages/${conversationId}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    fileUrl = await getDownloadURL(storageRef);
    fileName = file.name;
    fileType = file.type.startsWith('image/') ? 'image' : 'document';
  }

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    senderId, text, fileUrl, fileName, fileType,
    createdAt: serverTimestamp(),
    read: false,
  });

  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: text || fileName,
    lastMessageAt: serverTimestamp(),
    lastSenderId: senderId,
  });
}

// ── Storage ───────────────────────────────────────────────────────────────

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  const storageRef = ref(storage, `profiles/${uid}/photo`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ── Social: follows ───────────────────────────────────────────────────────

export async function followUser(
  followerId: string,
  followed: { uid: string; name: string; photoURL?: string }
) {
  await setDoc(doc(db, 'follows', `${followerId}_${followed.uid}`), {
    followerId,
    followedId: followed.uid,
    followedName: followed.name,
    followedPhoto: followed.photoURL ?? '',
    createdAt: serverTimestamp(),
  });
}

export async function unfollowUser(followerId: string, followedId: string) {
  await deleteDoc(doc(db, 'follows', `${followerId}_${followedId}`));
}

export async function isFollowing(followerId: string, followedId: string) {
  const snap = await getDoc(doc(db, 'follows', `${followerId}_${followedId}`));
  return snap.exists();
}

export async function getFollowing(uid: string): Promise<Follow[]> {
  const snap = await getDocs(query(
    collection(db, 'follows'),
    where('followerId', '==', uid),
    orderBy('createdAt', 'desc'),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Follow));
}

export async function getFollowerCount(uid: string): Promise<number> {
  const snap = await getDocs(query(
    collection(db, 'follows'),
    where('followedId', '==', uid),
  ));
  return snap.size;
}

// ── Social: activity feed ─────────────────────────────────────────────────

export async function createActivity(event: Omit<FeedEvent, 'id' | 'createdAt'>) {
  await addDoc(collection(db, 'activities'), {
    ...event,
    createdAt: serverTimestamp(),
  });
}

// Firestore 'in' supports max 30 values; chunk the following list.
export async function getFeed(followingUids: string[], selfUid: string): Promise<FeedEvent[]> {
  const uids = Array.from(new Set([selfUid, ...followingUids]));
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));

  const results = await Promise.all(chunks.map(chunk =>
    getDocs(query(
      collection(db, 'activities'),
      where('actorId', 'in', chunk),
      orderBy('createdAt', 'desc'),
      limit(30),
    ))
  ));
  const events = results.flatMap(snap =>
    snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedEvent))
  );
  events.sort((a, b) => {
    const ta = (a.createdAt as unknown as Timestamp)?.toMillis?.() ?? 0;
    const tb = (b.createdAt as unknown as Timestamp)?.toMillis?.() ?? 0;
    return tb - ta;
  });
  return events.slice(0, 30);
}

export async function deleteActivity(id: string) {
  await deleteDoc(doc(db, 'activities', id));
}

// ── Moderation: reports ───────────────────────────────────────────────────

export async function reportContent(report: Omit<Report, 'id' | 'createdAt' | 'resolved'>) {
  await addDoc(collection(db, 'reports'), {
    ...report,
    resolved: false,
    createdAt: serverTimestamp(),
  });
}

export async function getOpenReports(): Promise<Report[]> {
  const snap = await getDocs(query(
    collection(db, 'reports'),
    where('resolved', '==', false),
    orderBy('createdAt', 'desc'),
    limit(100),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Report));
}

// ── Admin (client reads; mutations go through /api/admin with server-side checks) ──

export async function getUserDoc(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ({ uid: snap.id, ...snap.data() } as User) : null;
}

export const USERS_PAGE_SIZE = 50;

export async function getAllUsers(
  cursor?: QueryDocumentSnapshot<DocumentData> | null
): Promise<{ users: User[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  const constraints: any[] = [orderBy('createdAt', 'desc')];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(USERS_PAGE_SIZE));
  const snap = await getDocs(query(collection(db, 'users'), ...constraints));
  return {
    users: snap.docs.map(d => ({ uid: d.id, ...d.data() } as User)),
    lastDoc: snap.docs.length === USERS_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
  };
}

export async function getAllJobs(
  cursor?: QueryDocumentSnapshot<DocumentData> | null
): Promise<{ jobs: JobListing[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  const constraints: any[] = [orderBy('createdAt', 'desc')];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(JOBS_PAGE_SIZE));
  const snap = await getDocs(query(collection(db, 'jobs'), ...constraints));
  return {
    jobs: snap.docs.map(d => ({ ...d.data(), id: d.id } as JobListing)),
    lastDoc: snap.docs.length === JOBS_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
  };
}
