"use client";

import { FormEvent, InputHTMLAttributes, useEffect, useState } from "react";

type System = { id: string; name: string; version: string; url: string; manualUrl: string; category: string; icon: string; sortOrder: number };
type Settings = { appName: string; logoUrl: string };
type ApiResult = { ok: boolean; message?: string; user?: string; passwordChangeRequired?: boolean; systems?: System[]; settings?: Settings };

async function api(action: string, extra: Record<string, unknown> = {}): Promise<ApiResult> {
  const response = await fetch("/api/gas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
  return response.json();
}

const blankSystem = (): System => ({ id: "", name: "", version: "", url: "", manualUrl: "", category: "งานบริการ", icon: "▣", sortOrder: 99 });

function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw-wrap">
      <input {...props} type={show ? "text" : "password"} />
      <button type="button" className="pw-toggle" aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={show} onClick={() => setShow((v) => !v)}>{show ? "🙈" : "👁"}</button>
    </span>
  );
}

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [systems, setSystems] = useState<System[]>([]);
  const [settings, setSettings] = useState<Settings>({ appName: "SmartLinkEdu", logoUrl: "" });
  const [editing, setEditing] = useState<System | null>(null);
  const [tab, setTab] = useState<"systems" | "settings">("systems");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDashboard() {
    const result = await api("adminData");
    if (!result.ok) { setLoggedIn(false); return; }
    setSystems(result.systems ?? []);
    setSettings(result.settings ?? { appName: "SmartLinkEdu", logoUrl: "" });
    setLoggedIn(true);
  }

  useEffect(() => { void (async () => {
    const me = await api("me");
    if (me.ok) {
      setUser(me.user ?? "admin");
      setMustChangePassword(Boolean(me.passwordChangeRequired));
      await loadDashboard();
    }
  })(); }, []);

  async function handleLogin(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await api("login", { username, password });
      if (!result.ok) throw new Error(result.message || "เข้าสู่ระบบไม่สำเร็จ");
      setUser(result.user ?? username); setMustChangePassword(Boolean(result.passwordChangeRequired));
      await loadDashboard(); setPassword("");
    } catch (err) { setMessage(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"); }
    finally { setBusy(false); }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await api("changePassword", { newPassword });
      if (!result.ok) throw new Error(result.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      setMustChangePassword(false); setNewPassword(""); setMessage("เปลี่ยนรหัสผ่านสำเร็จ");
    } catch (err) { setMessage(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"); }
    finally { setBusy(false); }
  }

  async function saveSystem(e: FormEvent) {
    e.preventDefault(); if (!editing) return; setBusy(true); setMessage("");
    try {
      const result = await api("saveSystem", { system: editing });
      if (!result.ok) throw new Error(result.message || "บันทึกไม่สำเร็จ");
      setEditing(null); await loadDashboard(); setMessage("บันทึกระบบเรียบร้อย");
    } catch (err) { setMessage(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"); }
    finally { setBusy(false); }
  }

  async function deleteSystem(id: string) {
    if (!confirm("ยืนยันลบระบบนี้หรือไม่?")) return;
    const result = await api("deleteSystem", { id });
    setMessage(result.message || (result.ok ? "ลบเรียบร้อย" : "ลบไม่สำเร็จ"));
    if (result.ok) await loadDashboard();
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await api("saveSettings", { settings });
      if (!result.ok) throw new Error(result.message || "บันทึกการตั้งค่าไม่สำเร็จ");
      setSettings(result.settings ?? settings); setMessage("บันทึกการตั้งค่าเรียบร้อย");
    } catch (err) { setMessage(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"); }
    finally { setBusy(false); }
  }

  async function uploadLogo(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setMessage("รองรับไฟล์ PNG, JPG หรือ WEBP เท่านั้น"); return; }
    if (file.size > 1024 * 1024) { setMessage("กรุณาใช้รูปโลโก้ขนาดไม่เกิน 1 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setSettings((s) => ({ ...s, logoDataUrl: String(reader.result) } as Settings));
    reader.readAsDataURL(file);
  }

  async function logout() { await api("logout"); setLoggedIn(false); setUser(""); }

  if (!loggedIn) return <main className="admin-page"><a className="back-home" href="/">← กลับหน้าหลัก</a><form className="login-card" onSubmit={handleLogin}>
    <div className="brand-mark login-mark">S</div><div className="eyebrow dark-eyebrow">ADMIN ACCESS</div><h1>เข้าสู่ระบบผู้ดูแล</h1><p>จัดการข้อมูลระบบสารสนเทศ SmartLinkEdu</p>
    <label>ชื่อผู้ใช้<input required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ชื่อผู้ใช้ผู้ดูแล" /></label>
    <label>รหัสผ่าน<PasswordInput required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="กรอกรหัสผ่าน" /></label>
    {message && <div className="notice error-state">{message}</div>}
    <button className="primary-action submit-action" disabled={busy}>{busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ →"}</button>
  </form></main>;

  return <main className="admin-page"><div className="admin-shell">
    <header className="admin-header"><a className="brand" href="/"><span className="brand-mark">S</span><span>SmartLinkEdu Admin</span></a><div><span className="admin-user">ผู้ดูแล: {user}</span><button className="text-button" onClick={logout}>ออกจากระบบ</button></div></header>
    {message && <div className="notice">{message}</div>}
    {mustChangePassword ? <form className="panel password-panel" onSubmit={savePassword}><h2>ตั้งรหัสผ่านใหม่</h2><p>กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนเริ่มใช้งาน</p><label>รหัสผ่านใหม่<PasswordInput minLength={12} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="อย่างน้อย 12 ตัวอักษร" /></label><button className="primary-action" disabled={busy}>บันทึกรหัสผ่านใหม่</button></form> : <>
      <div className="admin-title"><div><div className="eyebrow dark-eyebrow">CONTROL CENTER</div><h1>จัดการระบบสารสนเทศ</h1></div><span className="result-count">{systems.length} ระบบ</span></div>
      <div className="admin-tabs"><button className={tab === "systems" ? "active" : ""} onClick={() => setTab("systems")}>จัดการระบบ</button><button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>ตั้งค่าระบบ</button></div>
      {tab === "systems" ? <section className="panel"><div className="panel-heading"><div><h2>รายการระบบ</h2><p>เพิ่ม แก้ไข ลบ และกำหนดลำดับการแสดงผล</p></div><button className="primary-action" onClick={() => setEditing(blankSystem())}>＋ เพิ่มระบบ</button></div>
        {editing && <form className="edit-form" onSubmit={saveSystem}><h3>{editing.id ? "แก้ไขระบบ" : "เพิ่มระบบใหม่"}</h3>
          <label>ชื่อระบบ<input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
          <div className="form-row"><label>เวอร์ชัน<input value={editing.version} onChange={(e) => setEditing({ ...editing, version: e.target.value })} placeholder="เช่น V.1.0" /></label><label>หมวดหมู่<input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></label><label>ไอคอน<input value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></label><label>ลำดับ<input type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} /></label></div>
          <label>URL ระบบ<input required type="url" value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} /></label><label>URL คู่มือ (เว้นว่างหากยังไม่มี)<input type="url" value={editing.manualUrl} onChange={(e) => setEditing({ ...editing, manualUrl: e.target.value })} /></label>
          <div className="form-actions"><button type="button" className="secondary-action" onClick={() => setEditing(null)}>ยกเลิก</button><button className="primary-action" disabled={busy}>บันทึก</button></div>
        </form>}
        <div className="admin-list">{systems.slice().sort((a,b) => a.sortOrder-b.sortOrder).map((s) => <div className="admin-row" key={s.id}><span className="admin-row-icon">{s.icon || "▣"}</span><div className="admin-row-info"><strong>{s.name}</strong><small>{s.url}</small></div><span className="order-badge">#{s.sortOrder}</span><button className="secondary-action" onClick={() => setEditing({ ...s })}>แก้ไข</button><button className="danger-button" onClick={() => deleteSystem(s.id)}>ลบ</button></div>)}</div>
      </section> : <section className="panel"><h2>ตั้งค่าระบบรวมลิงก์</h2><p>เปลี่ยนชื่อระบบและโลโก้ที่แสดงในหน้าหลัก</p><form className="edit-form" onSubmit={saveSettings}><label>ชื่อระบบ<input required value={settings.appName} onChange={(e) => setSettings({ ...settings, appName: e.target.value })} /></label><label>โลโก้ระบบ<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadLogo(e.target.files?.[0])} /></label>{settings.logoUrl && <img className="settings-logo" src={settings.logoUrl} alt="โลโก้ปัจจุบัน" />}<button className="primary-action" disabled={busy}>บันทึกการตั้งค่า</button></form></section>}
    </>}
  </div></main>;
}
