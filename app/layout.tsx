import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartLinkEdu | ศูนย์รวมระบบสารสนเทศ",
  description: "ศูนย์รวมระบบสารสนเทศ มหาวิทยาลัยสวนดุสิต ศูนย์การศึกษาลำปาง",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
