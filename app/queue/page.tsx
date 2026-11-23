import { QueueQr } from "@/components/queue-qr";

export default function QueuePage() {
  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">เช็กอินด้วย QR</p>
          <h1>สร้าง QR เช็กอิน</h1>
          <p>สร้าง QR เฉพาะนัด ให้ผู้ป่วยใช้ยืนยันเมื่อมาถึงหน่วยบริการ</p>
        </div>
      </div>
      <QueueQr />
    </div>
  );
}
