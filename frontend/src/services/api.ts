export type VerificationStatus = 'REJECTED' | 'REVIEW' | 'LIKELY_APPROVED' | 'INVALID_INPUT';

export interface CandidateBreakdown {
  candidate_id: number;
  candidate_title: string;
  edit_similarity: number;
  phonetic_similarity: number;
  semantic_similarity: number;
  token_overlap_similarity: number;
  combined_similarity: number;
  full_title_phonetic_overlap?: boolean;
  token_phonetic_similarity?: number;
  candidate_status?: string;
  retrieval_sources?: string[];
}

export interface VerifyResponse {
  status: VerificationStatus;
  verification_probability: number | null;
  reasons: string[];
  closest_match: string | null;
  closest_match_status: string | null;
  closest_match_breakdown: CandidateBreakdown | null;
  top_conflicts: string[];
  candidate_count: number;
  requires_manual_semantic_review: boolean;
  from_cache: boolean;
  disclaimer: string;
}

export interface RegisterPendingResponse {
  registered: boolean;
  id?: number;
  title_normalized?: string;
  status?: string;
  verification?: VerifyResponse;
  error?: string;
  reasons?: string[];
  disclaimer?: string;
}

export interface HealthResponse {
  status: string;
  database_ready: boolean;
  total_titles: number;
  registered_titles: number;
  pending_titles: number;
  embedding_model_loaded: boolean;
  embedding_dim: number;
}

export interface PendingSubmission {
  title: string;
  language: string;
  state: string;
  periodicity: string;
}

const API_BASE = '/api';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const message =
      (data as { error?: string })?.error ||
      (data as { status?: string })?.status ||
      'Backend request failed';
    throw new Error(message);
  }
  return data as T;
}

export async function verifyTitle(title: string): Promise<VerifyResponse> {
  return post<VerifyResponse>('/verify-title', { title });
}

export async function registerPending(submission: PendingSubmission): Promise<RegisterPendingResponse> {
  return post<RegisterPendingResponse>('/register-pending', submission);
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json() as Promise<HealthResponse>;
}

export interface PendingApplicationRecord {
  id: number;
  ref_number: string;
  title: string;
  title_normalized: string;
  language: string;
  state: string;
  periodicity: string;
  status: string;
  created_at: string;
}

export interface GetPendingApplicationsResponse {
  success: boolean;
  applications: PendingApplicationRecord[];
  count: number;
  error?: string;
}

export interface TrackApplicationResponse {
  success: boolean;
  results: PendingApplicationRecord[];
  count: number;
  error?: string;
}

export async function getPendingApplications(): Promise<GetPendingApplicationsResponse> {
  const res = await fetch(`${API_BASE}/pending-applications`);
  if (!res.ok) throw new Error('Failed to fetch pending applications');
  return res.json() as Promise<GetPendingApplicationsResponse>;
}

export async function getAllApplications(status = 'all'): Promise<GetPendingApplicationsResponse> {
  const res = await fetch(`${API_BASE}/all-applications?status=${encodeURIComponent(status)}`);
  if (!res.ok) throw new Error('Failed to fetch applications');
  return res.json() as Promise<GetPendingApplicationsResponse>;
}

export async function trackApplication(query: string): Promise<TrackApplicationResponse> {
  const res = await fetch(`${API_BASE}/track-application?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to track application');
  return res.json() as Promise<TrackApplicationResponse>;
}

export async function updateApplicationStatus(id: number | undefined, ref_number: string, status: 'pending' | 'registered' | 'rejected'): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/update-application-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ref_number, status }),
  });
  if (!res.ok) throw new Error('Failed to update application status');
  return res.json();
}