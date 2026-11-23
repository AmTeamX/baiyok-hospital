import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ restore: vi.fn() }));
vi.mock("@/lib/liff-client", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/liff-client")>(), restoreLiffSession: mocks.restore }));
import LiffLinkPage from "@/app/liff/link/page";
import { LiffSessionError } from "@/lib/liff-client";
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({}, "", "/liff/link"); });
afterEach(cleanup);
describe("linking screen", () => {
  it("hides the linking form when LINE already has an active account", async () => {
    mocks.restore.mockResolvedValue([{ linkId: "v1", role: "volunteer" }]);
    render(<LiffLinkPage />);
    await screen.findByRole("heading", { name: "เชื่อมบัญชี LINE แล้ว" });
    expect(screen.getByRole("link", { name: "เข้าใช้งาน" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "รหัสเชื่อมบัญชี" })).toBeNull();
    expect(screen.queryByRole("button", { name: "ยินยอมและผูกบัญชี" })).toBeNull();
  });
  it("shows the code entry only for an identity that has not been linked", async () => {
    mocks.restore.mockRejectedValue(new LiffSessionError("account_not_linked"));
    render(<LiffLinkPage />);
    expect(await screen.findByRole("textbox", { name: "รหัสเชื่อมบัญชี" })).toBeTruthy();
  });
  it("does not offer linking when authentication is unavailable", async () => {
    mocks.restore.mockRejectedValue(new LiffSessionError("session_not_configured"));
    render(<LiffLinkPage />);
    await screen.findByText("ระบบยืนยันตัวตนยังไม่พร้อม กรุณาแจ้งเจ้าหน้าที่");
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
