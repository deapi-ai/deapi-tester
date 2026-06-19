import { Job } from './types';
import { cleanupOrphanUploads, deleteAllUploads } from './upload-storage';
import * as fs from 'fs';
import * as path from 'path';

const HISTORY_PATH = path.join(process.cwd(), 'data', 'history.json');
const MAX_HISTORY_SIZE = 1000;

// Ensure data directory exists
function ensureDataDir(): void {
  const dataDir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load all jobs from history
export function loadHistory(): Job[] {
  try {
    ensureDataDir();

    if (!fs.existsSync(HISTORY_PATH)) {
      fs.writeFileSync(HISTORY_PATH, '[]', 'utf-8');
      return [];
    }

    const content = fs.readFileSync(HISTORY_PATH, 'utf-8');
    return JSON.parse(content) as Job[];
  } catch (error) {
    console.error('[deapi-tester] Error loading history:', error);
    return [];
  }
}

// Save history to file (atomic write)
function saveHistory(jobs: Job[]): void {
  try {
    ensureDataDir();

    // Enforce max size (FIFO - remove oldest)
    const trimmedJobs = jobs.length > MAX_HISTORY_SIZE
      ? jobs.slice(-MAX_HISTORY_SIZE)
      : jobs;

    // Atomic write: write to temp, then rename
    const tempPath = HISTORY_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(trimmedJobs, null, 2), 'utf-8');
    fs.renameSync(tempPath, HISTORY_PATH);
  } catch (error) {
    console.error('[deapi-tester] Error saving history:', error);
    throw error;
  }
}

// Add a new job to history
export function addJob(job: Job): Job {
  const history = loadHistory();
  history.push(job);
  saveHistory(history);
  return job;
}

// Update an existing job
export function updateJob(id: string, updates: Partial<Job>): Job | null {
  const history = loadHistory();
  const index = history.findIndex(j => j.id === id);

  if (index === -1) {
    return null;
  }

  history[index] = { ...history[index], ...updates };
  saveHistory(history);
  return history[index];
}

// Get a job by ID
export function getJob(id: string): Job | null {
  const history = loadHistory();
  return history.find(j => j.id === id) || null;
}

// Get a job by request_id (deAPI's ID)
export function getJobByRequestId(requestId: string): Job | null {
  const history = loadHistory();
  return history.find(j => j.requestId === requestId) || null;
}

// Delete a job by ID
export function deleteJob(id: string): boolean {
  const history = loadHistory();
  const index = history.findIndex(j => j.id === id);

  if (index === -1) {
    return false;
  }

  const [removed] = history.splice(index, 1);
  saveHistory(history);
  // Remove uploaded files this job referenced, unless another job still uses them
  cleanupOrphanUploads(removed, history);
  return true;
}

// Clear all history
export function clearHistory(): void {
  saveHistory([]);
  deleteAllUploads();
}

// Get jobs filtered by status
export function getJobsByStatus(status: Job['status']): Job[] {
  const history = loadHistory();
  return history.filter(j => j.status === status);
}

// Get jobs filtered by endpoint
export function getJobsByEndpoint(endpointId: string): Job[] {
  const history = loadHistory();
  return history.filter(j => j.endpointId === endpointId);
}

// Generate unique ID for new jobs
export function generateJobId(): string {
  return crypto.randomUUID();
}
