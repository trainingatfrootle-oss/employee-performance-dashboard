/**
 * useActor shim — this app fetches all data from Google Sheets.
 * The backend actor is available but not used for primary data.
 * This hook provides a typed stub so TypeScript is satisfied.
 */

import type {
  Attendance,
  Employee,
  FeedbackEntry,
  Performance,
  SWOT,
  SalesRecord,
  TopPerformer,
} from "../types/appTypes";

type BatchResult = {
  successCount: bigint | number;
  failCount: bigint | number;
};

interface ActorInterface {
  // Dashboard
  getDashboardStats(): Promise<unknown>;
  getAllPerformancesSortedBySII(): Promise<Performance[]>;

  // Employees
  getAllEmployees(): Promise<Employee[]>;
  getEmployee(fiplCode: string): Promise<Employee | null>;
  addEmployee(employee: Employee): Promise<{ ok: string } | { err: string }>;
  updateEmployee(employee: Employee): Promise<void>;
  deleteEmployee(fiplCode: string): Promise<void>;

  // Performance / Parameters
  getPerformanceByFIPL(fiplCode: string): Promise<Performance | null>;
  upsertPerformance(performance: Performance): Promise<void>;

  // SWOT
  getSWOTByFIPL(fiplCode: string): Promise<SWOT | null>;
  upsertSWOT(swot: SWOT): Promise<void>;

  // Sales
  getSalesByFIPL(fiplCode: string): Promise<SalesRecord[]>;
  addSalesRecord(record: SalesRecord): Promise<void>;

  // Attendance
  getAttendanceByFIPL(fiplCode: string): Promise<Attendance[]>;
  addAttendance(record: Attendance): Promise<void>;

  // Feedback
  getFeedbackByFIPL(fiplCode: string): Promise<FeedbackEntry[]>;
  addFeedback(entry: FeedbackEntry): Promise<void>;
  batchFeedbackUpload(records: FeedbackEntry[]): Promise<BatchResult>;

  // Batch uploads
  batchEmployeeUpload(records: Employee[]): Promise<BatchResult>;
  batchParametersUpload(records: Performance[]): Promise<BatchResult>;
  batchAttendanceUpload(records: Attendance[]): Promise<BatchResult>;
  batchSWOTUpload(records: SWOT[]): Promise<BatchResult>;
  batchSalesUpload(records: SalesRecord[]): Promise<BatchResult>;
  batchTopPerformersUpload(records: TopPerformer[]): Promise<BatchResult>;

  // Top Performers
  getTopPerformers(): Promise<TopPerformer[]>;

  // KV store (for UI labels, suggestions, issues)
  getKV(key: string): Promise<[] | [string]>;
  setKV(key: string, value: string): Promise<void>;
  deleteKV(key: string): Promise<void>;
  getAllKV(): Promise<Array<[string, string]>>;
  clearAllKV(): Promise<void>;

  // Data management
  deleteAllData(): Promise<void>;
}

export function useActor(): {
  actor: ActorInterface | null;
  isFetching: boolean;
} {
  // This app uses Google Sheets for all data. The actor is always null.
  return { actor: null, isFetching: false };
}
