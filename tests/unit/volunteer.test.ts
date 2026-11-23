import { describe, expect, it } from "vitest";
import {
  VOLUNTEER_CHANNELS,
  VOLUNTEER_RESULT_CODES,
  isOverdueSla,
  isValidVolunteerChannel,
  isValidVolunteerResult,
  mapVolunteerTaskRow,
  resultCodeEscalates,
  resultCodeIsUnreached,
  taskFilterToStatuses,
  VOLUNTEER_CHANNEL_LABELS,
  VOLUNTEER_RESULT_LABELS,
  VOLUNTEER_PRIORITY_LABELS,
  VOLUNTEER_TASK_STATUS_LABELS
} from "@/lib/volunteer";

describe("volunteer result codes", () => {
  it("accepts every defined result code", () => {
    for (const code of VOLUNTEER_RESULT_CODES) expect(isValidVolunteerResult(code)).toBe(true);
  });

  it("rejects unknown result codes", () => {
    expect(isValidVolunteerResult("made_up")).toBe(false);
    expect(isValidVolunteerResult(42)).toBe(false);
    expect(isValidVolunteerResult(null)).toBe(false);
  });

  it("only needs_nurse escalates", () => {
    expect(resultCodeEscalates("needs_nurse")).toBe(true);
    expect(resultCodeEscalates("contacted_will_come")).toBe(false);
  });

  it("marks unreached outcomes", () => {
    expect(resultCodeIsUnreached("unable_to_contact")).toBe(true);
    expect(resultCodeIsUnreached("moved_elsewhere")).toBe(true);
    expect(resultCodeIsUnreached("contacted_will_come")).toBe(false);
  });

  it("has a Thai label for every result code and channel", () => {
    for (const code of VOLUNTEER_RESULT_CODES) expect(VOLUNTEER_RESULT_LABELS[code]).toBeTruthy();
    for (const channel of VOLUNTEER_CHANNELS) expect(VOLUNTEER_CHANNEL_LABELS[channel]).toBeTruthy();
  });
});

describe("volunteer channels", () => {
  it("accepts defined channels and rejects others", () => {
    expect(isValidVolunteerChannel("phone")).toBe(true);
    expect(isValidVolunteerChannel("visit")).toBe(true);
    expect(isValidVolunteerChannel("email")).toBe(false);
  });
});

describe("task filter mapping", () => {
  it("maps new to assigned", () => expect(taskFilterToStatuses("new")).toEqual(["assigned"]));
  it("maps in_progress to contacted", () => expect(taskFilterToStatuses("in_progress")).toEqual(["contacted"]));
  it("maps done to terminal states", () => expect(taskFilterToStatuses("done")).toEqual(["returned", "closed", "rescheduled"]));
  it("maps open to assigned + contacted", () => expect(taskFilterToStatuses("open")).toEqual(["assigned", "contacted"]));
  it("maps urgent to assigned + contacted", () => expect(taskFilterToStatuses("urgent")).toEqual(["assigned", "contacted"]));
  it("maps all to every status", () => expect(taskFilterToStatuses("all")).toHaveLength(6));
});

describe("SLA overdue", () => {
  const now = new Date("2026-11-24T12:00:00.000Z");

  it("is overdue when still assigned past the sla window", () => {
    expect(isOverdueSla("assigned", "2026-11-22T00:00:00.000Z", 48, now)).toBe(true);
  });

  it("is not overdue within the window", () => {
    expect(isOverdueSla("assigned", "2026-11-24T00:00:00.000Z", 48, now)).toBe(false);
  });

  it("is never overdue once contacted or closed", () => {
    expect(isOverdueSla("contacted", "2026-11-22T00:00:00.000Z", 48, now)).toBe(false);
    expect(isOverdueSla("closed", "2026-11-22T00:00:00.000Z", 48, now)).toBe(false);
  });

  it("is not overdue without an assigned time", () => {
    expect(isOverdueSla("assigned", null, 48, now)).toBe(false);
  });
});

describe("mapVolunteerTaskRow", () => {
  const now = new Date("2026-11-24T12:00:00.000Z");
  const base = {
    id: "fu-1",
    status: "assigned",
    priority: "normal",
    assigned_at: "2026-11-22T00:00:00.000Z",
    contacted_at: null,
    missed_reason: "ลืมวันนัด",
    appointments: { appointment_at: "2026-11-21T08:00:00+07:00", clinic: "คลินิกความดัน", patients: { full_name: "นายทดสอบ", village: "สระโคล่", phone: "0811111111" } }
  };

  it("normalizes a single related row and computes overdue", () => {
    const task = mapVolunteerTaskRow(base, 48, now);
    expect(task.patient.fullName).toBe("นายทดสอบ");
    expect(task.patient.village).toBe("สระโคล่");
    expect(task.appointment.clinic).toBe("คลินิกความดัน");
    expect(task.overdueSla).toBe(true);
  });

  it("handles relation rows returned as arrays", () => {
    const task = mapVolunteerTaskRow(
      { ...base, appointments: [{ ...base.appointments, patients: [base.appointments.patients] }] },
      48,
      now
    );
    expect(task.patient.fullName).toBe("นายทดสอบ");
    expect(task.appointment.clinic).toBe("คลินิกความดัน");
  });

  it("does not leak HN or birth date into the mapped shape", () => {
    const task = mapVolunteerTaskRow(base, 48, now);
    expect(Object.keys(task.patient).sort()).toEqual(["fullName", "phone", "village"]);
    expect(task).not.toHaveProperty("hn");
  });

  it("provides a label for every status and priority", () => {
    expect(VOLUNTEER_TASK_STATUS_LABELS.assigned).toBeTruthy();
    expect(VOLUNTEER_PRIORITY_LABELS.urgent).toBeTruthy();
  });
});
