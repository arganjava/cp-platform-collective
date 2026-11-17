import { describe, it, expect } from "vitest";
import { seedSales, seedSaleStages } from "./seed-data";
import {
  buildClosedMonthOptions,
  filterClosedSalesByMonth,
  getClosedSalesWithStage,
  getCurrentMonthKey,
  getYearMonthKey,
} from "./closed-sales";

describe("closed-sales monthly filtering", () => {
  it("formats current month key as YYYY-MM", () => {
    expect(getCurrentMonthKey(new Date(2026, 10, 16))).toBe("2026-11");
    expect(getCurrentMonthKey(new Date(2026, 0, 5))).toBe("2026-01");
  });

  it("extracts YYYY-MM safely for date-only strings and timestamps", () => {
    expect(getYearMonthKey("2026-05-01")).toBe("2026-05");
    expect(getYearMonthKey("2026-07-20T10:00:00Z")).toBe("2026-07");
    expect(getYearMonthKey("2026-11")).toBe("2026-11");
    expect(getYearMonthKey(null)).toBeNull();
  });

  it("includes only sales whose latest stage status is Closed", () => {
    const closed = getClosedSalesWithStage(seedSales, seedSaleStages);
    // seed data has 6 closed sales: sale-1, sale-2, sale-3, sale-4, sale-7, sale-9
    expect(closed.map((c) => c.sale.id).sort()).toEqual([
      "sale-1",
      "sale-2",
      "sale-3",
      "sale-4",
      "sale-7",
      "sale-9",
    ]);
    const allTotal = closed.reduce((sum, item) => sum + item.amount, 0);
    expect(allTotal).toBe(47900);
  });

  it("filters closed sales by specific month and supports 'all'", () => {
    const closed = getClosedSalesWithStage(seedSales, seedSaleStages);

    // May 2026: sale-2 ($8,500) + sale-4 ($3,200) = $11,700
    const may2026 = filterClosedSalesByMonth(closed, "2026-05");
    expect(may2026.reduce((sum, item) => sum + item.amount, 0)).toBe(11700);

    // Jul 2026: sale-7 ($12,000) + sale-9 ($4,200) = $16,200
    const jul2026 = filterClosedSalesByMonth(closed, "2026-07");
    expect(jul2026.reduce((sum, item) => sum + item.amount, 0)).toBe(16200);

    // Nov 2026 (no closed seed deals): $0
    const nov2026 = filterClosedSalesByMonth(closed, "2026-11");
    expect(nov2026.reduce((sum, item) => sum + item.amount, 0)).toBe(0);

    // All months: $47,900
    const all = filterClosedSalesByMonth(closed, "all");
    expect(all.reduce((sum, item) => sum + item.amount, 0)).toBe(47900);
  });

  it("builds month dropdown options including current month and months with closed sales", () => {
    const closed = getClosedSalesWithStage(seedSales, seedSaleStages);
    const options = buildClosedMonthOptions(closed, new Date(2026, 10, 16));
    const values = options.map((o) => o.value);

    expect(values[0]).toBe("2026-11");
    expect(values).toContain("2026-07");
    expect(values).toContain("2026-05");
    expect(values).toContain("2026-04");
  });
});
