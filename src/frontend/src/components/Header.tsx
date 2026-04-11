import { getAvatarColor } from "../lib/dateUtils";
import type { Module } from "./Sidebar";

const MODULE_TITLES: Record<Module, string> = {
  dashboard: "Dashboard",
  employees: "Employees",
  sales: "Sales Trends",
  feedback: "Feedback",
  settings: "Settings",
  uploads: "Top Performers",
  suggestions: "Suggestions & Issues",
};

interface HeaderProps {
  active: Module;
}

export function Header({ active }: HeaderProps) {
  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-xl font-bold text-foreground">
        {MODULE_TITLES[active]}
      </h1>
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer"
          style={{ backgroundColor: getAvatarColor("Froole Representative") }}
        >
          FR
        </div>
      </div>
    </header>
  );
}
