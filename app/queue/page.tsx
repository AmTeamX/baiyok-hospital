import { QueueBoard } from "@/components/queue-board";
import { QueueQr } from "@/components/queue-qr";

export default function QueuePage() {
  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">บริการหน้าคลินิก</p>
          <h1>จองคิวและเช็กอินด้วย QR</h1>
          <p>จัดการ slot จองคิว ดูสถานะรายวัน และสร้าง QR เช็กอินเฉพาะนัด</p>
        </div>
      </div>
      <QueueBoard />
      <div style={{ marginBlockStart: "var(--space-xl)" }}>
        <h2>สร้าง QR เช็กอิน</h2>
        <QueueQr />
      </div>
    </div>
  );
}
