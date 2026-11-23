export type QueueBookingStatus = "booked" | "checked_in" | "cancelled" | "no_show";

export const QUEUE_BOOKING_STATUSES: QueueBookingStatus[] = ["booked", "checked_in", "cancelled", "no_show"];

export const QUEUE_BOOKING_STATUS_LABELS: Record<QueueBookingStatus, string> = {
  booked: "จองแล้ว",
  checked_in: "มาแล้ว",
  cancelled: "ยกเลิก",
  no_show: "ไม่มา"
};

export function isValidQueueBookingStatus(value: unknown): value is QueueBookingStatus {
  return typeof value === "string" && (QUEUE_BOOKING_STATUSES as string[]).includes(value);
}

export type QueueSlot = {
  id: string;
  clinic: string;
  serviceDate: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  active: boolean;
};

export type QueueBooking = {
  id: string;
  slotId: string;
  queueNumber: number;
  status: QueueBookingStatus;
  bookedAt: string;
  checkedInAt: string | null;
  patientName: string | null;
};
