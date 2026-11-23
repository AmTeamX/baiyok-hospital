import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.params, usePathname: () => "/patients/missed", useRouter: () => ({ push: mocks.push }) }));
import { CreateCase } from "@/components/create-case";
import { CaseDetail } from "@/components/case-detail";
import { MissedRegistry } from "@/components/missed-registry";
const patient = { id: "patient-1", fullName: "ผู้ป่วยทดสอบ", hn: "001", assigneeName: null };
const appointment = { id: "appointment-1", appointmentAt: "2026-11-24T01:00:00Z", clinic: "คลินิกทดสอบ", status: "missed", followUp: null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => { mocks.params = new URLSearchParams("patientId=patient-1&appointmentId=appointment-1"); mocks.push.mockReset(); vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/volunteers" ? json({ mode: "database", volunteers: [] }) : url.startsWith("/api/patients/") ? json({ patient, appointments: [appointment] }) : json({ id: "case-1" }, 201))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("case management workflow", () => {
  it("routes missed appointments without a case to creation, and existing cases to their own ID", async () => {
    mocks.params = new URLSearchParams();
    vi.mocked(fetch).mockResolvedValue(json({ rows: [
      { id: "appointment-1", appointmentId: "appointment-1", followUpId: null, fullName: "ยังไม่มีเคส", hn: "001", status: "pending", appointmentAt: appointment.appointmentAt },
      { id: "case-2", appointmentId: "appointment-2", followUpId: "case-2", fullName: "มีเคสแล้ว", hn: "002", status: "assigned", appointmentAt: appointment.appointmentAt }
    ], total: 2, volunteers: [], areas: [] }));
    render(<MissedRegistry />);
    expect((await screen.findByRole("link", { name: "สร้างเคส ยังไม่มีเคส" })).getAttribute("href")).toBe("/cases/new?appointmentId=appointment-1");
    expect(screen.getByRole("link", { name: "เปิดเคส มีเคสแล้ว" }).getAttribute("href")).toBe("/follow-up/case-2");
  });
  it("prefills the requested appointment and creates a case before opening the canonical case ID", async () => {
    render(<CreateCase />);
    const radio = await screen.findByRole("radio");
    expect((radio as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "สร้างเคสติดตาม" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/follow-up/case-1"));
    const calls = vi.mocked(fetch).mock.calls;
    const creation = calls.find(([url]) => url === "/api/cases");
    expect(JSON.parse(creation?.[1]?.body as string)).toMatchObject({ appointmentId: "appointment-1", priority: "normal" });
  });
  it("offers the existing case and prevents duplicate creation for that appointment", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => url === "/api/volunteers" ? json({ mode: "database", volunteers: [] }) : json({ patient, appointments: [{ ...appointment, followUp: { id: "existing-case" } }] }));
    render(<CreateCase />);
    expect((await screen.findByRole("link", { name: "เปิดเคสเดิม →" })).getAttribute("href")).toBe("/follow-up/existing-case");
    expect(screen.queryByRole("radio")).toBeNull();
    expect((screen.getByRole("button", { name: "สร้างเคสติดตาม" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("resolves appointment-only links to the correct patient before selecting the appointment", async () => {
    mocks.params = new URLSearchParams("appointmentId=appointment-1");
    vi.mocked(fetch).mockImplementation(async (url) => url === "/api/volunteers" ? json({ mode: "database", volunteers: [] }) : String(url).startsWith("/api/cases/appointment") ? json({ patientId: "patient-1" }) : json({ patient, appointments: [appointment] }));
    render(<CreateCase />);
    expect((await screen.findByRole("radio") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("ผู้ป่วยทดสอบ")).toBeTruthy();
  });
  it("explains a legacy appointment link instead of claiming the case has disappeared", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => url === "/api/volunteers" ? json({ volunteers: [] }) : json({ error: "case_required", appointmentId: "appointment-1", patientId: "patient-1" }, 409));
    render(<CaseDetail id="appointment-1" />);
    expect(await screen.findByRole("heading", { name: "นัดนี้ยังไม่มีเคสติดตาม" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "สร้างเคสจากนัดนี้" }).getAttribute("href")).toBe("/cases/new?patientId=patient-1&appointmentId=appointment-1");
    expect(screen.queryByText("ไม่พบเคสนี้")).toBeNull();
  });
});
