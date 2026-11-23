import { QueueQr } from "@/components/queue-qr";

export default function QueuePage() { return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">บริการหน้าคลินิก</p><h1>จองคิวและเช็กอินด้วย QR</h1><p>สร้าง QR เฉพาะนัด ให้ผู้ป่วยหรือ อสม. ใช้ยืนยันเมื่อมาถึง</p></div></div><QueueQr /></div>; }
