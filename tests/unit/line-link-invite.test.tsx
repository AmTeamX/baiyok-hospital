import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { LineLinkInvite } from "@/components/line-link-invite";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});

describe("LineLinkInvite", () => {
  it("opens a confirmation modal and closes without creating a code", () => {
    render(<LineLinkInvite targetType="patient" targetId="patient-1" role="patient" />);

    fireEvent.click(screen.getByRole("button", { name: "สร้างรหัสเชื่อม LINE" }));
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    expect(screen.getByRole("heading", { name: "สร้างรหัสเชื่อม LINE" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
    expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("open")).toBe(false);
  });
});
