import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { XLSX } from "@/lib/xlsxShim";
import {
  ChevronDown,
  ChevronUp,
  Grid2X2,
  Loader2,
  Plus,
  Search,
  TableIcon,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PasswordGate, usePasswordGate } from "../components/PasswordGate";
import { useLabels } from "../contexts/UILabelsContext";
import { useEmployees } from "../hooks/useAllEmployeeData";
import { useGoogleSheetCallRecords } from "../hooks/useGoogleSheetCallRecords";
import {
  Variant_tineco_ecovacs_coway_kuvings_instant,
  useAddFeedback,
  useAllEmployees,
  useAllFeedback,
  useBatchFeedbackUpload,
} from "../hooks/useQueries";
import type { FeedbackEntry } from "../hooks/useQueries";
import RegionDetailPage from "./RegionDetailPage";

// ─── Constants ───────────────────────────────────────────────────────────────

const BRANDS = ["Ecovacs", "Kuvings", "Coway", "Tineco", "Instant"] as const;

const KNOWN_ISSUE_TYPES = [
  "FSE Issue",
  "Operations & Scheduling Issue",
  "Brand Issue",
  "Technical/Product Issue",
  "After-Sales & Support Issue",
  "Satisfied",
  "Feedback-Form Sent",
];

// ─── Issue Category Classification ───────────────────────────────────────────

export const ISSUE_CATEGORIES = [
  {
    key: "FSE Issue",
    label: "FSE Issue",
    color:
      "bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200",
  },
  {
    key: "Operation and Scheduling Issue",
    label: "Operation & Scheduling",
    color: "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200",
  },
  {
    key: "Brand Issue",
    label: "Brand Issue",
    color: "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200",
  },
  {
    key: "Technical and Product Issue",
    label: "Technical & Product",
    color:
      "bg-violet-100 text-violet-800 border-violet-300 hover:bg-violet-200",
  },
  {
    key: "After-Sales Issue",
    label: "After-Sales Issue",
    color:
      "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200",
  },
  {
    key: "Satisfied",
    label: "Satisfied",
    color:
      "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200",
  },
  {
    key: "FeedbackFormSent",
    label: "Feedback-Form Sent",
    color: "bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200",
  },
  {
    key: "Wow Factor",
    label: "Wow Factor",
    color:
      "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200",
  },
] as const;

type CategoryKey = (typeof ISSUE_CATEGORIES)[number]["key"];

/**
 * Classify a raw typeOfIssue string into one or more broad category keys.
 * A record can match multiple categories.
 */
export function classifyIssue(rawText: string): CategoryKey[] {
  if (!rawText) return [];
  const t = rawText.toLowerCase();
  const matched: CategoryKey[] = [];
  if (t.includes("fse")) matched.push("FSE Issue");
  if (t.includes("operat") || t.includes("schedul"))
    matched.push("Operation and Scheduling Issue");
  if (t.includes("brand")) matched.push("Brand Issue");
  if (t.includes("tech") || t.includes("product"))
    matched.push("Technical and Product Issue");
  if (t.includes("after") || t.includes("support"))
    matched.push("After-Sales Issue");
  // "Satisfied" — matches "satisf" but NOT google/form keywords
  const hasGoogle =
    t.includes("google") || t.includes("sent google") || t.includes("form");
  if (t.includes("satisf") && !hasGoogle) matched.push("Satisfied");
  // "FeedbackFormSent" — matches google form / sent google / form keywords
  if (hasGoogle) matched.push("FeedbackFormSent");
  if (t.includes("wow")) matched.push("Wow Factor");
  return matched;
}

// Action suggestions per issue category
const ISSUE_ACTIONS: Record<string, string> = {
  "FSE Issue": "Focus on FSE skill development & accountability",
  "Operation and Scheduling Issue": "Review scheduling & logistics processes",
  "Brand Issue": "Coordinate with brand team for product improvements",
  "Technical and Product Issue": "Escalate technical issues to product support",
  "After-Sales Issue": "Strengthen after-sales follow-up process",
  Satisfied: "Maintain current service standards",
  FeedbackFormSent: "Ensure follow-up on form responses",
  "Wow Factor": "Recognize and replicate best practices",
};

// Category key → color for chips in region analysis
const CATEGORY_CHIP_COLORS: Record<string, string> = {
  "FSE Issue": "bg-indigo-100 text-indigo-800 border-indigo-300",
  "Operation and Scheduling Issue":
    "bg-amber-100 text-amber-800 border-amber-300",
  "Brand Issue": "bg-rose-100 text-rose-800 border-rose-300",
  "Technical and Product Issue":
    "bg-violet-100 text-violet-800 border-violet-300",
  "After-Sales Issue": "bg-orange-100 text-orange-800 border-orange-300",
  Satisfied: "bg-emerald-100 text-emerald-800 border-emerald-300",
  FeedbackFormSent: "bg-sky-100 text-sky-800 border-sky-300",
  "Wow Factor": "bg-yellow-100 text-yellow-800 border-yellow-300",
};

function getCategoryLabel(key: string): string {
  return ISSUE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

const BRAND_COLORS: Record<string, string> = {
  ecovacs: "bg-blue-100 text-blue-700 border-blue-200",
  kuvings: "bg-orange-100 text-orange-700 border-orange-200",
  coway: "bg-green-100 text-green-700 border-green-200",
  tineco: "bg-purple-100 text-purple-700 border-purple-200",
  instant: "bg-red-100 text-red-700 border-red-200",
};

function brandColorClass(brand: string): string {
  return (
    BRAND_COLORS[brand.toLowerCase()] ??
    "bg-slate-100 text-slate-700 border-slate-200"
  );
}

const PAGE_SIZE = 15;

// ─── Date Formatting ─────────────────────────────────────────────────────────

/**
 * Formats a date string or timestamp to DD/MM/YYYY.
 * Handles: ISO strings, unix timestamps (sec or ms), DD-MM-YYYY, DD/MM/YYYY.
 */
export function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const raw = String(dateStr).trim();

  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;

  // DD-MM-YYYY → DD/MM/YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw.replace(/-/g, "/");

  // Pure numeric — could be unix timestamp
  if (/^\d+$/.test(raw)) {
    const num = Number(raw);
    // Seconds (Unix timestamps before year 3000 are < ~32e9)
    const d = num < 1e12 ? new Date(num * 1000) : new Date(num);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  // ISO string or any Date-parseable string
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // Fallback: return as-is
  return raw;
}

// ─── Unified display type ─────────────────────────────────────────────────────

interface DisplayRecord {
  id: string;
  fiplCode: string;
  fseName: string;
  customerName: string;
  contact?: string;
  brand: string;
  product: string;
  cesScore: number;
  remark: string;
  callDate: string;
  agent: string;
  source: "sheet" | "manual";
  typeOfIssue: string;
  resolution: string;
  region: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function cesToStars(ces: number): number {
  return Math.round((ces / 40) * 5 * 2) / 2;
}

function StarRating({ score }: { score: number }) {
  const stars = cesToStars(score);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = stars >= i;
        const half = !filled && stars >= i - 0.5;
        return (
          <span
            key={i}
            className={`text-lg leading-none ${
              filled || half ? "text-amber-400" : "text-muted-foreground/30"
            }`}
          >
            {filled ? "\u2605" : half ? "\u2bd0" : "\u2606"}
          </span>
        );
      })}
    </div>
  );
}

function CesBadge({ score }: { score: number }) {
  const isLow = score < 30;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
        isLow
          ? "bg-red-100 text-red-700 border-red-300"
          : "bg-emerald-100 text-emerald-700 border-emerald-300"
      }`}
    >
      {score}/40
    </span>
  );
}

type ViewMode = "table" | "masonry";

const EMPTY_FORM = {
  fiplCode: "",
  customerName: "",
  contact: "",
  brand:
    Variant_tineco_ecovacs_coway_kuvings_instant.ecovacs as Variant_tineco_ecovacs_coway_kuvings_instant,
  product: "",
  cesScore: 35,
  remark: "",
  callDate: "",
  agent: "",
};

function brandEnumToStr(
  b: Variant_tineco_ecovacs_coway_kuvings_instant,
): string {
  const map: Record<string, string> = {
    [Variant_tineco_ecovacs_coway_kuvings_instant.ecovacs]: "Ecovacs",
    [Variant_tineco_ecovacs_coway_kuvings_instant.kuvings]: "Kuvings",
    [Variant_tineco_ecovacs_coway_kuvings_instant.coway]: "Coway",
    [Variant_tineco_ecovacs_coway_kuvings_instant.tineco]: "Tineco",
    [Variant_tineco_ecovacs_coway_kuvings_instant.instant]: "Instant",
  };
  return map[String(b)] ?? String(b);
}

const normalizeKey = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// ─── Region Analysis ─────────────────────────────────────────────────────────

interface RegionStat {
  region: string;
  negativeCount: number;
  totalCount: number;
  topIssueKey: string | null;
  topIssueLabel: string;
  action: string;
}

function computeRegionStats(records: DisplayRecord[]): RegionStat[] {
  // Only negative records for analysis
  const negRecords = records.filter((r) => r.cesScore < 30);

  // Count per region
  const regionNegCount: Record<string, number> = {};
  const regionTotalCount: Record<string, number> = {};
  const regionIssueFreq: Record<string, Record<string, number>> = {};

  for (const r of records) {
    const reg = r.region || "Unknown";
    regionTotalCount[reg] = (regionTotalCount[reg] ?? 0) + 1;
  }

  for (const r of negRecords) {
    const reg = r.region || "Unknown";
    regionNegCount[reg] = (regionNegCount[reg] ?? 0) + 1;
    const cats = classifyIssue(r.typeOfIssue);
    for (const cat of cats) {
      if (!regionIssueFreq[reg]) regionIssueFreq[reg] = {};
      regionIssueFreq[reg][cat] = (regionIssueFreq[reg][cat] ?? 0) + 1;
    }
  }

  const allRegions = new Set([
    ...Object.keys(regionNegCount),
    ...Object.keys(regionTotalCount),
  ]);

  const stats: RegionStat[] = [];
  for (const region of allRegions) {
    if (!region) continue;
    const negCount = regionNegCount[region] ?? 0;
    const total = regionTotalCount[region] ?? 0;
    const freqMap = regionIssueFreq[region] ?? {};
    let topIssueKey: string | null = null;
    let topIssueFreq = 0;
    for (const [key, freq] of Object.entries(freqMap)) {
      if (freq > topIssueFreq) {
        topIssueFreq = freq;
        topIssueKey = key;
      }
    }
    const topIssueLabel = topIssueKey ? getCategoryLabel(topIssueKey) : "—";
    const action =
      topIssueKey != null
        ? (ISSUE_ACTIONS[topIssueKey] ??
          "Review and address recurring complaints")
        : "No negative feedback";

    stats.push({
      region,
      negativeCount: negCount,
      totalCount: total,
      topIssueKey,
      topIssueLabel,
      action,
    });
  }

  return stats.sort((a, b) => b.negativeCount - a.negativeCount);
}

function RegionAnalysisPanel({
  records,
  onSelectRegion,
}: {
  records: DisplayRecord[];
  onSelectRegion: (region: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const stats = useMemo(() => computeRegionStats(records), [records]);
  const maxNeg = useMemo(
    () => Math.max(1, ...stats.map((s) => s.negativeCount)),
    [stats],
  );

  if (stats.length === 0) return null;

  return (
    <div
      className="rounded-xl border bg-card shadow-sm overflow-hidden"
      data-ocid="feedback.region_analysis"
    >
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-3 bg-muted/40 hover:bg-muted/60 transition-colors border-b"
        data-ocid="feedback.region_analysis_toggle"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">
            📍 Region Analysis
          </span>
          <Badge variant="secondary" className="text-xs">
            {stats.filter((s) => s.negativeCount > 0).length} regions with
            negative feedback
          </Badge>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="divide-y">
          {stats.map((s, idx) => {
            const isWorst = idx === 0 && s.negativeCount > 0;
            const pct = Math.round((s.negativeCount / maxNeg) * 100);
            const chipColor =
              s.topIssueKey != null
                ? (CATEGORY_CHIP_COLORS[s.topIssueKey] ??
                  "bg-muted text-muted-foreground border-border")
                : "bg-muted text-muted-foreground border-border";

            return (
              <button
                key={s.region}
                type="button"
                onClick={() => onSelectRegion(s.region)}
                className={`w-full flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 transition-colors cursor-pointer text-left ${
                  isWorst
                    ? "bg-red-50/60 dark:bg-red-950/20 border-l-4 border-l-red-500 hover:bg-red-100/60"
                    : "hover:bg-muted/30"
                }`}
                data-ocid={`feedback.region.${s.region.toLowerCase().replace(/\s+/g, "_")}`}
              >
                {/* Region name + priority badge */}
                <div className="flex items-center gap-2 min-w-[160px]">
                  <span className="font-semibold text-sm">{s.region}</span>
                  {isWorst && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 uppercase tracking-wide">
                      ⚠️ Priority
                    </span>
                  )}
                </div>

                {/* Negative count + bar */}
                <div className="flex items-center gap-2 min-w-[130px]">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border bg-red-100 text-red-700 border-red-300 shrink-0">
                    {s.negativeCount} negative
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {s.totalCount} total
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex-1 min-w-[80px]">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Top issue chip */}
                <div className="min-w-[140px]">
                  {s.topIssueKey ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${chipColor}`}
                    >
                      {s.topIssueLabel}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No issues classified
                    </span>
                  )}
                </div>

                {/* Recommended action */}
                <div className="flex-1 text-xs text-muted-foreground italic min-w-[200px]">
                  → {s.action}
                </div>
                {/* View details */}
                <span className="text-xs font-medium text-primary hover:underline shrink-0">
                  View Details →
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────────

export default function Feedback({
  onSelectEmployee,
}: {
  onSelectEmployee?: (fiplCode: string) => void;
}) {
  const { labels } = useLabels();
  // Google Sheet live data
  const { data: sheetRecords = [], isLoading: sheetLoading } =
    useGoogleSheetCallRecords();

  // Employee data for region lookup
  const { data: liveEmployees = [] } = useEmployees();

  // Backend manual records
  const { data: employees = [] } = useAllEmployees();
  const employeeCodes = employees.map((e) => e.fiplCode);
  const { data: backendFeedback = [], isLoading: backendLoading } =
    useAllFeedback(employeeCodes);
  const addFeedback = useAddFeedback();
  const batchUpload = useBatchFeedbackUpload();

  const isLoading = sheetLoading || backendLoading;

  // ── Region drilldown state ──
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const nameMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.fiplCode, e.name])),
    [employees],
  );

  // Build FIPL → region map from live employee data (normalized keys)
  const regionMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const emp of liveEmployees) {
      if (emp.fiplCode && emp.region) {
        map[normalizeKey(emp.fiplCode)] = emp.region;
      }
    }
    return map;
  }, [liveEmployees]);

  // Convert Google Sheet records to DisplayRecord
  const sheetDisplayRecords: DisplayRecord[] = useMemo(
    () =>
      sheetRecords.map((r) => ({
        id: r.id,
        fiplCode: r.fiplCode,
        fseName: r.fseName,
        customerName: r.customerName,
        brand: r.brand,
        product: r.product,
        cesScore: r.cesScore,
        remark: r.remark,
        callDate: r.callDate,
        agent: r.agent,
        source: "sheet" as const,
        typeOfIssue: r.typeOfIssue ?? "",
        resolution: r.resolution ?? "",
        region: regionMap[normalizeKey(r.fiplCode)] ?? "",
      })),
    [sheetRecords, regionMap],
  );

  // Convert backend FeedbackEntry to DisplayRecord
  const backendDisplayRecords: DisplayRecord[] = useMemo(
    () =>
      backendFeedback.map((f) => ({
        id: `be-${(f.entryId ?? 0n).toString()}`,
        fiplCode: f.fiplCode,
        fseName: nameMap[f.fiplCode] || "",
        customerName: f.customerName,
        contact: f.contact,
        brand: brandEnumToStr(f.brand),
        product: f.product,
        cesScore: f.cesScore,
        remark: f.remark,
        callDate: f.callDate,
        agent: f.agent,
        source: "manual" as const,
        typeOfIssue: "",
        resolution: "",
        region: regionMap[normalizeKey(f.fiplCode)] ?? "",
      })),
    [backendFeedback, nameMap, regionMap],
  );

  // Merge: Google Sheet records first, then any manually-added backend records
  const allRecords: DisplayRecord[] = useMemo(
    () => [...sheetDisplayRecords, ...backendDisplayRecords],
    [sheetDisplayRecords, backendDisplayRecords],
  );

  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [cesFilter, setCesFilter] = useState<"all" | "positive" | "negative">(
    "all",
  );
  const [regionFilter, setRegionFilter] = useState("all");
  const [issueTypeFilter, setIssueTypeFilter] = useState("all");
  const [activeCategoryFilter, setActiveCategoryFilter] =
    useState<CategoryKey | null>(null);
  const [remarkRecord, setRemarkRecord] = useState<DisplayRecord | null>(null);
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password gate for write actions
  const { granted: writeGranted, grant: grantWrite } =
    usePasswordGate("feedback-write");
  const [pendingAction, setPendingAction] = useState<
    "upload" | "addRecord" | null
  >(null);

  // Reset page when any filter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — reset page on any filter change
  useEffect(() => {
    setPage(0);
  }, [
    search,
    brandFilter,
    cesFilter,
    regionFilter,
    issueTypeFilter,
    activeCategoryFilter,
  ]);

  // Dynamic region options from data
  const regionOptions = useMemo(
    () => [...new Set(allRecords.map((r) => r.region).filter(Boolean))].sort(),
    [allRecords],
  );

  // Dynamic issue type options: known types + any extras found in data
  const issueTypeOptions = useMemo(() => {
    const fromData = allRecords.map((r) => r.typeOfIssue).filter(Boolean);
    const combined = new Set([...KNOWN_ISSUE_TYPES, ...fromData]);
    return [...combined];
  }, [allRecords]);

  // Combined filter — ALL conditions ANDed on actual dataset
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allRecords.filter((r) => {
      const matchSearch =
        !q ||
        (r.customerName || "").toLowerCase().includes(q) ||
        (r.fiplCode || "").toLowerCase().includes(q) ||
        (r.product || "").toLowerCase().includes(q) ||
        (r.agent || "").toLowerCase().includes(q) ||
        (r.fseName || "").toLowerCase().includes(q) ||
        (r.brand || "").toLowerCase().includes(q);
      const matchBrand =
        brandFilter === "all" ||
        r.brand.toLowerCase() === brandFilter.toLowerCase();
      const matchCes =
        cesFilter === "all" ||
        (cesFilter === "positive" && r.cesScore >= 30) ||
        (cesFilter === "negative" && r.cesScore < 30);
      const matchRegion = regionFilter === "all" || r.region === regionFilter;
      const matchIssueType =
        issueTypeFilter === "all" || r.typeOfIssue === issueTypeFilter;
      const matchCategory =
        !activeCategoryFilter ||
        classifyIssue(r.typeOfIssue).includes(activeCategoryFilter);
      return (
        matchSearch &&
        matchBrand &&
        matchCes &&
        matchRegion &&
        matchIssueType &&
        matchCategory
      );
    });
  }, [
    allRecords,
    search,
    brandFilter,
    cesFilter,
    regionFilter,
    issueTypeFilter,
    activeCategoryFilter,
  ]);

  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Category counts from ALL records (unfiltered, for the sidebar chips)
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryKey, number> = {
      "FSE Issue": 0,
      "Operation and Scheduling Issue": 0,
      "Brand Issue": 0,
      "Technical and Product Issue": 0,
      "After-Sales Issue": 0,
      Satisfied: 0,
      FeedbackFormSent: 0,
      "Wow Factor": 0,
    };
    for (const r of allRecords) {
      for (const cat of classifyIssue(r.typeOfIssue)) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [allRecords]);

  const maxCategoryCount = useMemo(
    () => Math.max(1, ...Object.values(categoryCounts)),
    [categoryCounts],
  );

  const avgCes =
    allRecords.length > 0
      ? allRecords.reduce((s, f) => s + f.cesScore, 0) / allRecords.length
      : 0;

  function handleFormChange(
    field: keyof typeof EMPTY_FORM,
    value: string | number,
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAddRecord() {
    const entry: FeedbackEntry = {
      entryId: 0n,
      fiplCode: form.fiplCode,
      customerName: form.customerName,
      contact: form.contact,
      brand: form.brand,
      product: form.product,
      cesScore: Number(form.cesScore),
      remark: form.remark,
      callDate: form.callDate,
      agent: form.agent,
    };
    try {
      await addFeedback.mutateAsync(entry);
      toast.success("Record added successfully");
      setDialogOpen(false);
      setForm({ ...EMPTY_FORM });
    } catch {
      toast.error("Failed to add record");
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
          sheet,
          { defval: "" },
        );

        const brandMap: Record<
          string,
          Variant_tineco_ecovacs_coway_kuvings_instant
        > = {
          ecovacs: Variant_tineco_ecovacs_coway_kuvings_instant.ecovacs,
          kuvings: Variant_tineco_ecovacs_coway_kuvings_instant.kuvings,
          coway: Variant_tineco_ecovacs_coway_kuvings_instant.coway,
          tineco: Variant_tineco_ecovacs_coway_kuvings_instant.tineco,
          instant: Variant_tineco_ecovacs_coway_kuvings_instant.instant,
        };

        const records: FeedbackEntry[] = rows.map((row) => ({
          entryId: 0n,
          fiplCode: String(row["FIPL Code"] || "").trim(),
          customerName: String(row["Customer Name"] || "").trim(),
          contact: String(row["Customer Contact"] || "").trim(),
          brand:
            brandMap[
              String(row.Brand || "")
                .toLowerCase()
                .trim()
            ] ?? Variant_tineco_ecovacs_coway_kuvings_instant.ecovacs,
          product: String(row.Product || "").trim(),
          cesScore: Number(
            String(row["CES Score"] || "0").replace(/[^\d.]/g, ""),
          ),
          remark: String(row.Remark || "").trim(),
          callDate: String(row["Date of Call"] || "").trim(),
          agent: String(row.Agent || "").trim(),
        }));

        const result = await batchUpload.mutateAsync(records);
        toast.success(
          `${result.successCount} records uploaded successfully${
            result.failCount > 0n ? `, ${result.failCount} failed` : ""
          }`,
        );
      } catch {
        toast.error("Failed to parse or upload file");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  }

  return (
    <div className="space-y-6">
      {/* ── Region Detail Drilldown ────────────────────────────────────────── */}
      {selectedRegion && (
        <RegionDetailPage
          selectedRegion={selectedRegion}
          allRecords={allRecords}
          onBack={() => setSelectedRegion(null)}
          onSelectEmployee={(fipl) => {
            setSelectedRegion(null);
            onSelectEmployee?.(fipl);
          }}
        />
      )}

      {/* Normal Feedback content (hidden while drilldown is open) */}
      {!selectedRegion && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {labels.feedbackTitle}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {allRecords.length} records&nbsp;&middot;&nbsp;Avg CES:{" "}
                <span
                  className={`font-semibold ${
                    avgCes < 30 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {avgCes.toFixed(1)}/40
                </span>
              </p>
            </div>

            {/* View Toggle */}
            <div
              className="inline-flex items-center rounded-lg border bg-muted p-1 gap-1"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === "table"}
                data-ocid="feedback.tab"
                onClick={() => setView("table")}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === "table"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TableIcon className="w-4 h-4" />
                {labels.callingRecordsTab}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "masonry"}
                data-ocid="feedback.tab"
                onClick={() => setView("masonry")}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === "masonry"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Grid2X2 className="w-4 h-4" />
                {labels.customerReviewsTab}
              </button>
            </div>
          </div>

          {/* ─── Region Analysis Panel ─────────────────────────────────────────────── */}
          {!isLoading && allRecords.length > 0 && (
            <RegionAnalysisPanel
              records={
                filtered.length < allRecords.length ? filtered : allRecords
              }
              onSelectRegion={setSelectedRegion}
            />
          )}

          {/* ─── Issue Category Chips ──────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Filter by Category
              </span>
              {activeCategoryFilter && (
                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter(null)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div
              className="flex flex-wrap gap-2"
              data-ocid="feedback.category_chips"
            >
              {ISSUE_CATEGORIES.map((cat) => {
                const count = categoryCounts[cat.key] || 0;
                const pct = Math.round((count / maxCategoryCount) * 100);
                const isActive = activeCategoryFilter === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() =>
                      setActiveCategoryFilter(isActive ? null : cat.key)
                    }
                    data-ocid={`feedback.category.${cat.key.toLowerCase().replace(/\s+/g, "_")}`}
                    className={`group relative flex flex-col gap-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all min-w-[120px] ${cat.color} ${
                      isActive
                        ? "ring-2 ring-offset-1 ring-current shadow-md scale-105"
                        : "opacity-80 hover:opacity-100 hover:scale-105"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{cat.label}</span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 shrink-0 bg-white/60 text-current border-0"
                      >
                        {count}
                      </Badge>
                    </span>
                    {/* Progress bar */}
                    <span className="block h-1 rounded-full bg-current/20 overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-current/60 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── View: Calling Records ─────────────────────────────────────────────── */}
          {view === "table" && (
            <div className="space-y-4">
              {/* Toolbar — row 1: search */}
              <div className="flex flex-col gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-ocid="feedback.search_input"
                    className="pl-9"
                    placeholder="Search by employee, FIPL, customer, brand, product, agent..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Toolbar — row 2: filters + actions */}
                <div className="flex flex-wrap gap-2 items-center">
                  {/* Brand filter */}
                  <Select
                    value={brandFilter}
                    onValueChange={(v) => setBrandFilter(v)}
                  >
                    <SelectTrigger className="w-40" data-ocid="feedback.select">
                      <SelectValue placeholder="All Brands" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {BRANDS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* CES filter */}
                  <Select
                    value={cesFilter}
                    onValueChange={(v) =>
                      setCesFilter(v as "all" | "positive" | "negative")
                    }
                  >
                    <SelectTrigger className="w-44" data-ocid="feedback.select">
                      <SelectValue placeholder="All Feedbacks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Feedbacks</SelectItem>
                      <SelectItem value="positive">
                        Positive (CES &gt;30)
                      </SelectItem>
                      <SelectItem value="negative">
                        Negative (CES ≤30)
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Region filter */}
                  <Select
                    value={regionFilter}
                    onValueChange={(v) => setRegionFilter(v)}
                  >
                    <SelectTrigger className="w-40" data-ocid="feedback.select">
                      <SelectValue placeholder="All Regions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {regionOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Type of Issue filter */}
                  <Select
                    value={issueTypeFilter}
                    onValueChange={(v) => setIssueTypeFilter(v)}
                  >
                    <SelectTrigger className="w-52" data-ocid="feedback.select">
                      <SelectValue placeholder="All Issue Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Issue Types</SelectItem>
                      {issueTypeOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex-1" />

                  {/* Upload Excel */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant="outline"
                    data-ocid="feedback.upload_button"
                    onClick={() => {
                      if (writeGranted) {
                        fileInputRef.current?.click();
                      } else {
                        setPendingAction("upload");
                      }
                    }}
                    disabled={batchUpload.isPending}
                  >
                    {batchUpload.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload Excel
                  </Button>

                  {/* Add Record Button */}
                  <Button
                    data-ocid="feedback.open_modal_button"
                    onClick={() => {
                      if (writeGranted) {
                        setDialogOpen(true);
                      } else {
                        setPendingAction("addRecord");
                      }
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Record
                  </Button>
                </div>
              </div>

              {/* Add Record Dialog (controlled) */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent
                  className="max-w-lg max-h-[90vh] overflow-y-auto"
                  data-ocid="feedback.dialog"
                >
                  <DialogHeader>
                    <DialogTitle>Add Calling Record</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>FIPL Code</Label>
                        <Input
                          data-ocid="feedback.input"
                          value={form.fiplCode}
                          onChange={(e) =>
                            handleFormChange("fiplCode", e.target.value)
                          }
                          placeholder="e.g. FIPL-001"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Customer Name</Label>
                        <Input
                          value={form.customerName}
                          onChange={(e) =>
                            handleFormChange("customerName", e.target.value)
                          }
                          placeholder="Full name"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Contact</Label>
                        <Input
                          value={form.contact}
                          onChange={(e) =>
                            handleFormChange("contact", e.target.value)
                          }
                          placeholder="Phone / email"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Brand</Label>
                        <Select
                          value={form.brand}
                          onValueChange={(v) =>
                            handleFormChange(
                              "brand",
                              v as Variant_tineco_ecovacs_coway_kuvings_instant,
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BRANDS.map((b) => (
                              <SelectItem
                                key={b.toLowerCase()}
                                value={b.toLowerCase()}
                              >
                                {b}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Product</Label>
                        <Input
                          value={form.product}
                          onChange={(e) =>
                            handleFormChange("product", e.target.value)
                          }
                          placeholder="Product name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>CES Score (0–40)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={40}
                          value={form.cesScore}
                          onChange={(e) =>
                            handleFormChange("cesScore", Number(e.target.value))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Remark</Label>
                      <Textarea
                        data-ocid="feedback.textarea"
                        value={form.remark}
                        onChange={(e) =>
                          handleFormChange("remark", e.target.value)
                        }
                        rows={3}
                        placeholder="Notes about the call..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Date of Call</Label>
                        <Input
                          type="date"
                          value={form.callDate}
                          onChange={(e) =>
                            handleFormChange("callDate", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Agent</Label>
                        <Input
                          value={form.agent}
                          onChange={(e) =>
                            handleFormChange("agent", e.target.value)
                          }
                          placeholder="Agent name"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      data-ocid="feedback.cancel_button"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      data-ocid="feedback.submit_button"
                      onClick={handleAddRecord}
                      disabled={addFeedback.isPending}
                    >
                      {addFeedback.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Save Record
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Remark Preview Dialog */}
              <Dialog
                open={remarkRecord !== null}
                onOpenChange={(open) => {
                  if (!open) setRemarkRecord(null);
                }}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Feedback Details</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-semibold">FSE / Employee: </span>
                      {remarkRecord?.fseName || remarkRecord?.fiplCode || "—"}
                    </div>
                    <div>
                      <span className="font-semibold">FIPL Code: </span>
                      {remarkRecord?.fiplCode}
                    </div>
                    {remarkRecord?.region && (
                      <div>
                        <span className="font-semibold">Region: </span>
                        {remarkRecord.region}
                      </div>
                    )}
                    <div>
                      <span className="font-semibold">Customer: </span>
                      {remarkRecord?.customerName}
                    </div>
                    <div>
                      <span className="font-semibold">Brand: </span>
                      {remarkRecord?.brand}
                    </div>
                    <div>
                      <span className="font-semibold">Product: </span>
                      {remarkRecord?.product}
                    </div>
                    <div>
                      <span className="font-semibold">CES Score: </span>
                      <span
                        className={
                          remarkRecord && remarkRecord.cesScore <= 30
                            ? "text-red-600 font-semibold"
                            : "text-green-600 font-semibold"
                        }
                      >
                        {remarkRecord?.cesScore} (
                        {remarkRecord && remarkRecord.cesScore > 30
                          ? "Positive"
                          : "Negative"}
                        )
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold">Date: </span>
                      {formatDisplayDate(remarkRecord?.callDate)}
                    </div>
                    <div>
                      <span className="font-semibold">Agent: </span>
                      {remarkRecord?.agent || "—"}
                    </div>
                    <div>
                      <span className="font-semibold">Type of Issue: </span>
                      {remarkRecord?.typeOfIssue || "—"}
                    </div>
                    <div>
                      <span className="font-semibold">Resolution: </span>
                      {remarkRecord?.resolution || "—"}
                    </div>
                    <div className="border-t pt-3">
                      <span className="font-semibold block mb-1">
                        Full Remark:
                      </span>
                      <p className="text-muted-foreground leading-relaxed">
                        {remarkRecord?.remark || "No remark"}
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Summary bar */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{filtered.length} records</span>
                {filtered.length > 0 && (
                  <span>
                    Avg CES:{" "}
                    <span
                      className={`font-medium ${
                        filtered.reduce((s, f) => s + f.cesScore, 0) /
                          filtered.length <
                        30
                          ? "text-red-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {(
                        filtered.reduce((s, f) => s + f.cesScore, 0) /
                        filtered.length
                      ).toFixed(1)}
                      /40
                    </span>
                  </span>
                )}
              </div>

              {/* Table */}
              <div
                className="rounded-xl border overflow-x-auto"
                data-ocid="feedback.table"
              >
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {[
                        "Date of Call",
                        "FSE",
                        "Customer Name",
                        "Region",
                        "Brand",
                        "Product",
                        "CES Score",
                        "Type of Issue",
                        "Remark",
                        "Agent",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap text-xs uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-10 text-center text-muted-foreground"
                          data-ocid="feedback.loading_state"
                        >
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading records from Google Sheets...
                        </td>
                      </tr>
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-10 text-center text-muted-foreground"
                          data-ocid="feedback.empty_state"
                        >
                          No records found
                        </td>
                      </tr>
                    ) : (
                      paginated.map((f, idx) => (
                        <tr
                          key={f.id}
                          data-ocid={`feedback.item.${idx + 1}`}
                          className={`border-t transition-colors hover:bg-muted/30 ${
                            f.cesScore < 30 ? "bg-red-50/40" : ""
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                            {formatDisplayDate(f.callDate)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-sm">
                              {f.fseName || nameMap[f.fiplCode] || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {f.fiplCode}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {f.customerName}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                            {f.region || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${brandColorClass(
                                f.brand,
                              )}`}
                            >
                              {f.brand}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{f.product}</td>
                          <td className="px-4 py-3">
                            <CesBadge score={f.cesScore} />
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {f.typeOfIssue ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200 whitespace-nowrap">
                                {f.typeOfIssue}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-[200px] text-sm text-muted-foreground">
                            <button
                              type="button"
                              className="line-clamp-2 text-left cursor-pointer hover:text-blue-600 hover:underline bg-transparent border-none p-0"
                              title="Click to view full details"
                              onClick={() => setRemarkRecord(f)}
                            >
                              {f.remark || "—"}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm">{f.agent}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} of {pages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      data-ocid="feedback.pagination_prev"
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-ocid="feedback.pagination_next"
                      disabled={page >= pages - 1}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── View: Customer Reviews (Masonry) ─────────────────────────── */}
          {view === "masonry" && (
            <div className="space-y-4">
              {/* Masonry toolbar */}
              <div className="flex flex-col gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by employee, FIPL, customer, brand, product, agent..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={brandFilter}
                    onValueChange={(v) => setBrandFilter(v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Brands" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {BRANDS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={cesFilter}
                    onValueChange={(v) =>
                      setCesFilter(v as "all" | "positive" | "negative")
                    }
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="All Feedbacks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Feedbacks</SelectItem>
                      <SelectItem value="positive">
                        Positive (CES &gt;30)
                      </SelectItem>
                      <SelectItem value="negative">
                        Negative (CES ≤30)
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={regionFilter}
                    onValueChange={(v) => setRegionFilter(v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Regions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {regionOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={issueTypeFilter}
                    onValueChange={(v) => setIssueTypeFilter(v)}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="All Issue Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Issue Types</SelectItem>
                      {issueTypeOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div
                  className="flex flex-col items-center justify-center py-20 text-muted-foreground"
                  data-ocid="feedback.loading_state"
                >
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  Loading reviews from Google Sheets...
                </div>
              ) : filtered.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-20 text-muted-foreground"
                  data-ocid="feedback.empty_state"
                >
                  <p className="text-lg font-medium">No reviews found</p>
                  <p className="text-sm mt-1">
                    Try adjusting your search or filters
                  </p>
                </div>
              ) : (
                <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
                  {filtered.map((f, idx) => (
                    <ReviewCard key={f.id} entry={f} idx={idx} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Password Gate */}
          {pendingAction && (
            <PasswordGate
              gateKey="feedback-write"
              onUnlock={() => {
                grantWrite();
                if (pendingAction === "upload") fileInputRef.current?.click();
                if (pendingAction === "addRecord") setDialogOpen(true);
                setPendingAction(null);
              }}
              onCancel={() => setPendingAction(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function ReviewCard({
  entry: f,
  idx,
}: {
  entry: DisplayRecord;
  idx: number;
}) {
  const isLow = f.cesScore < 30;

  return (
    <div
      data-ocid={`feedback.item.${idx + 1}`}
      className={`break-inside-avoid mb-4 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${
        isLow
          ? "border-l-4 border-l-red-500"
          : "border-l-4 border-l-emerald-400"
      }`}
    >
      {/* Top row: name + low CES badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-bold text-base leading-tight">{f.customerName}</p>
        {isLow && (
          <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 uppercase tracking-wide">
            Low CES
          </span>
        )}
      </div>

      {/* Stars + score */}
      <div className="flex items-center gap-2 mb-3">
        <StarRating score={f.cesScore} />
        <span
          className={`text-xs font-semibold ${
            isLow ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {f.cesScore}/40
        </span>
      </div>

      {/* Brand badge */}
      <div className="mb-2 flex flex-wrap gap-1">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${brandColorClass(
            f.brand,
          )}`}
        >
          {f.brand}
        </span>
        {f.typeOfIssue && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200">
            {f.typeOfIssue}
          </span>
        )}
      </div>

      {/* Product */}
      <p className="text-sm font-medium mb-1">{f.product}</p>

      {/* Remark */}
      {f.remark && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {f.remark}
        </p>
      )}

      {/* Resolution */}
      {f.resolution && (
        <p className="text-xs text-muted-foreground italic mb-2">
          <span className="font-semibold not-italic">Resolution:</span>{" "}
          {f.resolution}
        </p>
      )}

      {/* Footer */}
      <div className="border-t pt-2 mt-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatDisplayDate(f.callDate)}
          </span>
          <span className="text-xs text-muted-foreground">
            Agent: {f.agent}
          </span>
        </div>
        {(f.fseName || f.fiplCode) && (
          <p className="text-xs text-muted-foreground">
            FSE: <span className="font-medium">{f.fseName || f.fiplCode}</span>{" "}
            {f.fseName && <span className="font-mono">({f.fiplCode})</span>}
          </p>
        )}
        {f.region && (
          <p className="text-xs text-muted-foreground">
            Region: <span className="font-medium">{f.region}</span>
          </p>
        )}
      </div>
    </div>
  );
}
