import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Attendance,
  Employee,
  FeedbackEntry,
  Performance,
  SWOT,
  SalesRecord,
} from "../types/appTypes";
import {
  Variant_accessories_extendedWarranty,
  Variant_active_onHold,
  Variant_eod_daysBrief_attendance,
  Variant_tineco_ecovacs_coway_kuvings_instant,
} from "../types/appTypes";
import { useActor } from "./useActor";

export type {
  Employee,
  SalesRecord,
  Attendance,
  FeedbackEntry,
  Performance,
  SWOT,
};
export {
  Variant_active_onHold,
  Variant_eod_daysBrief_attendance,
  Variant_tineco_ecovacs_coway_kuvings_instant,
  Variant_accessories_extendedWarranty,
};

// --- Dashboard ---
export function useDashboardStats() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["dashboardStats"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getDashboardStats();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAllPerformancesSortedBySII() {
  const { actor, isFetching } = useActor();
  return useQuery<Performance[]>({
    queryKey: ["allPerformancesSII"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllPerformancesSortedBySII();
    },
    enabled: !!actor && !isFetching,
  });
}

// --- Employees ---
export function useAllEmployees() {
  const { actor, isFetching } = useActor();
  return useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllEmployees();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useEmployee(fiplCode: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Employee | null>({
    queryKey: ["employee", fiplCode],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getEmployee(fiplCode);
    },
    enabled: !!actor && !isFetching && !!fiplCode,
  });
}

export function useAddEmployee() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employee: Employee) => {
      if (!actor) throw new Error("No actor");
      return actor.addEmployee(employee);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
}

export function useUpdateEmployee() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employee: Employee) => {
      if (!actor) throw new Error("No actor");
      return actor.updateEmployee(employee);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employee", vars.fiplCode] });
      qc.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
}

export function useDeleteEmployee() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fiplCode: string) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteEmployee(fiplCode);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
}

// --- Performance ---
export function usePerformanceByFIPL(fiplCode: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Performance | null>({
    queryKey: ["performance", fiplCode],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getPerformanceByFIPL(fiplCode);
    },
    enabled: !!actor && !isFetching && !!fiplCode,
  });
}

export function useUpsertPerformance() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (performance: Performance) => {
      if (!actor) throw new Error("No actor");
      return actor.upsertPerformance(performance);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["performance", vars.fiplCode] });
      qc.invalidateQueries({ queryKey: ["allPerformancesSII"] });
    },
  });
}

// --- SWOT ---
export function useSWOTByFIPL(fiplCode: string) {
  const { actor, isFetching } = useActor();
  return useQuery<SWOT | null>({
    queryKey: ["swot", fiplCode],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getSWOTByFIPL(fiplCode);
    },
    enabled: !!actor && !isFetching && !!fiplCode,
  });
}

export function useUpsertSWOT() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (swot: SWOT) => {
      if (!actor) throw new Error("No actor");
      return actor.upsertSWOT(swot);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["swot", vars.fiplCode] });
    },
  });
}

// --- Sales ---
export function useSalesByFIPL(fiplCode: string) {
  const { actor, isFetching } = useActor();
  return useQuery<SalesRecord[]>({
    queryKey: ["sales", fiplCode],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSalesByFIPL(fiplCode);
    },
    enabled: !!actor && !isFetching && !!fiplCode,
  });
}

export function useAddSalesRecord() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: SalesRecord) => {
      if (!actor) throw new Error("No actor");
      return actor.addSalesRecord(record);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["sales", vars.fiplCode] });
      qc.invalidateQueries({ queryKey: ["allSales"] });
      qc.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
}

export function useAllSales(employeeCodes: string[]) {
  const { actor, isFetching } = useActor();
  return useQuery<SalesRecord[]>({
    queryKey: ["allSales", employeeCodes],
    queryFn: async () => {
      if (!actor || employeeCodes.length === 0) return [];
      const results = await Promise.all(
        employeeCodes.map((code) => actor.getSalesByFIPL(code)),
      );
      return results.flat();
    },
    enabled: !!actor && !isFetching && employeeCodes.length > 0,
  });
}

// --- Attendance ---
export function useAttendanceByFIPL(fiplCode: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Attendance[]>({
    queryKey: ["attendance", fiplCode],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAttendanceByFIPL(fiplCode);
    },
    enabled: !!actor && !isFetching && !!fiplCode,
  });
}

export function useAddAttendance() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: Attendance) => {
      if (!actor) throw new Error("No actor");
      return actor.addAttendance(record);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["attendance", vars.fiplCode] });
    },
  });
}

// --- Feedback ---
export function useFeedbackByFIPL(fiplCode: string) {
  const { actor, isFetching } = useActor();
  return useQuery<FeedbackEntry[]>({
    queryKey: ["feedback", fiplCode],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getFeedbackByFIPL(fiplCode);
    },
    enabled: !!actor && !isFetching && !!fiplCode,
  });
}

export function useAddFeedback() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: FeedbackEntry) => {
      if (!actor) throw new Error("No actor");
      return actor.addFeedback(entry);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["feedback", vars.fiplCode] });
      qc.invalidateQueries({ queryKey: ["allFeedback"] });
      qc.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
}

export function useBatchFeedbackUpload() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records: FeedbackEntry[]) => {
      if (!actor) throw new Error("No actor");
      return actor.batchFeedbackUpload(records);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allFeedback"] });
      qc.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
}

export function useAllFeedback(employeeCodes: string[]) {
  const { actor, isFetching } = useActor();
  return useQuery<FeedbackEntry[]>({
    queryKey: ["allFeedback", employeeCodes],
    queryFn: async () => {
      if (!actor || employeeCodes.length === 0) return [];
      const results = await Promise.all(
        employeeCodes.map((code) => actor.getFeedbackByFIPL(code)),
      );
      return results.flat();
    },
    enabled: !!actor && !isFetching && employeeCodes.length > 0,
  });
}
