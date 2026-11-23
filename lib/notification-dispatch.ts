import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { pushLineFlex, pushLineText } from "@/lib/line";
import { buildPatientStatusFlex, buildVolunteerTaskFlex, deliverNotification, patientAppointmentDeepLink } from "@/lib/notifications";

const BATCH_SIZE = 20;

export async function dispatchNotifications(options: { notificationId?: string; recipientProfileId?: string; appointmentId?: string } = {}) {
  if (!hasSupabaseAdmin()) throw new Error("supabase not configured");

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("notification_logs")
    .select("id, appointment_id, follow_up_id, patient_request_id, recipient_profile_id, recipient_line_account_id, kind, attempt_count")
    .eq("channel", "line")
    .in("kind", ["follow_up_assigned", "follow_up_sla_reminder", "patient_request_status", "appointment_rescheduled", "appointment_cancelled"])
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (options.notificationId) query = query.eq("id", options.notificationId);
  if (options.recipientProfileId) query = query.eq("recipient_profile_id", options.recipientProfileId);
  if (options.appointmentId) query = query.eq("appointment_id", options.appointmentId);
  const { data: candidates, error } = await query;

  if (error) throw error;
  if (!candidates?.length) return { processed: 0, sent: 0, failed: 0, unlinked: 0, blocked: 0 };

  const recipientIds = [...new Set(candidates.map((item: { recipient_profile_id: string | null }) => item.recipient_profile_id).filter(Boolean))] as string[];
  const { data: links, error: linksError } = recipientIds.length
    ? await supabase.from("line_account_links").select("profile_id, line_account_id").eq("role", "volunteer").eq("status", "active").in("profile_id", recipientIds)
    : { data: [], error: null };
  if (linksError) throw linksError;
  const accountIds = [...new Set((links ?? []).map((link: { line_account_id: string }) => link.line_account_id))];
  const { data: accounts, error: accountsError } = accountIds.length
    ? await supabase.from("line_accounts").select("id, line_user_id").in("id", accountIds)
    : { data: [], error: null };
  if (accountsError) throw accountsError;
  const accountMap = new Map((accounts ?? []).map((account: { id: string; line_user_id: string | null }) => [account.id, account.line_user_id]));
  const lineUserIdMap = new Map((links ?? []).map((link: { profile_id: string; line_account_id: string }) => [link.profile_id, accountMap.get(link.line_account_id) ?? null]));

  const directAccountIds = [...new Set(candidates
    .map((item: { recipient_line_account_id: string | null }) => item.recipient_line_account_id)
    .filter(Boolean))] as string[];
  const directAccountMap = new Map<string, string>();
  if (directAccountIds.length) {
    const { data: directAccounts } = await supabase
      .from("line_accounts")
      .select("id, line_user_id")
      .in("id", directAccountIds);
    for (const account of directAccounts ?? []) {
      if (account.line_user_id) directAccountMap.set(account.id, account.line_user_id);
    }
  }

  const patientRequestIds = [...new Set(candidates
    .map((item: { patient_request_id: string | null }) => item.patient_request_id)
    .filter(Boolean))] as string[];
  const patientRequestStatusMap = new Map<string, string>();
  if (patientRequestIds.length) {
    const { data: requestRows } = await supabase
      .from("patient_requests")
      .select("id, status")
      .in("id", patientRequestIds);
    for (const row of requestRows ?? []) patientRequestStatusMap.set(row.id, row.status);
  }

  const appointmentIds = [...new Set(candidates
    .map((item: { appointment_id: string | null }) => item.appointment_id)
    .filter(Boolean))] as string[];
  const appointmentMap = new Map<string, { appointment_at: string; clinic: string }>();
  if (appointmentIds.length) {
    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, appointment_at, clinic")
      .in("id", appointmentIds);
    for (const appointment of appointments ?? []) {
      appointmentMap.set(appointment.id, { appointment_at: appointment.appointment_at, clinic: appointment.clinic });
    }
  }

  let sent = 0;
  let failed = 0;
  let unlinked = 0;
  let blocked = 0;

  for (const candidate of candidates) {
    const { data: claimed } = await supabase
      .from("notification_logs")
      .update({ status: "processing", attempt_count: candidate.attempt_count + 1, last_attempt_at: nowIso })
      .eq("id", candidate.id)
      .eq("attempt_count", candidate.attempt_count)
      .in("status", ["pending", "failed"])
      .select("id")
      .single();
    if (!claimed) continue;

    const lineUserId = candidate.recipient_profile_id
      ? lineUserIdMap.get(candidate.recipient_profile_id) ?? null
      : candidate.recipient_line_account_id
        ? directAccountMap.get(candidate.recipient_line_account_id) ?? null
        : null;
    const result = await deliverNotification(
      {
        id: candidate.id,
        followUpId: candidate.follow_up_id,
        kind: candidate.kind,
        lineUserId,
        attemptCountAfterClaim: candidate.attempt_count + 1,
        appointmentId: candidate.appointment_id,
        patientRequestStatus: candidate.patient_request_id ? patientRequestStatusMap.get(candidate.patient_request_id) : undefined
      },
      (to, message) => pushLineText(to, message, candidate.id),
      undefined,
      candidate.kind === "follow_up_assigned" || candidate.kind === "follow_up_sla_reminder"
        ? (to) => {
            const flex = buildVolunteerTaskFlex(
              candidate.follow_up_id ?? candidate.id,
              candidate.kind,
              undefined
            );
            const altText = candidate.kind === "follow_up_sla_reminder"
              ? "งานติดตามค้างการบันทึก"
              : "มีงานติดตามผู้ป่วยใหม่";
            return pushLineFlex(to, flex, altText, candidate.id);
          }
        : ["patient_request_status", "appointment_rescheduled", "appointment_cancelled"].includes(candidate.kind)
          ? (to) => {
            const appointment = candidate.appointment_id ? appointmentMap.get(candidate.appointment_id) : undefined;
            const flex = buildPatientStatusFlex({
              kind: candidate.kind,
              status: candidate.patient_request_id ? patientRequestStatusMap.get(candidate.patient_request_id) : undefined,
              link: patientAppointmentDeepLink(candidate.appointment_id ?? "", undefined),
              appointmentAt: appointment?.appointment_at,
              clinic: appointment?.clinic
            });
            const altText = candidate.kind === "appointment_cancelled"
              ? "นัดของคุณถูกยกเลิก"
              : candidate.kind === "appointment_rescheduled"
                ? "นัดของคุณถูกเลื่อนเรียบร้อย"
                : "มีการอัปเดตคำขอของคุณ";
            return pushLineFlex(to, flex, altText, candidate.id);
          }
        : undefined
    );

    if (result.status === "sent") {
      await supabase.from("notification_logs").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", candidate.id);
      sent += 1;
    } else if (result.status === "unlinked") {
      await supabase.from("notification_logs").update({ status: "unlinked", error_message: "recipient has no linked LINE account" }).eq("id", candidate.id);
      unlinked += 1;
    } else if (result.status === "blocked") {
      await supabase.from("notification_logs").update({ status: "blocked", error_message: result.errorMessage }).eq("id", candidate.id);
      blocked += 1;
    } else {
      await supabase.from("notification_logs").update({
        status: result.status,
        error_message: result.errorMessage,
        next_attempt_at: "nextAttemptAt" in result ? result.nextAttemptAt : null
      }).eq("id", candidate.id);
      failed += 1;
    }
  }

  return { processed: candidates.length, sent, failed, unlinked, blocked };
}
