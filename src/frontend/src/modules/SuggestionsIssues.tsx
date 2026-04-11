import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLabels } from "../contexts/UILabelsContext";
import { useActor } from "../hooks/useActor";
import { SHEET_NAMES, cell, fetchSheetByName } from "../lib/googleSheets";

const ISSUE_CATEGORIES = [
  "FSE General Issues",
  "Brand Issues",
  "Operational Issues",
  "Other",
] as const;

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  status?: string;
  createdAt: string;
}

export interface Issue {
  id: string;
  title: string;
  category: string;
  description: string;
  status?: string;
  createdAt: string;
}

const SUGGESTIONS_KV_KEY = "suggestions";
const ISSUES_KV_KEY = "issues";

function unwrapOptional<T>(val: unknown): T | null {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val.length > 0 ? (val[0] as T) : null;
  return val as T;
}

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Status badge helpers ─────────────────────────────────────────────────────

function issueStatusBadge(status: string | undefined) {
  if (!status) return null;
  const s = status.trim().toLowerCase();
  if (s === "resolved")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
        ✓ Resolved
      </span>
    );
  if (s === "unresolved")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
        ✗ Unresolved
      </span>
    );
  if (s === "in-progress" || s === "in progress")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
        ⏳ In-Progress
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
      {status}
    </span>
  );
}

function suggestionStatusBadge(status: string | undefined) {
  if (!status) return null;
  const s = status.trim().toLowerCase();
  if (s === "implemented")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
        ✓ Implemented
      </span>
    );
  if (s === "not implemented")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
        ✗ Not Implemented
      </span>
    );
  if (s === "in-progress" || s === "in progress")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
        ⏳ In-Progress
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
      {status}
    </span>
  );
}

// ── Backend KV persistent list ─────────────────────────────────────────────

function usePersistentList<T>(kvKey: string) {
  const { actor } = useActor();
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchFromBackend = useCallback(async () => {
    if (!actor) return;
    try {
      const raw = await (actor as any).getKV(kvKey);
      const val = unwrapOptional<string>(raw);
      if (val) {
        const parsed: T[] = JSON.parse(val);
        setItems(parsed);
      } else {
        setItems([]);
      }
    } catch (e) {
      console.warn(`[${kvKey}] KV fetch failed`, e);
    } finally {
      setLoaded(true);
    }
  }, [actor, kvKey]);

  useEffect(() => {
    if (!actor) return;
    (async () => {
      try {
        const raw = await (actor as any).getKV(kvKey);
        const val = unwrapOptional<string>(raw);
        if (val) {
          const parsed: T[] = JSON.parse(val);
          setItems(parsed);
        }
      } catch (e) {
        console.warn(`[${kvKey}] KV load failed`, e);
      } finally {
        setLoaded(true);
      }
    })();
  }, [actor, kvKey]);

  // Poll every 30 seconds
  useEffect(() => {
    if (!actor || !loaded) return;
    const interval = setInterval(fetchFromBackend, 30000);
    return () => clearInterval(interval);
  }, [actor, loaded, fetchFromBackend]);

  const save = useCallback(
    async (newItems: T[]) => {
      setItems(newItems);
      if (!actor) throw new Error("No actor available");
      await (actor as any).setKV(kvKey, JSON.stringify(newItems));
    },
    [actor, kvKey],
  );

  return { items, save, loaded, refresh: fetchFromBackend };
}

// ── Sheet data hooks ───────────────────────────────────────────────────────

function useSheetSuggestions() {
  return useQuery({
    queryKey: ["sheet-suggestions"],
    queryFn: async () => {
      let sheet: Awaited<ReturnType<typeof fetchSheetByName>>;
      try {
        sheet = await fetchSheetByName(SHEET_NAMES.suggestions);
      } catch (err) {
        console.error("[Suggestions] Failed to fetch sheet:", err);
        toast.error("Could not load Suggestions sheet");
        return [];
      }

      console.log(`[Suggestions] Fetched ${sheet.rows.length} rows from sheet`);
      console.log("[Suggestions] Headers:", sheet.headers);
      if (sheet.rows.length > 0) {
        console.log("[Suggestions] First 3 raw rows:", sheet.rows.slice(0, 3));
      }

      const { headers, rows } = sheet;

      // Header-name lookup with positional fallback
      // Col A = Title (0), Col B = Suggestion text (1), Col C = Status (2)
      const getTitle = (row: string[]) => {
        const byName = cell(row, headers, "title", "Title");
        return byName || row[0] || "";
      };
      const getSuggestion = (row: string[]) => {
        const byName = cell(
          row,
          headers,
          "suggestion",
          "Suggestion",
          "description",
          "Description",
        );
        return byName || row[1] || "";
      };
      const getStatus = (row: string[]) => {
        const byName = cell(row, headers, "status", "Status");
        return byName || row[2] || "";
      };

      const result = rows
        .map((row, i) => {
          const title = getTitle(row).trim();
          const description = getSuggestion(row).trim();
          const statusRaw = getStatus(row).trim();
          return {
            id: `sheet_s_${i}`,
            title,
            description,
            status: statusRaw || undefined,
            createdAt: "",
          };
        })
        .filter((r) => r.title);

      console.log(`[Suggestions] Parsed ${result.length} valid suggestions`);
      return result;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

function useSheetIssues() {
  return useQuery({
    queryKey: ["sheet-issues"],
    queryFn: async () => {
      let sheet: Awaited<ReturnType<typeof fetchSheetByName>>;
      try {
        sheet = await fetchSheetByName(SHEET_NAMES.issues);
      } catch (err) {
        console.error("[Issues] Failed to fetch sheet:", err);
        toast.error("Could not load Issues sheet");
        return [];
      }

      console.log(`[Issues] Fetched ${sheet.rows.length} rows from sheet`);
      console.log("[Issues] Headers:", sheet.headers);
      if (sheet.rows.length > 0) {
        console.log("[Issues] First 3 raw rows:", sheet.rows.slice(0, 3));
      }

      const { headers, rows } = sheet;

      // Header-name lookup with positional fallback
      // Col A = Title (0), Col B = Category (1), Col C = Description (2), Col D = Status (3)
      const getTitle = (row: string[]) => {
        const byName = cell(row, headers, "title", "Title");
        return byName || row[0] || "";
      };
      const getCategory = (row: string[]) => {
        const byName = cell(row, headers, "category", "Category");
        return byName || row[1] || "";
      };
      const getDescription = (row: string[]) => {
        const byName = cell(
          row,
          headers,
          "description",
          "Description",
          "details",
          "Details",
        );
        return byName || row[2] || "";
      };
      const getStatus = (row: string[]) => {
        const byName = cell(row, headers, "status", "Status");
        return byName || row[3] || "";
      };

      const result = rows
        .map((row, i) => {
          const title = getTitle(row).trim();
          const category = getCategory(row).trim();
          const description = getDescription(row).trim();
          const statusRaw = getStatus(row).trim();
          return {
            id: `sheet_i_${i}`,
            title,
            category,
            description,
            status: statusRaw || undefined,
            createdAt: "",
          };
        })
        .filter((r) => r.title);

      console.log(`[Issues] Parsed ${result.length} valid issues`);
      return result;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// ── Preview Card ─────────────────────────────────────────────────────────────

function SuggestionCard({
  item,
  expanded,
  onToggle,
}: {
  item: Suggestion;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isLiveSheet = item.id.startsWith("sheet_");
  return (
    <div
      className="rounded-xl border border-border bg-card hover:border-amber-300 transition-all shadow-sm overflow-hidden"
      data-ocid={`suggestions.card.${item.id}`}
    >
      {/* Preview row — clickable button */}
      <button
        type="button"
        className="w-full text-left flex items-start gap-3 p-4 cursor-pointer"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <Lightbulb size={15} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground leading-snug">
              {item.title}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {isLiveSheet && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium">
                  Live
                </span>
              )}
              {suggestionStatusBadge(item.status)}
              {expanded ? (
                <ChevronUp size={14} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={14} className="text-muted-foreground" />
              )}
            </div>
          </div>
          {!expanded && item.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 text-left">
              {item.description}
            </p>
          )}
          {item.createdAt && !expanded && (
            <p className="text-xs text-muted-foreground mt-1 text-left">
              {formatDate(item.createdAt)}
            </p>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 bg-amber-50/30">
          <div className="space-y-3">
            {item.description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Suggestion
                </p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {item.description}
                </p>
              </div>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Status
                </p>
                {item.status ? (
                  suggestionStatusBadge(item.status)
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
              {item.createdAt && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Date
                  </p>
                  <p className="text-xs text-foreground">
                    {formatDate(item.createdAt)}
                  </p>
                </div>
              )}
              {isLiveSheet && (
                <Badge variant="outline" className="text-xs">
                  From Live Sheet
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueCard({
  item,
  expanded,
  onToggle,
}: {
  item: Issue;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isLiveSheet = item.id.startsWith("sheet_");
  return (
    <div
      className="rounded-xl border border-border bg-card hover:border-red-300 transition-all shadow-sm overflow-hidden"
      data-ocid={`issues.card.${item.id}`}
    >
      {/* Preview row — clickable button */}
      <button
        type="button"
        className="w-full text-left flex items-start gap-3 p-4 cursor-pointer"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle size={15} className="text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground leading-snug">
              {item.title}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {isLiveSheet && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium">
                  Live
                </span>
              )}
              {issueStatusBadge(item.status)}
              {expanded ? (
                <ChevronUp size={14} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={14} className="text-muted-foreground" />
              )}
            </div>
          </div>
          {item.category && (
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium">
              {item.category}
            </span>
          )}
          {!expanded && item.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 text-left">
              {item.description}
            </p>
          )}
          {item.createdAt && !expanded && (
            <p className="text-xs text-muted-foreground mt-1 text-left">
              {formatDate(item.createdAt)}
            </p>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 bg-red-50/30">
          <div className="space-y-3">
            {item.description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Description
                </p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {item.description}
                </p>
              </div>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {item.category && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Category
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                    {item.category}
                  </span>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Status
                </p>
                {item.status ? (
                  issueStatusBadge(item.status)
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
              {item.createdAt && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Date
                  </p>
                  <p className="text-xs text-foreground">
                    {formatDate(item.createdAt)}
                  </p>
                </div>
              )}
              {isLiveSheet && (
                <Badge variant="outline" className="text-xs">
                  From Live Sheet
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SuggestionsIssues() {
  const { labels } = useLabels();
  const [activeTab, setActiveTab] = useState<"issues" | "suggestions">(
    "issues",
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Suggestions data
  const {
    items: kvSuggestions,
    save: saveSuggestions,
    loaded: suggestionsLoaded,
    refresh: refreshSuggestions,
  } = usePersistentList<Suggestion>(SUGGESTIONS_KV_KEY);
  const { data: sheetSuggestions = [], refetch: refetchSheetSuggestions } =
    useSheetSuggestions();
  const allSuggestions: Suggestion[] = [...sheetSuggestions, ...kvSuggestions];

  // Issues data
  const {
    items: kvIssues,
    save: saveIssues,
    loaded: issuesLoaded,
    refresh: refreshIssues,
  } = usePersistentList<Issue>(ISSUES_KV_KEY);
  const { data: sheetIssues = [], refetch: refetchSheetIssues } =
    useSheetIssues();
  const allIssues: Issue[] = [...sheetIssues, ...kvIssues];

  // Dialog state — Suggestion
  const [suggDialogOpen, setSuggDialogOpen] = useState(false);
  const [suggTitle, setSuggTitle] = useState("");
  const [suggDesc, setSuggDesc] = useState("");
  const [suggTitleError, setSuggTitleError] = useState(false);

  // Dialog state — Issue
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueCategory, setIssueCategory] = useState("");
  const [issueDesc, setIssueDesc] = useState("");
  const [issueTitleError, setIssueTitleError] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    await Promise.all([
      refreshSuggestions(),
      refreshIssues(),
      refetchSheetSuggestions(),
      refetchSheetIssues(),
    ]);
    setIsRefreshing(false);
    toast.success("Data refreshed");
  }

  async function handleSaveSuggestion() {
    if (!suggTitle.trim()) {
      setSuggTitleError(true);
      return;
    }
    try {
      const newItem: Suggestion = {
        id: `s_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        title: suggTitle.trim(),
        description: suggDesc.trim(),
        status: undefined,
        createdAt: new Date().toISOString(),
      };
      await saveSuggestions([newItem, ...kvSuggestions]);
      setSuggDialogOpen(false);
      setSuggTitle("");
      setSuggDesc("");
      toast.success("Suggestion saved");
    } catch {
      toast.error("Failed to save");
    }
  }

  async function handleSaveIssue() {
    if (!issueTitle.trim()) {
      setIssueTitleError(true);
      return;
    }
    try {
      const newItem: Issue = {
        id: `i_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        title: issueTitle.trim(),
        category: issueCategory || ISSUE_CATEGORIES[0],
        description: issueDesc.trim(),
        status: undefined,
        createdAt: new Date().toISOString(),
      };
      await saveIssues([newItem, ...kvIssues]);
      setIssueDialogOpen(false);
      setIssueTitle("");
      setIssueCategory("");
      setIssueDesc("");
      toast.success("Issue saved");
    } catch {
      toast.error("Failed to save");
    }
  }

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const loaded =
    activeTab === "issues"
      ? issuesLoaded || allIssues.length > 0
      : suggestionsLoaded || allSuggestions.length > 0;
  const isEmpty =
    activeTab === "issues"
      ? allIssues.length === 0
      : allSuggestions.length === 0;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {activeTab === "issues"
              ? labels.issuesSectionHeader || "Issues"
              : labels.suggestionsSectionHeader || "Suggestions"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeTab === "issues"
              ? "Reported FSE and operational issues"
              : "Ideas and suggestions from the organization"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh data"
            data-ocid="suggissues.refresh_button"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </Button>
          {activeTab === "suggestions" ? (
            <Button
              size="sm"
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                setSuggTitle("");
                setSuggDesc("");
                setSuggTitleError(false);
                setSuggDialogOpen(true);
              }}
              data-ocid="suggestions.add_button"
            >
              <Plus size={14} />
              Add Suggestion
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => {
                setIssueTitle("");
                setIssueCategory("");
                setIssueDesc("");
                setIssueTitleError(false);
                setIssueDialogOpen(true);
              }}
              data-ocid="issues.add_button"
            >
              <Plus size={14} />
              Add Issue
            </Button>
          )}
        </div>
      </div>

      {/* Toggle switch */}
      <div
        className="flex gap-1 p-1 bg-muted rounded-xl w-fit"
        data-ocid="suggissues.toggle"
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab("issues");
            setExpandedId(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "issues"
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-ocid="suggissues.issues_tab"
        >
          <AlertCircle
            size={14}
            className={activeTab === "issues" ? "text-red-500" : ""}
          />
          Issues
          {allIssues.length > 0 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === "issues"
                  ? "bg-red-100 text-red-700"
                  : "bg-muted-foreground/20 text-muted-foreground"
              }`}
            >
              {allIssues.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("suggestions");
            setExpandedId(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "suggestions"
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-ocid="suggissues.suggestions_tab"
        >
          <Lightbulb
            size={14}
            className={activeTab === "suggestions" ? "text-amber-500" : ""}
          />
          Suggestions
          {allSuggestions.length > 0 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === "suggestions"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-muted-foreground/20 text-muted-foreground"
              }`}
            >
              {allSuggestions.length}
            </span>
          )}
        </button>
      </div>

      {/* Card list */}
      {!loaded ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading...
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {activeTab === "issues" ? (
            <>
              <AlertCircle size={40} className="text-red-200 mb-3" />
              <p className="font-medium text-sm">No issues reported</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add Issue" to report one
              </p>
            </>
          ) : (
            <>
              <Lightbulb size={40} className="text-amber-200 mb-3" />
              <p className="font-medium text-sm">No suggestions yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add Suggestion" to submit one
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {activeTab === "issues"
            ? allIssues.map((item) => (
                <IssueCard
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  onToggle={() => toggleExpand(item.id)}
                />
              ))
            : allSuggestions.map((item) => (
                <SuggestionCard
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  onToggle={() => toggleExpand(item.id)}
                />
              ))}
        </div>
      )}

      {/* Add Suggestion Dialog */}
      <Dialog open={suggDialogOpen} onOpenChange={setSuggDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <Lightbulb size={17} className="text-amber-600" />
              </div>
              <div>
                <DialogTitle>Add Suggestion</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Share your idea with the organization
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="sugg-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sugg-title"
                placeholder="Enter suggestion title"
                value={suggTitle}
                onChange={(e) => {
                  setSuggTitle(e.target.value);
                  setSuggTitleError(false);
                }}
                className={suggTitleError ? "border-destructive" : ""}
                data-ocid="suggestions.title_input"
              />
              {suggTitleError && (
                <p className="text-xs text-destructive">Title is required</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sugg-desc">Description</Label>
              <Textarea
                id="sugg-desc"
                placeholder="Describe your suggestion..."
                value={suggDesc}
                onChange={(e) => setSuggDesc(e.target.value)}
                rows={3}
                data-ocid="suggestions.desc_input"
              />
            </div>
            <div className="flex justify-between pt-1">
              <Button
                variant="outline"
                onClick={() => setSuggDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleSaveSuggestion}
                data-ocid="suggestions.submit_button"
              >
                Save Suggestion
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Issue Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle size={17} className="text-red-600" />
              </div>
              <div>
                <DialogTitle>Report Issue</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Report an FSE or operational issue
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="issue-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="issue-title"
                placeholder="Enter issue title"
                value={issueTitle}
                onChange={(e) => {
                  setIssueTitle(e.target.value);
                  setIssueTitleError(false);
                }}
                className={issueTitleError ? "border-destructive" : ""}
                data-ocid="issues.title_input"
              />
              {issueTitleError && (
                <p className="text-xs text-destructive">Title is required</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issue-category">Category</Label>
              <Select value={issueCategory} onValueChange={setIssueCategory}>
                <SelectTrigger id="issue-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issue-desc">Description</Label>
              <Textarea
                id="issue-desc"
                placeholder="Describe the issue..."
                value={issueDesc}
                onChange={(e) => setIssueDesc(e.target.value)}
                rows={3}
                data-ocid="issues.desc_input"
              />
            </div>
            <div className="flex justify-between pt-1">
              <Button
                variant="outline"
                onClick={() => setIssueDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleSaveIssue}
                data-ocid="issues.submit_button"
              >
                Save Issue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
