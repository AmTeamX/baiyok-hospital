import { LiffNavigation } from "@/components/liff-navigation";

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return <div className="liff-workspace">{children}<LiffNavigation /></div>;
}
