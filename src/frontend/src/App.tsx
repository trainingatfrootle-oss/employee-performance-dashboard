import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Header } from "./components/Header";
import { PasswordGate } from "./components/PasswordGate";
import { type Module, Sidebar } from "./components/Sidebar";
import { UILabelsProvider } from "./contexts/UILabelsContext";
import Dashboard from "./modules/Dashboard";
import EmployeeProfile from "./modules/EmployeeProfile";
import Employees from "./modules/Employees";
import Feedback from "./modules/Feedback";
import RegionalAnalysis from "./modules/RegionalAnalysis";
import SalesTrends from "./modules/SalesTrends";
import { Settings } from "./modules/Settings";
import SuggestionsIssues from "./modules/SuggestionsIssues";
import Uploads from "./modules/Uploads";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// Modules that require password
const PROTECTED_MODULES: Module[] = ["uploads", "settings"];

// Persisted filter state shape for Employees tab
export interface EmployeeFilterState {
  search: string;
  categoryFilter: string;
  regionFilter: string;
  statusFilter: "all" | "active" | "onHold" | "inactive";
  agentFilter: string;
  page: number;
  sortField: "none" | "efficiency" | "lapses" | "sales";
  sortDir: "asc" | "desc";
}

const DEFAULT_EMPLOYEE_FILTERS: EmployeeFilterState = {
  search: "",
  categoryFilter: "all",
  regionFilter: "all",
  statusFilter: "all",
  agentFilter: "all",
  page: 1,
  sortField: "none",
  sortDir: "desc",
};

function AppContent() {
  const [activeModule, setActiveModule] = useState<Module>("dashboard");
  const [selectedFiplCode, setSelectedFiplCode] = useState<string | null>(null);
  const [pendingModule, setPendingModule] = useState<Module | null>(null);

  // Persisted employee filter state — survives profile navigation
  const employeeFiltersRef = useRef<EmployeeFilterState>({
    ...DEFAULT_EMPLOYEE_FILTERS,
  });
  const [employeeFilters, setEmployeeFilters] = useState<EmployeeFilterState>({
    ...DEFAULT_EMPLOYEE_FILTERS,
  });

  const updateEmployeeFilters = (patch: Partial<EmployeeFilterState>) => {
    const next = { ...employeeFiltersRef.current, ...patch };
    employeeFiltersRef.current = next;
    setEmployeeFilters({ ...next });
  };

  const handleNavigate = (mod: Module) => {
    if (PROTECTED_MODULES.includes(mod)) {
      setPendingModule(mod);
    } else {
      setActiveModule(mod);
      setSelectedFiplCode(null);
    }
  };

  const handlePasswordUnlock = () => {
    if (pendingModule) {
      setActiveModule(pendingModule);
      setSelectedFiplCode(null);
      setPendingModule(null);
    }
  };

  const handlePasswordCancel = () => {
    setPendingModule(null);
  };

  // Navigate to employee profile from any module
  const handleSelectEmployee = (fiplCode: string) => {
    setSelectedFiplCode(fiplCode);
    setActiveModule("employees");
  };

  const renderModule = () => {
    switch (activeModule) {
      case "dashboard":
        return (
          <Dashboard
            onSelectEmployee={handleSelectEmployee}
            onNavigateToSales={() => handleNavigate("sales")}
          />
        );
      case "employees":
        if (selectedFiplCode) {
          return (
            <EmployeeProfile
              fiplCode={selectedFiplCode}
              onBack={() => setSelectedFiplCode(null)}
            />
          );
        }
        return (
          <Employees
            onSelectEmployee={(fipl) => setSelectedFiplCode(fipl)}
            persistedFilters={employeeFilters}
            onFiltersChange={updateEmployeeFilters}
          />
        );
      case "sales":
        return <SalesTrends />;
      case "feedback":
        return <Feedback onSelectEmployee={handleSelectEmployee} />;
      case "regional-analysis":
        return <RegionalAnalysis onSelectEmployee={handleSelectEmployee} />;
      case "uploads":
        return <Uploads />;
      case "settings":
        return <Settings />;
      case "suggestions":
        return <SuggestionsIssues />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar active={activeModule} onNavigate={handleNavigate} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header active={activeModule} />
        <main className="flex-1 overflow-y-auto p-6">{renderModule()}</main>
        <footer className="text-center text-xs text-muted-foreground py-3 border-t border-border bg-card">
          © {new Date().getFullYear()}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            caffeine.ai
          </a>
        </footer>
      </div>
      {pendingModule && (
        <PasswordGate
          gateKey={pendingModule}
          onUnlock={handlePasswordUnlock}
          onCancel={handlePasswordCancel}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UILabelsProvider>
        <AppContent />
        <Toaster />
      </UILabelsProvider>
    </QueryClientProvider>
  );
}
