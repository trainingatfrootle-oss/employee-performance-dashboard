import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  MessageSquare,
  Settings,
  ShieldCheck,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useLabels } from "../contexts/UILabelsContext";

export type Module =
  | "dashboard"
  | "employees"
  | "sales"
  | "feedback"
  | "uploads"
  | "settings"
  | "suggestions"
  | "regional-analysis";

interface SidebarProps {
  active: Module;
  onNavigate: (module: Module) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const { labels } = useLabels();
  const [collapsed, setCollapsed] = useState(false);
  const navItems: { id: Module; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: labels.navDashboard, icon: LayoutDashboard },
    { id: "employees", label: labels.navEmployees, icon: Users },
    { id: "sales", label: labels.navSalesTrends, icon: TrendingUp },
    { id: "feedback", label: labels.navFeedback, icon: MessageSquare },
    { id: "regional-analysis", label: "Regional Analysis", icon: MapPin },
    { id: "suggestions", label: labels.navSuggestionsIssues, icon: Lightbulb },
    { id: "uploads", label: labels.navUploads, icon: Upload },
    { id: "settings", label: labels.navSettings, icon: Settings },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={`sidebar-gradient h-full flex-shrink-0 flex flex-col transition-all duration-200 ${
          collapsed ? "w-16" : "w-[240px]"
        }`}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div
          className={`flex items-center gap-2.5 px-3 py-5 border-b border-[#1a3560] ${
            collapsed ? "justify-center px-3" : "px-5"
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={18} className="text-white" />
          </div>
          {!collapsed && (
            <span className="text-white font-bold text-lg tracking-tight">
              Performance Hub
            </span>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            const btn = (
              <button
                type="button"
                key={id}
                data-ocid={`nav.${id}.link`}
                onClick={() => onNavigate(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  collapsed ? "justify-center" : "text-left"
                } ${
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "text-sidebar-foreground hover:bg-[#1a3560] hover:text-white"
                }`}
              >
                <Icon size={17} className="flex-shrink-0" />
                {!collapsed && label}
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            }
            return btn;
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="px-2 pb-6">
          <button
            type="button"
            data-ocid="nav.collapse.toggle"
            onClick={() => setCollapsed((c) => !c)}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg border border-[#2a4870] text-sidebar-foreground text-sm hover:bg-[#1a3560] hover:text-white transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            {!collapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
