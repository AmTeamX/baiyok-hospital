import { describe, expect, it } from "vitest";
import { applyMissedFilters, demoMissedRows, mapMissedRowFromRpc, parseMissedQuery } from "@/lib/missed";

describe("missed registry helpers", () => {
  it("parses valid query params", () => {
    const filters = parseMissedQuery(new URLSearchParams("status=assigned&area=หมู่ 2&page=3&pageSize=50&sort=days_late&order=desc&q=สมใจ&unassigned=1"));
    expect(filters.status).toBe("assigned");
    expect(filters.area).toBe("หมู่ 2");
    expect(filters.page).toBe(3);
    expect(filters.pageSize).toBe(50);
    expect(filters.sort).toBe("days_late");
    expect(filters.order).toBe("desc");
    expect(filters.q).toBe("สมใจ");
    expect(filters.unassignedOnly).toBe(true);
  });

  it("normalizes invalid values to safe defaults", () => {
    const filters = parseMissedQuery(new URLSearchParams("status=bogus&page=abc&order=sideways&sort=nope&pageSize=999&priority=nope"));
    expect(filters.status).toBeNull();
    expect(filters.priority).toBeNull();
    expect(filters.page).toBe(1);
    expect(filters.order).toBe("asc");
    expect(filters.sort).toBe("appointment_at");
    expect(filters.pageSize).toBe(100);
  });

  it("filters demo rows by search text", () => {
    const rows = demoMissedRows();
    const result = applyMissedFilters(rows, { ...parseMissedQuery(new URLSearchParams("")), q: "สมใจ" });
    expect(result.total).toBe(1);
    expect(result.rows[0].hn).toBe("12345");
  });

  it("filters demo rows by unassigned flag", () => {
    const rows = demoMissedRows();
    const result = applyMissedFilters(rows, { ...parseMissedQuery(new URLSearchParams("")), unassignedOnly: true });
    expect(result.total).toBe(1);
    expect(result.rows[0].assigneeName).toBeNull();
  });

  it("maps RPC rows to the camelCase row shape", () => {
    const row = mapMissedRowFromRpc({
      follow_up_id: "fu-1", appointment_id: "ap-1", hn: "001", full_name: "คนไข้ หนึ่ง", age: 60, village: "หมู่ 1",
      appointment_at: "2026-11-01T08:00:00+07:00", clinic: "คลินิกความดัน", days_late: 5, status: "pending", missed_reason: null,
      priority: "normal", assigned_volunteer_id: null, assignee_name: null, unassigned: true, overdue: true, version: 1
    });
    expect(row.id).toBe("fu-1");
    expect(row.fullName).toBe("คนไข้ หนึ่ง");
    expect(row.unassigned).toBe(true);
    expect(row.overdue).toBe(true);
  });
});
