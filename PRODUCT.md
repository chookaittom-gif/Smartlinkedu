# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** นักศึกษา SDU ศูนย์การศึกษาลำปาง — เข้ามากดเข้าใช้ระบบสารสนเทศที่ต้องใช้ (จองห้อง จองยานพาหนะ ยืม-คืนอุปกรณ์ ฯลฯ) ในคลิกเดียว (confirmed 2026-11-21)
- **อาจารย์/บุคลากร** — ใช้ระบบกลุ่มงานสำนักงาน/ฐานข้อมูล และผู้ดูแลจัดการลิงก์ผ่าน /admin (confirmed 2026-11-21)
- **ผู้สนใจเข้าศึกษา/บุคคลภายนอก** — ดูระบบที่เปิดให้บริการผ่านหน้าเว็บ (confirmed 2026-11-21)

## Product Purpose

ศูนย์รวมลิงก์ระบบสารสนเทศของมหาวิทยาลัยสวนดุสิต ศูนย์การศึกษาลำปาง (SmartLinkEdu) — หน้าเดียวที่รวมทุกระบบที่ต้องใช้ พร้อมค้นหา/กรองหมวดหมู่/คู่มือการใช้งาน สำเร็จ = ผู้ใช้ถึงระบบที่ต้องการภายในคลิกเดียว ไม่ต้องไล่หาลิงก์หลายที่

## Positioning

เว็บรวมลิงก์ระบบของศูนย์การศึกษาลำปางที่ผู้ดูแลจัดการเนื้อหาได้เองโดยไม่ต้อง deploy ใหม่ (ข้อมูลอยู่ใน Google Sheets ผ่าน GAS backend) — คู่แข่งเชิงกล (หน้าเว็บคณะ/มหาวิทยาลัย) ไม่มีกลไกอัปเดตลิงก์+คู่มือแบบทันทีและค้นหา/กรองได้

## Operating Context

- ภาษาไทยเป็นหลัก; แบรนด์มหาวิทยาลัยสวนดุสิต (ตรามหาวิทยาลัยใน header)
- Deploy: GitHub `chookaittom-gif/Smartlinkedu` → Vercel (production: smartlink-chookait-kusolsatit-s-projects.vercel.app; smartlinkedu.vercel.app ใช้งานได้ด้วย)
- Backend: Google Apps Script Web App + Google Sheets (สร้างโดย initializer); โลโก้ที่อัปโหลดเก็บบน Google Drive; Vercel API proxy ปิดบัง GAS_API_SECRET
- GAS เอาใจยาก: publicData ~4s, login อาจนานถึง ~55s (HMAC 10k รอบ) — หน้าแรกโหลดข้อมูล client-side จึงมีช่วงแวบแรกแสดง "✦ 0 ระบบสารสนเทศ" ก่อนข้อมูลมา (พฤติกรรมที่ยอมรับไว้ ไม่ใช่ defect)
- Session admin: HttpOnly cookie 6 ชม.; 8 ครั้งล้มเหลว → ล็อก 15 นาที

## Capabilities and Constraints

- Public: directory + ค้นหา + ฟิลเตอร์หมวดหมู่ + ลิงก์ระบบ/คู่มือ (Canva)
- Admin (/admin): CRUD+จัดลำดับระบบ, ตั้งชื่อแอป/โลโก้ (logoUrl อ้าง Drive)/อีเมลผู้แอดมิน, เปลี่ยนรหัสผ่าน, ลืมรหัสผ่านผ่าน OTP อีเมล (GAS MailApp)
- ห้าม expose GAS_API_SECRET ฝั่ง browser; อนุญาตไฟล์อัปโหลดโลโก้: png/jpeg/webp
- ระบบใน Sheet ปัจจุบัน 13 ระบบ (ลำดับ sortOrder)

## Brand Commitments

- ชื่อ SmartLinkEdu; eyebrow "DIGITAL CAMPUS DIRECTORY"
- ฟอนต์: Kanit (ไทย) + DM Sans (latin) — self-host ผ่าน next/font ตั้งแต่ 2026-11-21
- ไอเดนติตี้สี: ไล่เฉด blue→purple→teal `linear-gradient(90deg,#315be8,#7862e8 52%,#20b7b2)` บนข้อความแบรนด์/h1
- Header = ตรา SDU (พื้นหลังโปร่งใส, default `/logo-sdu.webp`), Footer = ตรา "S" ม่วง + เครดิต "ผู้พัฒนาโดย นายชูเกียรติ กุศลสถิตย์"

## Evidence on Hand

- ไซต์จริง: https://smartlinkedu.vercel.app/ (13 ระบบ live จาก Sheet)
- โลโก้: `public/logo-sdu.png` (960×1232 ต้นฉบับ), `public/logo-sdu.webp` (100×128 ใช้จริง), `app/icon.png` (favicon)
- คู่มือผู้ใช้เป็นลิงก์ Canva ต่อระบบ — ไม่มีคำรับรอง/testimonial ใด ๆ ห้ามแต่งเพิ่ม

## Product Principles

1. คลิกเดียวถึงระบบที่ต้องการ — directory มาก่อน, ขั้นตอนน้อยที่สุด
2. ความเรียบร้อยแบบ Operate: การ์ดสม่ำเสมอ โทนอ่อนอุ่นตามสถาบัน อ่านสแกนง่าย
3. เข้าถึงได้จริง: WCAG 2.1 AA เป็นเกณฑ์ขั้นต่ำของงาน UI ทุกชิ้น
4. ไทยมาก่อน: ข้อความ/label/สถานะเป็นภาษาไทยธรรมชาติ
5. ผู้ดูแลเปลี่ยนเนื้อหาเองได้ ไม่ต้องแตะโค้ด (Sheet เป็นแหล่งความจริง)

## Accessibility & Inclusion

- **WCAG 2.1 AA — ข้อผูกมัดที่ผู้ใช้ยืนยัน (2026-11-21)**: ตัวอักษรปกติต้อง contrast ≥4.5:1, ขนาดอ่านได้ (ไม่ใช้ <12px), label/aria ภาษาไทยครบ
- สถานะ 2026-11-21: จุดที่ Lighthouse ตั้งธงหมดแล้ว (แก้ครบ ≥4.5:1) — ข้อความบนพื้นไล่เฉด/ตัวอักษรแบรนด์ gradient ยังไม่ผ่าน AA ตามดีไซน์ที่อนุมัติไว้ (ตัวอักษรโลโก้ได้รับยกเว้นตาม WCAG 1.4.3) — ให้ตัดสินใจภายหลังก่อนขยายผล
