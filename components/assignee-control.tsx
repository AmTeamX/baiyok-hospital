"use client";

import { LoaderCircle, UserRoundCheck } from "lucide-react";

type Volunteer = { id: string; full_name: string; active: boolean };

export function AssigneeControl({
  name,
  assignedId,
  volunteers,
  selectedVolunteer,
  onSelectedVolunteer,
  onAssign,
  assigning,
  message,
  compact = false
}: {
  name: string | null;
  assignedId: string | null;
  volunteers: Volunteer[];
  selectedVolunteer: string;
  onSelectedVolunteer: (value: string) => void;
  onAssign: () => void;
  assigning: boolean;
  message?: string | null;
  compact?: boolean;
}) {
  const isAssigned = Boolean(name);
  return (
    <div className={`assignee-control ${compact ? "compact" : ""}`}>
      <div className="assignee-current" role="group" aria-label="ผู้รับผิดชอบปัจจุบัน">
        <span className="assignee-current-icon" aria-hidden="true"><UserRoundCheck size={20} /></span>
        <div>
          <span>ผู้รับผิดชอบปัจจุบัน</span>
          <strong>{name ?? "ยังไม่มอบหมาย"}</strong>
        </div>
        <span className={`assignee-status ${isAssigned ? "assigned" : "unassigned"}`}>
          {isAssigned ? "กำลังรับผิดชอบ" : "รอมอบหมาย"}
        </span>
      </div>
      <div className="case-form">
        <label className="field">
          <span>{isAssigned ? "เปลี่ยนเป็น อสม." : "มอบหมายให้ อสม."}</span>
          <select value={selectedVolunteer} onChange={(event) => onSelectedVolunteer(event.target.value)}>
            <option value="">{isAssigned ? "เลือก อสม. ที่ต้องการเปลี่ยน" : "เลือก อสม. ผู้รับผิดชอบ"}</option>
            {volunteers.map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.full_name}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="button primary"
          onClick={onAssign}
          disabled={!selectedVolunteer || selectedVolunteer === assignedId || assigning}
        >
          {assigning ? <><LoaderCircle className="spin" size={16} />กำลังบันทึก</> : isAssigned ? "ยืนยันเปลี่ยนผู้รับผิดชอบ" : "ยืนยันมอบหมาย"}
        </button>
      </div>
      {message && <p className="assignee-message form-error" role="status">{message}</p>}
    </div>
  );
}
