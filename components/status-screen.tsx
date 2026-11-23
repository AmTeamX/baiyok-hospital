import { HeartPulse, CircleAlert } from "lucide-react";

export function StatusScreen({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="status-screen"><div className="status-brand"><HeartPulse size={21} />CareBack <span>รพ.สต. สระโคล่</span></div><section><span className="status-symbol"><CircleAlert size={32} /></span><h1>{title}</h1><p>{description}</p><div className="status-actions">{children}</div></section></div>;
}
