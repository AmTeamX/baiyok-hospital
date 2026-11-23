export type LineLinkRole = "patient" | "volunteer";
export type LineLinkStatus = "active" | "revoked" | "deactivated";

export type LineAccountLinkRow = {
  id: string;
  line_account_id: string;
  role: LineLinkRole;
  status: LineLinkStatus;
  patient_id?: string | null;
  profile_id?: string | null;
};

export type Context = { linkId: string; role: LineLinkRole };

/** Only active links for the given account become selectable contexts. */
export function toActiveContexts(links: LineAccountLinkRow[], lineAccountId: string): Context[] {
  return links
    .filter((link) => link.line_account_id === lineAccountId && link.status === "active")
    .map((link) => ({ linkId: link.id, role: link.role }));
}

/** A context cookie is only valid if the underlying link is still active and matches the role. */
export function isContextStillActive(links: LineAccountLinkRow[], context: Context): boolean {
  return links.some(
    (link) =>
      link.id === context.linkId &&
      link.role === context.role &&
      link.status === "active"
  );
}
