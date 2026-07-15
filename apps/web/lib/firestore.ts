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
} from '@jobman/shared/src/types';

export const JOBS_PAGE_SIZE = 20;

// ── Jobs ──────────────────────────────────────────────────────────────────

export async function createJob(data: Omit<JobListing, 'id' | 'applicantCount' | 'createdAt'>) {
  const ref = await addDoc(collection(db, 'jobs'), {
    ...data,
    applicantCount: 0,
    createdAt: serverTimestamp(),
  });
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
    jobs: snap.docs.map(d => ({ id: d.id, ...d.data() } as JobListing)),
    lastDoc: snap.docs.length === JOBS_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
  };
}

export async function getJob(id: string) {
  const snap = await getDoc(doc(db, 'jobs', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as JobListing) : null;
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
