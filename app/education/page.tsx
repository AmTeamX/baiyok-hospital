import Link from "next/link";
import { ArrowUpRight, MessageCircleQuestion, Pill, ShieldCheck, Stethoscope } from "lucide-react";

const lessons = [
  { icon: Stethoscope, title: "ไม่มีอาการ ไม่ได้แปลว่าหาย", body: "ความดันสูงมักไม่แสดงอาการ แต่ยังทำร้ายหัวใจ สมอง ไต และดวงตาได้", question: "ถ้าวันนี้รู้สึกปกติ ยังต้องกินยาและมาตามนัดหรือไม่?" },
  { icon: Pill, title: "ไม่หยุดยา ไม่ซื้อยาเอง", body: "ยาความดันต้องใช้ต่อเนื่อง การหยุดยาเองทำให้ความดันพุ่งโดยไม่รู้ตัว", question: "ถ้ายาหมดก่อนวันนัด คุณจะทำอย่างไร?" },
  { icon: ShieldCheck, title: "ป้องกันภาวะแทรกซ้อน", body: "ลดเค็ม วัดความดันสม่ำเสมอ เคลื่อนไหวร่างกาย และมารับบริการตามนัด", question: "สัปดาห์นี้คุณจะเริ่มดูแลตัวเองข้อใดหนึ่งข้อ?" }
];

export default function EducationPage() { return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">สื่อสำหรับ LINE OA</p><h1>เข้าใจโรคในเวลาสั้น ๆ</h1><p>ข้อความอ่านง่าย พร้อมคำถามสะท้อนความเข้าใจและช่องทางขอคำปรึกษา</p></div><Link className="button secondary" href="/patient/demo">ดูหน้าผู้ป่วย <ArrowUpRight size={17} /></Link></div><div className="lesson-grid">{lessons.map((lesson, i) => <article className="lesson-card" key={lesson.title}><span className="lesson-number">0{i + 1}</span><lesson.icon size={34} /><h2>{lesson.title}</h2><p>{lesson.body}</p><div className="reflection"><MessageCircleQuestion size={20} /><span><strong>ลองตอบตัวเอง</strong>{lesson.question}</span></div></article>)}</div><section className="nurse-cta"><div><h2>ยังไม่แน่ใจ หรือมีปัญหาเรื่องยา?</h2><p>ส่งเรื่องให้พยาบาลติดต่อกลับ ระบบจะไม่เปลี่ยนวันนัดให้อัตโนมัติ</p></div><button className="button on-dark">ขอปรึกษาพยาบาล</button></section></div>; }
