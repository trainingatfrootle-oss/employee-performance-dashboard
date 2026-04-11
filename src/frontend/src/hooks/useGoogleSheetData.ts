import { useMemo } from "react";
import { useAllEmployeeData } from "./useAllEmployeeData";

export interface GoogleSheetDashboardData {
  activeCount: number;
  onHoldCount: number;
  inactiveCount: number;
  totalCount: number;
  topPerformers: Array<{
    rank: number;
    fiplCode: string;
    name: string;
    region: string;
    accessories: number;
    extendedWarranty: number;
    totalSales: number;
  }>;
  topPerformersMonth: string;
  lastRefreshed: Date | null;
}

export function useGoogleSheetData() {
  const { data, isLoading, isFetching, isError, refetch } =
    useAllEmployeeData();

  const dashboardData = useMemo((): GoogleSheetDashboardData | null => {
    if (!data) return null;
    const employees = data.employees;

    const activeCount = employees.filter(
      (e) => e.status.toLowerCase() === "active",
    ).length;
    const onHoldCount = employees.filter(
      (e) =>
        e.status.toLowerCase() === "on hold" ||
        e.status.toLowerCase() === "onhold",
    ).length;
    const inactiveCount = employees.filter(
      (e) => e.status.toLowerCase() === "inactive",
    ).length;
    const totalCount = employees.length;

    // ── Build employee lookup for region enrichment ────────────────────────
    const normalizeKey = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    const empByFipl: Record<string, { region: string }> = {};
    for (const e of employees) {
      const key = normalizeKey(e.fiplCode);
      empByFipl[key] = { region: e.region ?? "" };
    }

    // ── Read Top Performers directly from the "Top Performers" sheet ───────
    const sheetPerformers = data.topPerformers ?? [];
    console.log(
      `[Top Performers] Loaded ${sheetPerformers.length} records from sheet`,
    );

    const topPerformers = sheetPerformers.map((p, i) => {
      const normKey = normalizeKey(p.fiplCode);
      const region = empByFipl[normKey]?.region ?? "";
      return {
        rank: typeof p.rank === "number" ? p.rank : i + 1,
        fiplCode: p.fiplCode,
        name: p.name,
        region,
        accessories: typeof p.accessories === "number" ? p.accessories : 0,
        extendedWarranty:
          typeof p.extendedWarranty === "number" ? p.extendedWarranty : 0,
        totalSales: typeof p.totalSales === "number" ? p.totalSales : 0,
      };
    });

    return {
      activeCount,
      onHoldCount,
      inactiveCount,
      totalCount,
      topPerformers,
      topPerformersMonth: "",
      lastRefreshed: new Date(),
    };
  }, [data]);

  return { data: dashboardData, isLoading, isFetching, isError, refetch };
}
