export type AccountType = 'worker' | 'employer';
export type ProfileType = 'gig' | 'professional';
export type JobType = 'gig' | 'fulltime' | 'parttime' | 'contract';
export type JobStatus = 'open' | 'closed';
export type JobSourceProvider = 'manual' | 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected';
export type MessageFileType = 'image' | 'document' | 'none';

export interface User {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  phone?: string;
  location?: string;
  accountType: AccountType;
  isAdmin?: boolean;
  banned?: boolean;
  bannedReason?: string;
  createdAt: Date;
}

export interface GigProfile {
  uid: string;
  type: 'gig';
  name: string;
  email?: string;
  bio: string;
  category: string;       // 'plumber' | 'electrician' | etc.
  skills: string[];
  location: string;
  hourlyRate: number;
  availability: string;   // 'available' | 'busy' | 'weekends'
  photoURL?: string;
  rating: number;
  reviewCount: number;
  portfolioUrls: string[];
  createdAt: Date;
}

export interface ProfessionalProfile {
  uid: string;
  type: 'professional';
  name: string;
  email?: string;
  bio: string;
  title: string;          // 'Software Engineer' | 'Accountant' etc.
  category: string;       // 'Technology' | 'Finance' etc.
  skills: string[];
  location: string;
  desiredSalary?: number;
  experienceYears: number;
  education: Education[];
  experience: Experience[];
  photoURL?: string;
  resumeUrl?: string;
  rating: number;
  reviewCount: number;
  createdAt: Date;
}

export interface Education {
  school: string;
  degree: string;
  field: string;
  from: string;
  to: string;
}

export interface Experience {
  company: string;
  title: string;
  from: string;
  to: string;
  current: boolean;
  description: string;
}

export interface JobListing {
  id: string;
  title: string;
  description: string;
  type: JobType;
  category: string;
  location: string;
  remote: boolean;
  salary?: { min: number; max: number; period: 'hourly' | 'annual' };
  requirements: string[];
  skills: string[];
  postedBy: string;       // uid
  postedByName: string;
  postedByPhoto?: string;
  status: JobStatus;
  applicantCount: number;
  boosted?: boolean;
  boostedUntil?: Date;
  genZTags?: GenZTag[];
  createdAt: Date;
  // Present only when JobMan indexes a public employer job board. These jobs
  // always route applicants to the employer's original application page.
  sourceProvider?: JobSourceProvider;
  sourceJobId?: string;
  sourceUrl?: string;
  applyUrl?: string;
  sourceUpdatedAt?: Date;
  lastSeenAt?: Date;
  isImported?: boolean;
}

export interface JobSource {
  id: string;
  provider: Exclude<JobSourceProvider, 'manual'>;
  boardToken: string;
  companyName: string;
  careersUrl?: string;
  active: boolean;
  lastFetchedAt?: Date;
  lastSuccessAt?: Date;
  lastError?: string;
}

export type GenZTag = 'remote-first' | 'flexible' | 'no-degree' | 'side-hustle' | 'mentorship';

export const GEN_Z_TAGS: { id: GenZTag; label: string; emoji: string }[] = [
  { id: 'remote-first', label: 'Remote-first', emoji: '🌍' },
  { id: 'flexible', label: 'Flexible hours', emoji: '⏰' },
  { id: 'no-degree', label: 'No degree required', emoji: '🎓' },
  { id: 'side-hustle', label: 'Side hustle OK', emoji: '💸' },
  { id: 'mentorship', label: 'Mentorship offered', emoji: '🌱' },
];

export interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  jobPostedBy: string;    // uid of the job's poster — used by security rules
  applicantId: string;
  applicantName: string;
  coverLetter: string;
  status: ApplicationStatus;
  appliedAt: Date;
}

export interface Conversation {
  id: string;
  participants: string[];   // [uid1, uid2]
  participantNames: Record<string, string>;
  participantPhotos: Record<string, string>;
  lastMessage: string;
  lastMessageAt: Date;
  lastSenderId: string;
  lastRead?: Record<string, Date>;  // per-participant timestamp of last time they opened the conversation
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  fileUrl?: string;
  fileName?: string;
  fileType: MessageFileType;
  createdAt: Date;
  read: boolean;
}

export interface Review {
  id: string;
  targetId: string;     // uid of person being reviewed
  reviewerId: string;
  reviewerName: string;
  reviewerPhoto?: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

// ── Social ────────────────────────────────────────────────────────────────

export interface Follow {
  id: string;           // `${followerId}_${followedId}` — makes follows idempotent
  followerId: string;
  followedId: string;
  followedName: string;
  followedPhoto?: string;
  createdAt: Date;
}

export type FeedEventType = 'job_posted' | 'hired' | 'joined' | 'tip';

export interface FeedEvent {
  id: string;
  actorId: string;
  actorName: string;
  actorPhoto?: string;
  type: FeedEventType;
  payload: Record<string, string>;  // job_posted: {jobId, jobTitle}; hired: {jobTitle}; tip: {text}
  createdAt: Date;
}

export interface NewsFeedItem {
  id: string;
  kind: 'news';
  headline: string;
  excerpt: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
}

export interface Report {
  id: string;
  targetType: 'job' | 'user' | 'activity';
  targetId: string;
  reporterId: string;
  reason: string;
  resolved?: boolean;
  createdAt: Date;
}
