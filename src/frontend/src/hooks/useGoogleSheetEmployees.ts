import { useEmployees } from "./useAllEmployeeData";

export interface GoogleSheetEmployee {
  fiplCode: string;
  name: string;
  role: string;
  department: string;
  fseCategory: string;
  status: string;
  joinDate: string;
  avatar: string;
  region: string;
  familyDetails: string;
  pastExperience: string;
  vehicleDetails: string;
  agentName: string;
}

export function useGoogleSheetEmployees() {
  const { data, isLoading, isFetching, isError } = useEmployees();
  const employees: GoogleSheetEmployee[] = data.map((e) => ({
    fiplCode: e.fiplCode,
    name: e.name,
    role: e.role,
    department: e.department,
    fseCategory: e.category,
    status: e.status,
    joinDate: e.joinDate ?? "",
    avatar: e.avatar ?? "",
    region: e.region ?? "",
    familyDetails: e.familyDetails ?? "",
    pastExperience: e.pastExperience ?? "",
    vehicleDetails: e.vehicleDetails ?? "",
    agentName: e.agentName ?? "",
  }));
  return { data: employees, isLoading, isFetching, isError };
}
