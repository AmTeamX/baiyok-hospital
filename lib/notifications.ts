import { LinePushBlockedError } from "@/lib/line";

export const MAX_NOTIFICATION_ATTEMPTS = 5;

const BACKOFF_BASE_SECONDS = 5;
const BACKOFF_CAP_SECONDS = 3600;

/** Exponential backoff for a notification that failed `attemptCount` times (1-based). */
export function notificationBackoffSeconds(attemptCount: number): number {
  const attempts = Math.max(1, Math.floor(attemptCount));
  return Math.min(BACKOFF_BASE_SECONDS * 2 ** (attempts - 1), BACKOFF_CAP_SECONDS);
}

export function nextAttemptAt(attemptCount: number, now = new Date()): string {
  return new Date(now.getTime() + notificationBackoffSeconds(attemptCount) * 1000).toISOString();
}

/** Deep link to the volunteer LIFF task. The target re-checks assignment authorization. */
export function assignmentDeepLink(followUpId: string, appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""): string {
  const destination = encodeURIComponent(`volunteer/tasks/${followUpId}`);
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  return liffId ? `https://liff.line.me/${liffId}?destination=${destination}` : `${appUrl.replace(/\/+$/, "")}/liff/link?destination=${destination}`;
}

/**
 * Push message for a new assignment. Intentionally contains no HN, full name,
 * diagnosis, medication or clinic detail — only a task notice and a deep link.
 */
export function buildAssignmentMessage(followUpId: string, appUrl?: string): string {
  return `มีงานติดตามผู้ป่วยใหม่ 1 ราย\nกรุณาเปิดลิงก์เพื่อดูรายละเอียดและบันทึกผล\n${assignmentDeepLink(followUpId, appUrl)}`;
}

/**
 * Push message reminding a volunteer that an assigned task still has no result.
 * Same privacy rule: no HN, full name, diagnosis, medication or clinic detail.
 */
export function buildSlaReminderMessage(followUpId: string, appUrl?: string): string {
  return `งานติดตามที่ได้รับมอบหมายยังไม่มีผล\nกรุณาเปิดลิงก์เพื่อบันทึกผลการติดตาม\n${assignmentDeepLink(followUpId, appUrl)}`;
}

export function patientAppointmentDeepLink(appointmentId: string, appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""): string {
  const destination = encodeURIComponent("appointments");
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  return liffId ? `https://liff.line.me/${liffId}?destination=${destination}` : `${appUrl.replace(/\/+$/, "")}/liff/appointments`;
}

export function buildPatientRequestMessage(status: string, appUrl?: string): string {
  const labels: Record<string, string> = {
    new: "ได้รับคำขอของคุณแล้ว",
    acknowledged: "เจ้าหน้าที่รับเรื่องคำขอของคุณแล้ว",
    contacted: "เจ้าหน้าที่ติดต่อเรื่องคำขอของคุณแล้ว",
    resolved: "คำขอของคุณได้รับการดำเนินการเรียบร้อยแล้ว",
    unable_to_contact: "เจ้าหน้าที่พยายามติดต่อแล้วแต่ยังติดต่อไม่ได้ กรุณาตรวจสอบช่องทางติดต่อ"
  };
  return `${labels[status] ?? "มีการอัปเดตคำขอของคุณ"}\nดูรายละเอียดวันนัด: ${patientAppointmentDeepLink("", appUrl)}`;
}

export function buildAppointmentStatusMessage(status: "rescheduled" | "cancelled", appointmentId: string, appUrl?: string): string {
  const base = status === "cancelled"
    ? "นัดของคุณถูกยกเลิก"
    : "นัดของคุณถูกเลื่อนเรียบร้อยแล้ว";
  return `${base}\nโปรดตรวจสอบวัน เวลา และคลินิกล่าสุด:\n${patientAppointmentDeepLink(appointmentId, appUrl)}`;
}

export function buildPatientStatusFlex(options: {
  kind: "patient_request_status" | "appointment_created" | "appointment_rescheduled" | "appointment_cancelled";
  status?: string;
  link: string;
  appointmentAt?: string;
  clinic?: string;
  staffResponse?: string;
}) {
  const isCancelled = options.kind === "appointment_cancelled";
  const isRescheduled = options.kind === "appointment_rescheduled";
  const isCreated = options.kind === "appointment_created";
  const requestLabels: Record<string, string> = {
    new: "ได้รับคำขอของคุณแล้ว",
    acknowledged: "เจ้าหน้าที่รับเรื่องแล้ว",
    contacted: "เจ้าหน้าที่ติดต่อเรื่องนี้แล้ว",
    resolved: "ดำเนินการเรียบร้อย",
    unable_to_contact: "ไม่สามารถติดต่อได้ในขณะนี้"
  };
  const title = isCancelled
    ? "นัดถูกยกเลิก"
    : isRescheduled
      ? "นัดถูกเลื่อนเรียบร้อย"
      : isCreated
        ? "มีนัดใหม่"
        : requestLabels[options.status ?? "new"] ?? "มีการอัปเดตคำขอ";
  const accent = isCancelled ? "#C94B4B" : isRescheduled ? "#1677A5" : isCreated ? "#1677A5" : "#2F7D68";
  let detail = "ตรวจสอบรายละเอียดและนัดครั้งถัดไปได้ที่นี่";
  if (options.appointmentAt) {
    detail = new Intl.DateTimeFormat("th-TH", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Bangkok"
    }).format(new Date(options.appointmentAt));
  }

  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: accent,
      paddingAll: "16px",
      contents: [
        { type: "text", text: "รพ.สต. สระโคล่", weight: "bold", color: "#FFFFFF", size: "sm" },
        { type: "text", text: title, weight: "bold", color: "#FFFFFF", size: "xl", margin: "sm", wrap: true }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "18px",
      contents: [
        { type: "text", text: detail, size: "md", weight: "bold", color: "#24332F", wrap: true },
        ...(options.staffResponse ? [{ type: "text", text: `ข้อความจากเจ้าหน้าที่: ${options.staffResponse}`, size: "sm", color: "#66736F", margin: "md", wrap: true }] : []),
        ...(options.clinic ? [{ type: "text", text: options.clinic, size: "sm", color: "#66736F", margin: "md", wrap: true }] : [])
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: accent,
          action: { type: "uri", label: "ดูนัดของฉัน", uri: options.link }
        }
      ]
    }
  };
}

export function buildVolunteerTaskFlex(
  followUpId: string,
  kind: "follow_up_assigned" | "follow_up_sla_reminder",
  appUrl?: string
) {
  const isReminder = kind === "follow_up_sla_reminder";
  const title = isReminder ? "งานติดตามค้างการบันทึก" : "มีงานติดตามใหม่";
  const detail = isReminder
    ? "กรุณาตรวจสอบและบันทึกผลการติดตามผู้ป่วย"
    : "มีเคสติดตามใหม่รอการดำเนินงาน";
  const accent = isReminder ? "#C58A28" : "#1677A5";
  const link = assignmentDeepLink(followUpId, appUrl);

  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: accent,
      paddingAll: "16px",
      contents: [
        { type: "text", text: "งาน อสม.", weight: "bold", color: "#FFFFFF", size: "sm" },
        { type: "text", text: title, weight: "bold", color: "#FFFFFF", size: "xl", margin: "sm", wrap: true }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "18px",
      contents: [
        { type: "text", text: detail, size: "md", weight: "bold", color: "#24332F", wrap: true },
        { type: "text", text: "เปิดรายละเอียดงานแล้วบันทึกผลในระบบ", size: "sm", color: "#66736F", margin: "md", wrap: true }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: accent,
          action: { type: "uri", label: "เปิดงานติดตาม", uri: link }
        }
      ]
    }
  };
}

export function buildAccountLinkedFlex(role: "patient" | "volunteer", appUrl?: string) {
  const isVolunteer = role === "volunteer";
  const destination = isVolunteer ? "volunteer" : "appointments";
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  const link = liffId
    ? `https://liff.line.me/${liffId}?destination=${encodeURIComponent(destination)}`
    : `${(appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "")}/liff/${destination}`;

  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1677A5",
      paddingAll: "16px",
      contents: [
        { type: "text", text: "รพ.สต. สระโคล่", weight: "bold", color: "#FFFFFF", size: "sm" },
        { type: "text", text: "เชื่อมบัญชีสำเร็จ", weight: "bold", color: "#FFFFFF", size: "xl", margin: "sm", wrap: true }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "18px",
      contents: [
        { type: "text", text: isVolunteer ? "พร้อมใช้งานเมนูงานของ อสม." : "พร้อมดูวันนัดและส่งคำขอผ่าน LIFF", size: "md", weight: "bold", color: "#24332F", wrap: true },
        { type: "text", text: "กดปุ่มด้านล่างเพื่อเปิดเมนูของคุณ", size: "sm", color: "#66736F", margin: "md", wrap: true }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#1677A5",
          action: { type: "uri", label: isVolunteer ? "เปิดงานของฉัน" : "ดูวันนัดของฉัน", uri: link }
        }
      ]
    }
  };
}

export function buildTomorrowAppointmentFlex(appointment: { appointmentAt: string; clinic: string }, appUrl?: string) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  const link = liffId
    ? `https://liff.line.me/${liffId}?destination=${encodeURIComponent("appointments")}`
    : `${(appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "")}/liff/appointments`;
  const when = new Intl.DateTimeFormat("th-TH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(new Date(appointment.appointmentAt));

  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1677A5",
      paddingAll: "16px",
      contents: [
        { type: "text", text: "แจ้งเตือนวันนัด", weight: "bold", color: "#FFFFFF", size: "xl" },
        { type: "text", text: "รพ.สต. สระโคล่", color: "#FFFFFF", size: "sm", margin: "sm" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "18px",
      contents: [
        { type: "text", text: when, size: "md", weight: "bold", color: "#24332F", wrap: true },
        { type: "text", text: appointment.clinic, size: "sm", color: "#66736F", margin: "md", wrap: true },
        { type: "text", text: "กรุณานำยาและสมุดประจำตัวมาด้วย", size: "sm", color: "#66736F", margin: "md", wrap: true }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      contents: [
        { type: "button", style: "primary", color: "#1677A5", action: { type: "uri", label: "ดูนัดของฉัน", uri: link } }
      ]
    }
  };
}

/** Pick the outbound text for a notification kind without exposing clinical detail. */
export function buildNotificationMessage(
  kind: string,
  followUpId: string,
  appUrl?: string,
  options: { appointmentId?: string | null; patientRequestStatus?: string } = {}
): string {
  if (kind === "patient_request_status") return buildPatientRequestMessage(options.patientRequestStatus ?? "new", appUrl);
  if (kind === "appointment_created") return `มีนัดใหม่ของคุณ\nโปรดตรวจสอบวัน เวลา และคลินิก:\n${patientAppointmentDeepLink(options.appointmentId ?? followUpId, appUrl)}`;
  if (kind === "appointment_rescheduled") return buildAppointmentStatusMessage("rescheduled", options.appointmentId ?? followUpId, appUrl);
  if (kind === "appointment_cancelled") return buildAppointmentStatusMessage("cancelled", options.appointmentId ?? followUpId, appUrl);
  return kind === "follow_up_sla_reminder"
    ? buildSlaReminderMessage(followUpId, appUrl)
    : buildAssignmentMessage(followUpId, appUrl);
}

/** A volunteer without a linked LINE user id cannot receive a Push Message. */
export function isUnlinkedRecipient(lineUserId?: string | null): boolean {
  return !lineUserId?.trim();
}

export type DeliveryResult =
  | { status: "sent" }
  | { status: "blocked"; errorMessage: string }
  | { status: "failed"; errorMessage: string; nextAttemptAt: string }
  | { status: "dead_letter"; errorMessage: string }
  | { status: "unlinked" };

/**
 * Deliver one notification attempt. `attemptCountAfterClaim` is the attempt number
 * for this delivery (1-based). The caller records the returned state in the outbox.
 */
export async function deliverNotification(
  notification: { id: string; followUpId: string | null; kind: string; lineUserId: string | null; attemptCountAfterClaim: number; appointmentId?: string | null; patientRequestStatus?: string },
  send: (lineUserId: string, message: string) => Promise<void>,
  appUrl?: string,
  sendRich?: (lineUserId: string) => Promise<void>
): Promise<DeliveryResult> {
  if (isUnlinkedRecipient(notification.lineUserId)) return { status: "unlinked" };
  const message = buildNotificationMessage(notification.kind, notification.followUpId ?? notification.id, appUrl, {
    appointmentId: notification.appointmentId,
    patientRequestStatus: notification.patientRequestStatus
  });
  try {
    if (sendRich) await sendRich(notification.lineUserId as string);
    else await send(notification.lineUserId as string, message);
    return { status: "sent" };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "unknown error";
    if (error instanceof LinePushBlockedError) {
      return { status: "blocked", errorMessage: messageText };
    }
    if (notification.attemptCountAfterClaim >= MAX_NOTIFICATION_ATTEMPTS) {
      return { status: "dead_letter", errorMessage: messageText };
    }
    return { status: "failed", errorMessage: messageText, nextAttemptAt: nextAttemptAt(notification.attemptCountAfterClaim) };
  }
}
