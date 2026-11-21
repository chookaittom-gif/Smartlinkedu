import type { Metadata } from "next";
import { DM_Sans, Kanit } from "next/font/google";
import "./globals.css";

const kanit = Kanit({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-kanit",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "SmartLinkEdu | ศูนย์รวมระบบสารสนเทศ",
  description: "ศูนย์รวมระบบสารสนเทศ มหาวิทยาลัยสวนดุสิต ศูนย์การศึกษาลำปาง",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${kanit.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
