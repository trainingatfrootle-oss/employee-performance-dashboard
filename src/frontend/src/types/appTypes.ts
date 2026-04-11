// Shared application types for Employee Performance Dashboard
// These are the data models used throughout the frontend (sourced from Google Sheets and uploads)

// Variant enums — used as both values and types
export const Variant_active_onHold = {
  active: "active" as const,
  onHold: "onHold" as const,
  inactive: "inactive" as const,
} as const;
export type Variant_active_onHold =
  (typeof Variant_active_onHold)[keyof typeof Variant_active_onHold];

export const Variant_eod_daysBrief_attendance = {
  attendance: "attendance" as const,
  eod: "eod" as const,
  daysBrief: "daysBrief" as const,
} as const;
export type Variant_eod_daysBrief_attendance =
  (typeof Variant_eod_daysBrief_attendance)[keyof typeof Variant_eod_daysBrief_attendance];

export const Variant_tineco_ecovacs_coway_kuvings_instant = {
  ecovacs: "ecovacs" as const,
  kuvings: "kuvings" as const,
  coway: "coway" as const,
  tineco: "tineco" as const,
  instant: "instant" as const,
} as const;
export type Variant_tineco_ecovacs_coway_kuvings_instant =
  (typeof Variant_tineco_ecovacs_coway_kuvings_instant)[keyof typeof Variant_tineco_ecovacs_coway_kuvings_instant];

export const Variant_accessories_extendedWarranty = {
  accessories: "accessories" as const,
  extendedWarranty: "extendedWarranty" as const,
} as const;
export type Variant_accessories_extendedWarranty =
  (typeof Variant_accessories_extendedWarranty)[keyof typeof Variant_accessories_extendedWarranty];

// Data model interfaces — field names match exactly what Uploads/Feedback/etc use
export interface Employee {
  fiplCode: string;
  name: string;
  role: string;
  department: string;
  fseCategory: string;
  status: Variant_active_onHold;
  joinDate: string;
  avatarUrl: string;
  region: string;
  familyDetails?: string;
  pastExperience?: string;
}

export interface Performance {
  fiplCode: string;
  salesInfluenceIndex: number;
  reviewCount: bigint | number;
  operationalDiscipline: number;
  productKnowledgeScore: number;
  softSkillsScore: number;
  demoVisits: bigint | number;
  complaintVisits: bigint | number;
  videoCallDemos: bigint | number;
}

export interface SWOT {
  fiplCode: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  traits: string[];
  problems: string[];
  feedbacks: string[];
}

export interface SalesRecord {
  recordId?: bigint | number;
  fiplCode: string;
  brand: Variant_tineco_ecovacs_coway_kuvings_instant;
  product: string;
  saleType: Variant_accessories_extendedWarranty;
  quantity: bigint | number;
  amount: number;
  saleDate: string;
}

export interface Attendance {
  recordId?: bigint | number;
  fiplCode: string;
  labType: Variant_eod_daysBrief_attendance;
  daysOff: bigint | number;
  reason: string;
  date: string;
}

export interface FeedbackEntry {
  entryId?: bigint | number;
  fiplCode: string;
  customerName: string;
  contact: string;
  brand: Variant_tineco_ecovacs_coway_kuvings_instant;
  product: string;
  cesScore: number;
  remark: string;
  callDate: string;
  agent: string;
  typeOfIssue?: string;
  resolution?: string;
}

export interface TopPerformer {
  rank: bigint | number;
  name: string;
  fiplCode: string;
  accessories: bigint | number;
  extendedWarranty: bigint | number;
  totalSales: number;
}
