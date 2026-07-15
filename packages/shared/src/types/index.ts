export type AccountType = 'worker' | 'employer';
export type ProfileType = 'gig' | 'professional';
export type JobType = 'gig' | 'fulltime' | 'parttime' | 'contract';
export type JobStatus = 'open' | 'closed';
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
  createdAt: Date;
}

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
