import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/login" }));

describe("AppShell", () => {
  it("keeps the login page outside the staff shell", () => {
    render(<AppShell><h1>เข้าสู่ระบบ</h1></AppShell>);
    expect(screen.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "เมนูหลัก" })).toBeNull();
  });
});
