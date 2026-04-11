import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart2,
  Calendar,
  Loader2,
  Palette,
  Settings as SettingsIcon,
  Star,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLabels } from "../contexts/UILabelsContext";
import { DEFAULT_UI_LABELS, type UILabels } from "../data/uiLabels";
import { useActor } from "../hooks/useActor";

interface DataCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  deleteMethod: string;
  color: string;
}

const DATA_CATEGORIES: DataCategory[] = [
  {
    id: "employees",
    label: "Employees",
    description:
      "All employee profiles and all related data (cascades to sales, attendance, SWOT, performance)",
    icon: Users,
    deleteMethod: "deleteAllEmployees",
    color: "text-blue-500",
  },
  {
    id: "sales",
    label: "Sales Records",
    description: "All sales transactions, brands, and amounts",
    icon: BarChart2,
    deleteMethod: "deleteAllSales",
    color: "text-green-500",
  },
  {
    id: "attendance",
    label: "Attendance Records",
    description: "All attendance lapses and off-day records",
    icon: Calendar,
    deleteMethod: "deleteAllAttendance",
    color: "text-orange-500",
  },
  {
    id: "performances",
    label: "Parameters / Performance",
    description: "Sales influence index, KPIs, demo visits, and skill scores",
    icon: Zap,
    deleteMethod: "deleteAllPerformances",
    color: "text-purple-500",
  },
  {
    id: "swot",
    label: "SWOT Analysis",
    description:
      "Strengths, weaknesses, opportunities, threats, and CES scores",
    icon: AlertTriangle,
    deleteMethod: "deleteAllSWOT",
    color: "text-yellow-500",
  },
  {
    id: "feedback",
    label: "Feedback / Calling Records",
    description: "Customer feedback, calling records, and CES ratings",
    icon: Star,
    deleteMethod: "deleteAllFeedback",
    color: "text-pink-500",
  },
  {
    id: "topPerformers",
    label: "Top Performers",
    description: "Uploaded top performer rankings and achievements",
    icon: Star,
    deleteMethod: "deleteAllTopPerformers",
    color: "text-amber-500",
  },
];

export function Settings() {
  const { actor } = useActor();
  const { labels, saveAll, resetAll, isSyncing } = useLabels();
  const [draftLabels, setDraftLabels] = useState<UILabels>({ ...labels });
  const [isSaving, setIsSaving] = useState(false);

  const handleLabelChange = (key: keyof UILabels, value: string) => {
    setDraftLabels((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveLabels = async () => {
    setIsSaving(true);
    try {
      await saveAll(draftLabels);
      toast.success("UI labels saved — visible to all users");
    } catch {
      toast.error("Failed to save labels");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetLabels = async () => {
    await resetAll();
    setDraftLabels({ ...DEFAULT_UI_LABELS });
    toast.success("UI labels reset to defaults");
  };
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleCategory = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelectedMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const selectedCategories = DATA_CATEGORIES.filter((c) =>
        selected.has(c.id),
      );
      await Promise.all(
        selectedCategories.map((cat) => (actor as any)[cat.deleteMethod]()),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      const labels = DATA_CATEGORIES.filter((c) => selected.has(c.id)).map(
        (c) => c.label,
      );
      toast.success(`Cleared: ${labels.join(", ")}`);
      setSelected(new Set());
    },
    onError: (err) => {
      toast.error(
        `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    },
  });

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.deleteAllData();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("All data has been reset successfully");
      setSelected(new Set());
    },
    onError: (err) => {
      toast.error(
        `Reset failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    },
  });

  const selectedCount = selected.size;

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <SettingsIcon size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {labels.settingsTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your application data
          </p>
        </div>
      </div>

      {/* UI Customization */}
      <div className="bg-card rounded-lg shadow-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Palette size={16} className="text-primary" />
          <h2 className="font-semibold text-foreground text-base">
            UI Customization
          </h2>
          {isSyncing && (
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <Loader2 size={11} className="animate-spin" /> Syncing...
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Edit labels and titles across the dashboard. Changes are saved to the
          backend and visible to all users with the link.
        </p>

        {/* Navigation group */}
        <div className="mb-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Navigation
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                "navDashboard",
                "navEmployees",
                "navSalesTrends",
                "navFeedback",
                "navTopPerformers",
                "navSuggestionsIssues",
                "navUploads",
                "navSettings",
              ] as const
            ).map((key) => (
              <div key={key} className="space-y-1">
                <label
                  htmlFor={`label-${key}`}
                  className="text-xs text-muted-foreground"
                >
                  {key}
                </label>
                <Input
                  id={`label-${key}`}
                  data-ocid={`settings.${key}.input`}
                  value={draftLabels[key]}
                  onChange={(e) => handleLabelChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Page Titles group */}
        <div className="mb-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Page Titles
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                "dashboardTitle",
                "dashboardSubtitle",
                "employeesTitle",
                "salesTrendsTitle",
                "feedbackTitle",
                "topPerformersTitle",
                "suggestionsIssuesTitle",
                "settingsTitle",
              ] as const
            ).map((key) => (
              <div key={key} className="space-y-1">
                <label
                  htmlFor={`label-${key}`}
                  className="text-xs text-muted-foreground"
                >
                  {key}
                </label>
                <Input
                  id={`label-${key}`}
                  data-ocid={`settings.${key}.input`}
                  value={draftLabels[key]}
                  onChange={(e) => handleLabelChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard Sections group */}
        <div className="mb-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Dashboard Sections
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                "issuesSectionHeader",
                "suggestionsSectionHeader",
                "topPerformersSectionHeader",
                "statTotalEmployees",
                "statTotalSales",
                "statAvgCes",
                "statActiveCount",
              ] as const
            ).map((key) => (
              <div key={key} className="space-y-1">
                <label
                  htmlFor={`label-${key}`}
                  className="text-xs text-muted-foreground"
                >
                  {key}
                </label>
                <Input
                  id={`label-${key}`}
                  data-ocid={`settings.${key}.input`}
                  value={draftLabels[key]}
                  onChange={(e) => handleLabelChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Feedback Tabs group */}
        <div className="mb-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Feedback Tabs
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["callingRecordsTab", "customerReviewsTab"] as const).map(
              (key) => (
                <div key={key} className="space-y-1">
                  <label
                    htmlFor={`label-${key}`}
                    className="text-xs text-muted-foreground"
                  >
                    {key}
                  </label>
                  <Input
                    id={`label-${key}`}
                    data-ocid={`settings.${key}.input`}
                    value={draftLabels[key]}
                    onChange={(e) => handleLabelChange(key, e.target.value)}
                  />
                </div>
              ),
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <button
            type="button"
            data-ocid="settings.ui_labels.save_button"
            onClick={handleSaveLabels}
            disabled={isSaving}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {isSaving && <Loader2 size={13} className="animate-spin" />}
            Save Changes
          </button>
          <button
            type="button"
            data-ocid="settings.ui_labels.reset_button"
            onClick={handleResetLabels}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-card rounded-lg shadow-card p-6">
        <div className="mb-4">
          <h2 className="font-semibold text-foreground text-base">
            Data Management
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select categories to delete. This action is irreversible.
          </p>
        </div>
        <div className="space-y-3">
          {DATA_CATEGORIES.map((cat, idx) => {
            const Icon = cat.icon;
            const isChecked = selected.has(cat.id);
            return (
              <button
                type="button"
                key={cat.id}
                data-ocid={`settings.category.item.${idx + 1}`}
                className={`w-full flex items-start gap-4 p-4 rounded-lg border transition-colors text-left ${
                  isChecked
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-border hover:border-border/70 hover:bg-muted/30"
                }`}
                onClick={() => toggleCategory(cat.id)}
              >
                <Checkbox
                  data-ocid={`settings.category.checkbox.${idx + 1}`}
                  checked={isChecked}
                  onCheckedChange={() => toggleCategory(cat.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5"
                />
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className={cat.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {cat.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {cat.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-card rounded-lg border-2 border-destructive/30 p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={16} className="text-destructive" />
          <h2 className="font-semibold text-destructive text-base">
            Danger Zone
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          These actions are permanent and cannot be undone.
        </p>

        <Separator className="mb-5" />

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Delete Selected */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                data-ocid="settings.delete_selected.delete_button"
                variant="destructive"
                disabled={
                  selectedCount === 0 || deleteSelectedMutation.isPending
                }
                className="gap-2"
              >
                {deleteSelectedMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Delete Selected
                {selectedCount > 0 && (
                  <span className="ml-1 bg-white/20 rounded-full px-1.5 py-0.5 text-xs">
                    {selectedCount}
                  </span>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent data-ocid="settings.delete_selected.dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Selected Categories?</AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to permanently delete data from{" "}
                  <strong>{selectedCount}</strong> categor
                  {selectedCount === 1 ? "y" : "ies"}:
                  <ul className="mt-2 space-y-1 text-sm">
                    {DATA_CATEGORIES.filter((c) => selected.has(c.id)).map(
                      (c) => (
                        <li key={c.id} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />
                          {c.label}
                        </li>
                      ),
                    )}
                  </ul>
                  <span className="block mt-3 font-medium text-destructive">
                    This action cannot be undone.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-ocid="settings.delete_selected.cancel_button">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  data-ocid="settings.delete_selected.confirm_button"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteSelectedMutation.mutate()}
                >
                  Yes, Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Reset All */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                data-ocid="settings.reset_all.delete_button"
                variant="outline"
                disabled={resetAllMutation.isPending}
                className="gap-2 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                {resetAllMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Reset All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent data-ocid="settings.reset_all.dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>Reset All Data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete{" "}
                  <strong>
                    all employees, sales, attendance, SWOT, performance,
                    feedback, and top performers
                  </strong>{" "}
                  from the system.
                  <span className="block mt-3 font-medium text-destructive">
                    This action is irreversible. You will lose all data.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-ocid="settings.reset_all.cancel_button">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  data-ocid="settings.reset_all.confirm_button"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => resetAllMutation.mutate()}
                >
                  Yes, Reset Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
