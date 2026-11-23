import Link from "next/link";
import { ArrowUpRight, MessageCircleQuestion, Pill, ShieldCheck, Stethoscope } from "lucide-react";

const lessons = [
  { icon: Stethoscope, title: "ไม่มีอาการ ไม่ได้แปลว่าหาย", body: "ความดันสูงมักไม่แสดงอาการ แต่ยังทำร้ายหัวใจ สมอง ไต และดวงตาได้", question: "ถ้าวันนี้รู้สึกปกติ ยังต้องกินยาและมาตามนัดหรือไม่?" },
  { icon: Pill, title: "ไม่หยุดยา ไม่ซื้อยาเอง", body: "ยาความดันต้องใช้ต่อเนื่อง การหยุดยาเองทำให้ความดันพุ่งโดยไม่รู้ตัว", question: "ถ้ายาหมดก่อนวันนัด คุณจะทำอย่างไร?" },
  { icon: ShieldCheck, title: "ป้องกันภาวะแทรกซ้อน", body: "ลดเค็ม วัดความดันสม่ำเสมอ เคลื่อนไหวร่างกาย และมารับบริการตามนัด", question: "สัปดาห์นี้คุณจะเริ่มดูแลตัวเองข้อใดหนึ่งข้อ?" }
];

export default function EducationPage() { return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">คลังเนื้อหาสำหรับ LINE</p><h1>สื่อสุขภาพ</h1><p>เลือกเนื้อหาประกอบการให้คำปรึกษา พร้อมคำถามทบทวนความเข้าใจ</p></div><Link className="button secondary" href="/liff/education">ดูหน้าผู้ป่วย <ArrowUpRight size={17} /></Link></div><div className="education-library">{lessons.map((lesson, i) => <article className="lesson-card" key={lesson.title}><div className="lesson-card-top"><span className="lesson-number">บทที่ 0{i + 1}</span><lesson.icon size={24} /></div><h2>{lesson.title}</h2><p>{lesson.body}</p><div className="reflection"><MessageCircleQuestion size={20} /><span><strong>คำถามทบทวน</strong>{lesson.question}</span></div></article>)}</div><section className="education-note"><ShieldCheck size={21} /><p>ใช้เนื้อหาประกอบการให้คำปรึกษา โดยพิจารณาปัญหาและข้อจำกัดของผู้ป่วยแต่ละราย</p></section></div>; }
