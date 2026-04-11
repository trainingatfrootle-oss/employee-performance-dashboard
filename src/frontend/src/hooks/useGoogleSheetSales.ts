import { useMemo } from "react";
import { useAllEmployeeData, useEmployees } from "./useAllEmployeeData";

export interface GoogleSheetSale {
  fiplCode: string;
  name: string;
  region: string;
  brand: string;
  product: string;
  type: string;
  date: string;
  quantity: number;
  amount: number;
}

// Returns ALL sales records including unmatched FIPL codes
export function useAllSales() {
  const { data, isLoading, isError } = useAllEmployeeData();
  const sales = useMemo((): GoogleSheetSale[] => {
    if (!data) return [];
    return data.allSalesRecords ?? [];
  }, [data]);
  return { data: sales, isLoading, isError };
}

// Legacy hook - still works but uses allSalesRecords for completeness
export function useGoogleSheetSales() {
  return useAllSales();
}
