import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface SWOT {
    weaknesses: Array<string>;
    strengths: Array<string>;
    traits: Array<string>;
    threats: Array<string>;
    opportunities: Array<string>;
    cesScore: number;
    problems: Array<string>;
    feedbacks: Array<string>;
    fiplCode: string;
}
export interface BatchResult {
    errors: Array<string>;
    successCount: bigint;
    failCount: bigint;
}
export interface Attendance {
    date: string;
    recordId: bigint;
    labType: Variant_eod_daysBrief_attendance;
    fiplCode: string;
    reason: string;
    daysOff: bigint;
}
export interface Performance {
    videoCallDemos: bigint;
    operationalDiscipline: number;
    softSkillsScore: number;
    productKnowledgeScore: number;
    salesInfluenceIndex: number;
    reviewCount: bigint;
    complaintVisits: bigint;
    demoVisits: bigint;
    fiplCode: string;
}
export interface TopPerformer {
    accessories: bigint;
    name: string;
    rank: bigint;
    totalSales: number;
    extendedWarranty: bigint;
    fiplCode: string;
}
export interface SalesRecord {
    saleType: Variant_accessories_extendedWarranty;
    recordId: bigint;
    quantity: bigint;
    brand: Variant_tineco_ecovacs_coway_kuvings_instant;
    amount: number;
    product: string;
    saleDate: string;
    fiplCode: string;
}
export interface Employee {
    region: string;
    status: Variant_active_onHold;
    joinDate: string;
    name: string;
    role: string;
    fseCategory: string;
    avatarUrl: string;
    department: string;
    familyDetails: string;
    pastExperience: string;
    fiplCode: string;
}
export interface FeedbackEntry {
    remark: string;
    customerName: string;
    contact: string;
    agent: string;
    callDate: string;
    entryId: bigint;
    cesScore: number;
    brand: Variant_tineco_ecovacs_coway_kuvings_instant;
    product: string;
    fiplCode: string;
}
export interface DashboardStats {
    totalEmployees: bigint;
    totalSalesAmount: number;
    activeCount: bigint;
    averageCesScore: number;
}
export enum Order {
    less = "less",
    equal = "equal",
    greater = "greater"
}
export enum Variant_accessories_extendedWarranty {
    accessories = "accessories",
    extendedWarranty = "extendedWarranty"
}
export enum Variant_active_onHold {
    active = "active",
    onHold = "onHold"
}
export enum Variant_eod_daysBrief_attendance {
    eod = "eod",
    daysBrief = "daysBrief",
    attendance = "attendance"
}
export enum Variant_tineco_ecovacs_coway_kuvings_instant {
    tineco = "tineco",
    ecovacs = "ecovacs",
    coway = "coway",
    kuvings = "kuvings",
    instant = "instant"
}
export interface backendInterface {
    addAttendance(record: Attendance): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    addEmployee(employee: Employee): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    addFeedback(entry: FeedbackEntry): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    addSalesRecord(record: SalesRecord): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    batchAttendanceUpload(records: Array<Attendance>): Promise<BatchResult>;
    batchEmployeeUpload(records: Array<Employee>): Promise<BatchResult>;
    batchFeedbackUpload(records: Array<FeedbackEntry>): Promise<BatchResult>;
    batchParametersUpload(records: Array<Performance>): Promise<BatchResult>;
    batchSWOTUpload(records: Array<SWOT>): Promise<BatchResult>;
    batchSalesUpload(records: Array<SalesRecord>): Promise<BatchResult>;
    batchTopPerformersUpload(records: Array<TopPerformer>): Promise<BatchResult>;
    /**
     * / Clear the entire key-value store.
     */
    clearAllKV(): Promise<void>;
    compareTopPerformersBySales(a: TopPerformer, b: TopPerformer): Promise<Order>;
    /**
     * / Delete only attendance records
     */
    deleteAllAttendance(): Promise<void>;
    /**
     * / Delete all data (employees, sales, attendance, SWOT, performance, feedback, top performers)
     */
    deleteAllData(): Promise<void>;
    /**
     * / DELETE OPERATIONS
     * / Delete all employees and all related data.
     */
    deleteAllEmployees(): Promise<void>;
    /**
     * / Delete only feedback/calling records
     */
    deleteAllFeedback(): Promise<void>;
    /**
     * / Delete only performance/parameters records
     */
    deleteAllPerformances(): Promise<void>;
    /**
     * / Delete only SWOT records
     */
    deleteAllSWOT(): Promise<void>;
    /**
     * / Delete only sales records
     */
    deleteAllSales(): Promise<void>;
    /**
     * / Delete only top performer records
     */
    deleteAllTopPerformers(): Promise<void>;
    deleteEmployee(fiplCode: string): Promise<void>;
    /**
     * / Delete a key from the store.
     */
    deleteKV(key: string): Promise<void>;
    getActiveEmployees(): Promise<Array<Employee>>;
    getAllEmployees(): Promise<Array<Employee>>;
    /**
     * / Get all key-value pairs as an array of (key, value) tuples.
     */
    getAllKV(): Promise<Array<[string, string]>>;
    getAllPerformancesSortedBySII(): Promise<Array<Performance>>;
    getAttendanceByFIPL(fiplCode: string): Promise<Array<Attendance>>;
    getDashboardStats(): Promise<DashboardStats>;
    getEmployee(fiplCode: string): Promise<Employee | null>;
    getFeedbackByFIPL(fiplCode: string): Promise<Array<FeedbackEntry>>;
    /**
     * / Get a value by key. Returns null if not found.
     */
    getKV(key: string): Promise<string | null>;
    getPerformanceByFIPL(fiplCode: string): Promise<Performance | null>;
    getSWOTByFIPL(fiplCode: string): Promise<SWOT | null>;
    getSalesByFIPL(fiplCode: string): Promise<Array<SalesRecord>>;
    getTopPerformers(): Promise<Array<TopPerformer>>;
    /**
     * / Set a key-value pair in the store.
     */
    setKV(key: string, value: string): Promise<void>;
    updateEmployee(employee: Employee): Promise<void>;
    upsertPerformance(performance: Performance): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    upsertSWOT(swot: SWOT): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
}
