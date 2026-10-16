export type Process = "Machining" | "Assembly" | "Trial" | "Design";
export type ProjectStatus = "Not Started" | "Ongoing" | "Completed" | "Archived";

export interface Project {
  id: string;
  name: string;
  process: Process;
  qr_token: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkSession {
  id: string;
  project_id: string;
  clock_in: string;
  clock_out: string | null;
  duration: string | null;
  clock_in_by: string | null;
  clock_out_by: string | null;
}

export interface ScanInfo {
  project_id: string;
  name: string;
  process: string;
  is_archived: boolean;
  next_action: "IN" | "OUT";
  active_clock_in: string | null;
  active_clock_in_by: string | null;
  last_clock_in: string | null;
  last_clock_out: string | null;
  last_clock_in_by: string | null;
  last_clock_out_by: string | null;
}

export interface ClockResult {
  action: "IN" | "OUT";
  project_id: string;
  session_id: string;
  clock_in: string;
  clock_out: string | null;
  clock_in_by: string | null;
  clock_out_by: string | null;
  duration_secs?: number;
  project_status?: string;
}
