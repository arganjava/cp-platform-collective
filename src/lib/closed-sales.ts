import type { Sale, SaleStage } from "./types";

export interface ClosedSaleEntry {
  sale: Sale;
  latestStage: SaleStage;
  amount: number;
  stageDateStr: string | null;
  monthKey: string | null;
}

export interface MonthOption {
  value: string;
  label: string;
}

export function getCurrentMonthKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getYearMonthKey(dateInput?: string | Date | null): string | null {
  if (!dateInput) return null;
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (!trimmed) return null;
    // Handle YYYY-MM or YYYY-MM-DD without UTC midnight timezone shift
    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
    if (dateOnlyMatch) {
      return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}`;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    return null;
  }
  if (isNaN(dateInput.getTime())) return null;
  return `${dateInput.getFullYear()}-${String(dateInput.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthOptionLabel(monthKey: string): string {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const date = new Date(year, monthIndex, 1);
  if (isNaN(date.getTime())) return monthKey;
  return date.toLocaleDateString("en-SG", { month: "short", year: "numeric" });
}

export function getClosedSalesWithStage(
  sales: Sale[],
  saleStages: SaleStage[]
): ClosedSaleEntry[] {
  const list: ClosedSaleEntry[] = [];
  for (const s of sales) {
    const saleId = s.id || (s as unknown as Record<string, unknown>).sale_id;
    const matching = saleStages.filter((st) => {
      const stageSaleId = st.saleId || (st as unknown as Record<string, unknown>).sale_id;
      return String(stageSaleId).trim() === String(saleId).trim();
    });
    if (matching.length === 0) continue;

    const latest = [...matching].sort((a, b) => {
      const bCreatedAt = (b as unknown as Record<string, unknown>).created_at as string | undefined;
      const aCreatedAt = (a as unknown as Record<string, unknown>).created_at as string | undefined;
      const timeB = Math.max(
        b.createdAt ? new Date(b.createdAt).getTime() : 0,
        bCreatedAt ? new Date(bCreatedAt).getTime() : 0,
        b.date ? new Date(b.date).getTime() : 0
      );
      const timeA = Math.max(
        a.createdAt ? new Date(a.createdAt).getTime() : 0,
        aCreatedAt ? new Date(aCreatedAt).getTime() : 0,
        a.date ? new Date(a.date).getTime() : 0
      );
      return timeB - timeA;
    })[0];

    const status = (latest?.status ?? "").trim().toLowerCase();
    if (status === "closed") {
      const amount = Number(s.amount) || Number(latest.value) || 0;
      const latestCreatedAt = (latest as unknown as Record<string, unknown>).created_at as string | undefined;
      const stageDateStr = latest.date || latest.createdAt || latestCreatedAt || s.date || null;
      list.push({
        sale: s,
        latestStage: latest,
        amount,
        stageDateStr,
        monthKey: getYearMonthKey(stageDateStr),
      });
    }
  }
  return list;
}

export function filterClosedSalesByMonth(
  closedSales: ClosedSaleEntry[],
  selectedMonth: string
): ClosedSaleEntry[] {
  if (!selectedMonth || selectedMonth === "all") {
    return closedSales;
  }
  return closedSales.filter((item) => item.monthKey === selectedMonth);
}

export function buildClosedMonthOptions(
  closedSales: ClosedSaleEntry[],
  now = new Date()
): MonthOption[] {
  const keys = new Set<string>();
  // Include current month and the trailing 11 months
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.add(getCurrentMonthKey(d));
  }
  // Also include any month that has closed sales data
  for (const item of closedSales) {
    if (item.monthKey) {
      keys.add(item.monthKey);
    }
  }

  return Array.from(keys)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({
      value: key,
      label: formatMonthOptionLabel(key),
    }));
}
