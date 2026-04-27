import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, MapPin, Search, TrendingDown, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useEmployees } from "../hooks/useAllEmployeeData";
import { useGoogleSheetCallRecords } from "../hooks/useGoogleSheetCallRecords";
import RegionalDashboard from "./RegionalDashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegionCard {
  region: string;
  employeeCount: number; // active only
  negativeCount: number;
  totalFeedback: number;
  avgCes: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeKey = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// ─── RegionStatCard ───────────────────────────────────────────────────────────

function RegionStatCard({
  card,
  onClick,
  index,
}: {
  card: RegionCard;
  onClick: () => void;
  index: number;
}) {
  const negRate =
    card.totalFeedback > 0 ? card.negativeCount / card.totalFeedback : 0;
  const borderColor =
    negRate > 0.5
      ? "border-red-300 bg-red-50/40"
      : negRate > 0.25
        ? "border-amber-300 bg-amber-50/20"
        : "border-border bg-card";

  return (
    <button
      type="button"
      onClick={onClick}
      data-ocid={`regional.region_card.${index + 1}`}
      className={`w-full text-left rounded-xl border shadow-sm p-5 transition-all duration-150 hover:shadow-md hover:scale-[1.01] ${borderColor}`}
    >
      {/* Region name */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm leading-tight">
              {card.region}
            </h3>
            {negRate > 0.5 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 mt-0.5">
                <TrendingDown className="w-3 h-3" /> Needs attention
              </span>
            )}
          </div>
        </div>
        <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5 shrink-0">
          View →
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-background/80 border border-border px-2 py-2">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Users className="w-3 h-3 text-muted-foreground" />
          </div>
          <div className="text-base font-bold text-foreground">
            {card.employeeCount}
          </div>
          <div className="text-[10px] text-muted-foreground">Active Emps</div>
        </div>
        <div
          className={`rounded-lg border px-2 py-2 ${
            card.negativeCount > 0
              ? "bg-red-50 border-red-200"
              : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <div className="text-base font-bold text-red-700">
            {card.negativeCount}
          </div>
          <div className="text-[10px] text-red-600">Negative</div>
        </div>
        <div
          className={`rounded-lg border px-2 py-2 ${
            card.avgCes >= 30
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <div
            className={`text-base font-bold ${card.avgCes >= 30 ? "text-emerald-700" : "text-amber-700"}`}
          >
            {card.totalFeedback > 0 ? card.avgCes.toFixed(1) : "—"}
          </div>
          <div
            className={`text-[10px] ${card.avgCes >= 30 ? "text-emerald-600" : "text-amber-600"}`}
          >
            Avg CES
          </div>
        </div>
      </div>

      {/* Feedback bar */}
      {card.totalFeedback > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{card.totalFeedback} feedback records</span>
            <span>{Math.round(negRate * 100)}% negative</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-red-400 transition-all duration-500"
              style={{ width: `${Math.round(negRate * 100)}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

// ─── Skeleton loading ─────────────────────────────────────────────────────────

function RegionCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
      <Skeleton className="h-2 rounded-full" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RegionalAnalysis({
  onSelectEmployee,
}: {
  onSelectEmployee: (fiplCode: string) => void;
}) {
  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const { data: callRecords = [], isLoading: feedbackLoading } =
    useGoogleSheetCallRecords();

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Build FIPL → region map
  const regionMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const emp of employees) {
      if (emp.fiplCode && emp.region) {
        map[normalizeKey(emp.fiplCode)] = emp.region;
      }
    }
    return map;
  }, [employees]);

  // Derive unique regions from employee data
  const allRegions = useMemo(() => {
    const set = new Set<string>();
    for (const emp of employees) {
      if (emp.region?.trim()) set.add(emp.region.trim());
    }
    return [...set].sort();
  }, [employees]);

  // Build region cards with stats
  const regionCards = useMemo((): RegionCard[] => {
    return allRegions.map((region) => {
      const regionEmployees = employees.filter((e) => e.region === region);
      // Count ONLY active employees
      const activeCount = regionEmployees.filter(
        (e) => (e.status ?? "").toLowerCase().replace(/\s+/g, "") === "active",
      ).length;
      const regionRecords = callRecords.filter(
        (r) => (regionMap[normalizeKey(r.fiplCode ?? "")] ?? "") === region,
      );
      const negativeCount = regionRecords.filter((r) => r.cesScore < 30).length;
      const avgCes =
        regionRecords.length > 0
          ? regionRecords.reduce((s, r) => s + r.cesScore, 0) /
            regionRecords.length
          : 0;
      return {
        region,
        employeeCount: activeCount,
        negativeCount,
        totalFeedback: regionRecords.length,
        avgCes,
      };
    });
  }, [allRegions, employees, callRecords, regionMap]);

  // Filter by search
  const filteredCards = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return regionCards;
    return regionCards.filter((c) => c.region.toLowerCase().includes(q));
  }, [regionCards, search]);

  const isLoading = empLoading || feedbackLoading;

  // If a region is selected, show RegionalDashboard
  if (selectedRegion) {
    return (
      <RegionalDashboard
        selectedRegion={selectedRegion}
        allRecords={callRecords}
        employees={employees}
        regionMap={regionMap}
        onBack={() => setSelectedRegion(null)}
        onSelectEmployee={onSelectEmployee}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              Regional Analysis
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Select a region to view employee performance, sales, and feedback
            insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {allRegions.length} regions
          </Badge>
          <Badge variant="outline" className="text-xs">
            {
              employees.filter(
                (e) =>
                  (e.status ?? "").toLowerCase().replace(/\s+/g, "") ===
                  "active",
              ).length
            }{" "}
            active employees
          </Badge>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          data-ocid="regional.search_input"
          className="pl-9"
          placeholder="Search regions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Summary stats row */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Total Regions",
              value: allRegions.length,
              icon: Globe,
              color: "text-primary",
            },
            {
              label: "Active Employees",
              value: employees.filter(
                (e) =>
                  (e.status ?? "").toLowerCase().replace(/\s+/g, "") ===
                  "active",
              ).length,
              icon: Users,
              color: "text-indigo-600",
            },
            {
              label: "Total Feedback",
              value: callRecords.length,
              icon: MapPin,
              color: "text-emerald-600",
            },
            {
              label: "Negative Records",
              value: callRecords.filter((r) => r.cesScore < 30).length,
              icon: TrendingDown,
              color: "text-red-600",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-xl border bg-card shadow-sm px-4 py-3 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <div className="text-xl font-bold">
                  {value.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Region grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <RegionCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 text-muted-foreground"
          data-ocid="regional.empty_state"
        >
          <Globe className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-base font-medium">
            {search ? `No regions match "${search}"` : "No regions found"}
          </p>
          <p className="text-sm mt-1">
            Regions are derived from employee FIPL data
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card, idx) => (
            <RegionStatCard
              key={card.region}
              card={card}
              index={idx}
              onClick={() => setSelectedRegion(card.region)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
