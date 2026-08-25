import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NMN Growth Desk | Analysis Console",
  description: "Metaのキャンペーン・広告グループ・広告を期間比較し、デモグラまで掘り下げる広告管理コンソール。",
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
