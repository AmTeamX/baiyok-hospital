import { QueueQr } from "@/components/queue-qr";
import { QueueTabs } from "@/components/queue-tabs";

export default function QueueCheckInPage() {
  return (
    <div className="page-shell">
      <div className="page-heading"><div><p className="eyebrow">บริการหน้าคลินิก</p><h1>สร้าง QR เช็กอิน</h1><p>สร้าง QR เฉพาะนัดทีละราย เพื่อลดการเช็กอินผิดคนหรือผิดวัน</p></div></div>
      <QueueTabs />
      <QueueQr />
    </div>
  );
}
