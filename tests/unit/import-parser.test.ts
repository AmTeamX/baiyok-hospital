import { describe, expect, it } from "vitest";
import { parseImportFile } from "@/lib/import/parser";

function csv(value: string) { return new File([value], "import.csv", { type: "text/csv" }); }

describe("import parser", () => {
  it("parses appointments without writing to a database", async () => {
    const result = await parseImportFile(csv("hn,full_name,appointment_date,appointment_time,clinic\n001,คนไข้ หนึ่ง,01/02/2569,08:30,ความดัน\n"), "appointments");
    expect(result.validRows).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ hn: "001", appointmentAt: "2026-02-01T08:30:00+07:00" });
  });

  it("reports duplicate and invalid rows with row numbers", async () => {
    const result = await parseImportFile(csv("hn,full_name,appointment_date,clinic\n001,คนไข้,not-a-date,ความดัน\n001,คนไข้,2026-02-01,ความดัน\n001,คนไข้,2026-02-01,ความดัน\n"), "appointments");
    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(2);
    expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining(["invalid_date", "duplicate"]));
    expect(result.errors.map((error) => error.row)).toEqual(expect.arrayContaining([2, 4]));
  });

  it("parses service results separately from appointments", async () => {
    const result = await parseImportFile(csv("hn,service_date,clinic,service_result\n001,2026-02-01,ความดัน,มาแล้ว\n"), "service_results");
    expect(result.validRows).toBe(1);
    expect(result.rows[0]).toMatchObject({ hn: "001", serviceDate: "2026-02-01", serviceResult: "มาแล้ว" });
  });
});
