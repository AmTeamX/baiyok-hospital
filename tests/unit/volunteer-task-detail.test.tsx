import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "11111111-1111-4111-8111-111111111111" }) }));
import VolunteerTaskDetailPage from "@/app/liff/volunteer/tasks/[id]/page";
const task = { id: "11111111-1111-4111-8111-111111111111", version: 1, patient: { fullName: "ผู้ป่วยทดสอบ", phone: "0800000000", village: "หมู่ 1" }, appointment: { clinic: "คลินิกทดสอบ", appointmentAt: "2026-11-24T01:00:00Z" }, missedReason: "ลืมนัด", overdueSla: false };
beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, task })))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("volunteer opens a task", () => {
  it("shows patient, appointment, contact and result choices after following a case link", async () => {
    render(<VolunteerTaskDetailPage />);
    await screen.findByRole("heading", { name: "ผู้ป่วยทดสอบ" });
    expect(screen.getByText("คลินิกทดสอบ")).toBeTruthy();
    expect(screen.getByRole("link", { name: /โทรหาผู้ป่วย/ }).getAttribute("href")).toBe("tel:0800000000");
    expect(screen.getByRole("radio", { name: "ติดต่อได้และยืนยันว่าจะมา" })).toBeTruthy();
  });
  it("shows a recoverable error instead of a blank screen when task data is missing", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<VolunteerTaskDetailPage />);
    expect(await screen.findByRole("heading", { name: "เปิดงานไม่สำเร็จ" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ลองใหม่" })).toBeTruthy();
  });
  it("does not crash if an appointment date is malformed", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, task: { ...task, appointment: { ...task.appointment, appointmentAt: "invalid" } } })));
    render(<VolunteerTaskDetailPage />);
    expect(await screen.findByText("นัด ไม่ระบุวันนัด")).toBeTruthy();
  });
});
