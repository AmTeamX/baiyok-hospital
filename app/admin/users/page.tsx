"use client";

import { LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LineLinkInvite } from "@/components/line-link-invite";
import { Modal } from "@/components/modal";

type Profile = { id: string; full_name: string; role: string; active: boolean; phone: string | null; line_linked: boolean; line_display_name: string | null };

const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  nurse: "พยาบาล",
  volunteer: "อสม."
};

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/profiles");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "โหลดรายชื่อไม่สำเร็จ");
      setProfiles(body.profiles ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดรายชื่อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(id: string, active: boolean) {
    setBusy(id);
    try {
      const response = await fetch(`/api/volunteers/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "อัปเดตสถานะไม่สำเร็จ");
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function createVolunteer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newFullName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/volunteers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: newFullName.trim(), phone: newPhone.trim() || null })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "เพิ่ม อสม. ไม่สำเร็จ");
      setNewFullName("");
      setNewPhone("");
      setCreateOpen(false);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "เพิ่ม อสม. ไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/volunteers/${id}/revoke`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "ถอนการผูกไม่สำเร็จ");
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "ถอนการผูกไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  const staff = profiles.filter((profile) => profile.role !== "volunteer");
  const volunteers = profiles.filter((profile) => profile.role === "volunteer");

  function renderRow(profile: Profile, withInvite: boolean) {
    return (
      <div className="table-row" key={profile.id}>
        <span data-label="ชื่อ"><strong>{profile.full_name}</strong><small>{ROLE_LABELS[profile.role] ?? profile.role}</small></span>
        <span data-label="โทรศัพท์">{profile.phone ?? "—"}</span>
        <span data-label="สถานะ">
          <i className={`status-dot ${profile.active ? "status-q-checked_in" : "status-q-cancelled"}`}>{profile.active ? "ใช้งาน" : "ระงับ"}</i>
          {withInvite ? (
            <i className={`status-dot ${profile.line_linked ? "status-q-checked_in" : "status-q-cancelled"}`} style={{ marginBlockStart: "var(--space-2xs)" }}>
              {profile.line_linked ? `เชื่อม LINE แล้ว${profile.line_display_name ? ` (${profile.line_display_name})` : ""}` : "ยังไม่ผูก LINE"}
            </i>
          ) : null}
        </span>
        <span data-label="จัดการ">
          {withInvite ? (
            <div className="link-invite-actions" style={{ flexWrap: "wrap" }}>
              <LineLinkInvite targetType="profile" targetId={profile.id} role="volunteer" label={profile.line_linked ? "สร้างรหัสใหม่" : "สร้างรหัส LINE"} />
              {profile.line_linked && (
                <button className="button secondary" disabled={busy === profile.id} onClick={() => void revoke(profile.id)}>
                  {busy === profile.id ? <LoaderCircle className="spin" size={14} /> : null}ถอนการผูก
                </button>
              )}
              <button className="button secondary" disabled={busy === profile.id} onClick={() => void toggle(profile.id, !profile.active)}>
                {busy === profile.id ? <LoaderCircle className="spin" size={14} /> : null}{profile.active ? "ระงับ" : "เปิดใช้งาน"}
              </button>
            </div>
          ) : (
            <span className="muted-count">—</span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">จัดการทีม</p>
          <h1>เจ้าหน้าที่และ อสม.</h1>
          <p>ดูรายชื่อ เปิด/ระงับ อสม. และสร้างรหัสเชื่อม LINE ให้ อสม. (รหัสใช้ครั้งเดียว หมดอายุ 15 นาที)</p>
        </div>
      </div>

      {error && <div className="demo-banner"><TriangleAlert size={18} /><span><strong>เกิดข้อผิดพลาด</strong> {error}</span></div>}

      <section className="panel table-panel">
        <div className="panel-head"><div><h2>เจ้าหน้าที่</h2></div></div>
        <div className="patient-table">
          {loading ? (
            <div className="empty-state"><strong>กำลังโหลด</strong></div>
          ) : staff.length === 0 ? (
            <div className="empty-state"><strong>ยังไม่มีเจ้าหน้าที่</strong></div>
          ) : (
            staff.map((profile) => renderRow(profile, false))
          )}
        </div>
      </section>

      <section className="panel table-panel" style={{ marginBlockStart: "var(--space-lg)" }}>
        <div className="panel-head"><div><h2>อสม. ({volunteers.length})</h2><p>สร้างรหัสเชื่อม LINE เพื่อให้ อสม. ผูกบัญชีจากแอป LINE</p></div><button className="button primary" onClick={() => setCreateOpen(true)}><Plus size={17} />เพิ่ม อสม.</button></div>

        <div className="patient-table">
          {loading ? (
            <div className="empty-state"><strong>กำลังโหลด</strong></div>
          ) : volunteers.length === 0 ? (
            <div className="empty-state"><strong>ยังไม่มี อสม.</strong><p>เพิ่ม อสม. ในระบบเพื่อเริ่มมอบหมายงาน</p></div>
          ) : (
            volunteers.map((profile) => renderRow(profile, true))
          )}
        </div>
      </section>

      <Modal open={createOpen} onClose={() => { if (!creating) setCreateOpen(false); }} title="เพิ่ม อสม." description="เพิ่มข้อมูลพื้นฐานก่อนสร้างรหัสเชื่อมบัญชี LINE" size="sm">
        <form onSubmit={createVolunteer} className="case-form">
          {error && <div className="state-banner error" role="alert"><span>{error}</span></div>}
          <label className="field"><span>ชื่อ-นามสกุล อสม.</span><input value={newFullName} onChange={(event) => setNewFullName(event.target.value)} placeholder="เช่น สมชาย ใจดี" required autoFocus /></label>
          <label className="field"><span>เบอร์โทร</span><input type="tel" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="08x-xxx-xxxx" /></label>
          <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setCreateOpen(false)} disabled={creating}>ยกเลิก</button><button className="button primary" disabled={creating}>{creating ? <><LoaderCircle className="spin" size={16} />กำลังเพิ่ม</> : "เพิ่ม อสม."}</button></div>
        </form>
      </Modal>
    </div>
  );
}
