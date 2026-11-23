import { QueueBoard } from "@/components/queue-board";
import { QueueTabs } from "@/components/queue-tabs";

export default function QueuePage() {
  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">บริการหน้าคลินิก</p>
          <h1>คิวบริการรายวัน</h1>
          <p>เปิดช่วงเวลา ดูจำนวนจอง และยืนยันการมารับบริการในพื้นที่เดียว</p>
        </div>
      </div>
      <QueueTabs />
      <QueueBoard />
    </div>
  );
}
