import { describe, expect, it } from "vitest";
import { isContextStillActive, toActiveContexts, type LineAccountLinkRow } from "@/lib/line/context";

const accountId = "acct-1";

function link(overrides: Partial<LineAccountLinkRow> = {}): LineAccountLinkRow {
  return {
    id: "link-1",
    line_account_id: accountId,
    role: "patient",
    status: "active",
    patient_id: "p-1",
    profile_id: null,
    ...overrides
  };
}

describe("line context selection", () => {
  it("returns only active links for the account", () => {
    const links = [
      link(),
      link({ id: "link-2", role: "volunteer", patient_id: null, profile_id: "prof-1" }),
      link({ id: "link-3", status: "revoked" }),
      link({ id: "link-4", line_account_id: "other-account" })
    ];
    expect(toActiveContexts(links, accountId)).toEqual([
      { linkId: "link-1", role: "patient" },
      { linkId: "link-2", role: "volunteer" }
    ]);
  });

  it("rejects a context whose link is no longer active", () => {
    const links = [link({ status: "revoked" })];
    expect(isContextStillActive(links, { linkId: "link-1", role: "patient" })).toBe(false);
  });

  it("rejects a context with a mismatched role", () => {
    const links = [link({ role: "patient" })];
    expect(isContextStillActive(links, { linkId: "link-1", role: "volunteer" })).toBe(false);
  });

  it("rejects a context whose link id is not among the active links", () => {
    const links = [link()]; // link-1, patient, active
    expect(isContextStillActive(links, { linkId: "other-link", role: "patient" })).toBe(false);
  });
});
