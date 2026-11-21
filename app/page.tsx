"use client";

import { useEffect, useMemo, useState } from "react";

type System = {
  id: string;
  name: string;
  version: string;
  url: string;
  manualUrl: string;
  category: string;
  icon: string;
  sortOrder: number;
};
type Settings = { appName: string; logoUrl: string };
type ApiResult = { ok: boolean; message?: string; systems?: System[]; settings?: Settings };

async function api(action: string, extra: Record<string, unknown> = {}): Promise<ApiResult> {
  const response = await fetch("/api/gas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  return response.json();
}

export default function HomePage() {
  const [systems, setSystems] = useState<System[]>([]);
  const [settings, setSettings] = useState<Settings>({ appName: "SmartLinkEdu", logoUrl: "" });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api("publicData")
      .then((data) => {
        if (!data.ok) throw new Error(data.message || "โหลดข้อมูลไม่สำเร็จ");
        setSystems(data.systems ?? []);
        setSettings(data.settings ?? { appName: "SmartLinkEdu", logoUrl: "" });
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ["ทั้งหมด", ...Array.from(new Set(systems.map((item) => item.category).filter(Boolean)))],
    [systems],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("th");
    return systems
      .filter((item) => category === "ทั้งหมด" || item.category === category)
      .filter((item) => !term || item.name.toLocaleLowerCase("th").includes(term))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [systems, search, category]);

  return (
    <main>
      <section className="hero">
        <div className="hero-glow glow-one" />
        <div className="hero-glow glow-two" />
        <nav className="topbar shell">
          <a href="/" className="brand">
            {settings.logoUrl ? <img src={settings.logoUrl} alt="โลโก้ระบบ" width={100} height={128} className="brand-logo" /> : <img src="/logo-sdu.webp" alt="โลโก้มหาวิทยาลัยสวนดุสิต" width={100} height={128} className="brand-logo" />}
            <span className="brand-text">{settings.appName || "SmartLinkEdu"}</span>
          </a>
          <a href="/admin" className="admin-link">สำหรับผู้ดูแล <span>↗</span></a>
        </nav>
        <div className="hero-content shell">
          <div className="eyebrow"><span className="eyebrow-dot" /> DIGITAL CAMPUS DIRECTORY</div>
          <h1>ทุกระบบที่ต้องใช้<br /><span>รวมไว้ในที่เดียว</span></h1>
          <p>ศูนย์รวมระบบสารสนเทศ มหาวิทยาลัยสวนดุสิต<br className="desktop-break" /> ศูนย์การศึกษาลำปาง</p>
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาระบบที่ต้องการ..." aria-label="ค้นหาระบบ" />
            <kbd>ค้นหา</kbd>
          </div>
          <div className="hero-meta"><span>✦ {systems.length} ระบบสารสนเทศ</span><span>•</span><span>เข้าถึงง่ายในคลิกเดียว</span></div>
        </div>
      </section>

      <section className="directory shell">
        <div className="section-heading">
          <div><div className="eyebrow dark-eyebrow">SYSTEM DIRECTORY</div><h2>ระบบสารสนเทศทั้งหมด</h2><p>เลือกบริการที่ต้องการเพื่อเข้าใช้งานได้ทันที</p></div>
          <div className="result-count">{filtered.length} <span>รายการ</span></div>
        </div>

        <div className="filters" aria-label="ตัวกรองหมวดหมู่">
          {categories.map((item) => <button key={item} className={category === item ? "filter active" : "filter"} onClick={() => setCategory(item)}>{item}</button>)}
        </div>

        {loading ? <div className="state-card"><span className="spinner" /> กำลังโหลดข้อมูลระบบ...</div> :
          error ? <div className="state-card error-state"><strong>ไม่สามารถโหลดข้อมูลได้</strong><span>{error}</span><small>ตรวจสอบการตั้งค่า GAS และ Vercel Environment Variables</small></div> :
          filtered.length === 0 ? <div className="state-card"><strong>ไม่พบระบบที่ค้นหา</strong><span>ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น</span></div> :
          <div className="system-grid">
            {filtered.map((item, index) => (
              <article className="system-card" key={item.id}>
                <div className="card-top"><div className="system-icon">{item.icon || "▣"}</div><span className="card-number">{String(index + 1).padStart(2, "0")}</span></div>
                <div className="system-category">{item.category || "ระบบสารสนเทศ"}</div>
                <h3>{item.name}</h3>
                {item.version && <span className="version-tag">{item.version}</span>}
                <div className="card-actions">
                  <a className="primary-action" href={item.url} target="_blank" rel="noopener noreferrer">เข้าใช้งานระบบ <span>↗</span></a>
                  {item.manualUrl ? <a className="secondary-action" href={item.manualUrl} target="_blank" rel="noopener noreferrer">คู่มือการใช้งาน ↗</a> : <span className="manual-pending">คู่มืออยู่ระหว่างจัดทำ</span>}
                </div>
              </article>
            ))}
          </div>}
      </section>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand"><span className="brand-mark small-mark">S</span><strong>{settings.appName || "SmartLinkEdu"}</strong></div>
          <div className="footer-credit">ผู้พัฒนา โดย นายชูเกียรติ กุศลสถิตย์</div>
          <div className="footer-credit">มหาวิทยาลัยสวนดุสิต ศูนย์การศึกษาลำปาง</div>
          <div className="footer-copy">© {new Date().getFullYear()} SmartLinkEdu · Digital Campus Directory</div>
        </div>
      </footer>
    </main>
  );
}
