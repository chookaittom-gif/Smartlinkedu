import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "smarklink_session";
const SESSION_MAX_AGE = 6 * 60 * 60;
const GOOGLE_CONTENT_HOSTS = new Set(["script.googleusercontent.com", "script.google.com"]);

type GasReply = {
  response: Response;
  raw: string;
  url: string;
  bouncedToExec: boolean;
  detail?: string;
};

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw.replace(/^\uFEFF/, "").trim());
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAppsScriptExec(url: URL) {
  return url.hostname === "script.google.com" &&
    /\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname);
}

async function getContentResponse(startUrl: URL): Promise<GasReply> {
  let currentUrl = startUrl;
  let response: Response | null = null;
  let raw = "";

  // Walk redirects one hop at a time. Never follow a ContentService redirect
  // back to /exec as GET: that would call doGet() after the original doPost().
  for (let hop = 0; hop < 5; hop++) {
    if (isAppsScriptExec(currentUrl)) {
      return {
        response: response ?? new Response("", { status: 502 }),
        raw,
        url: currentUrl.toString(),
        bouncedToExec: true,
        detail: "Google ContentService redirected back to the Web App /exec URL",
      };
    }

    if (currentUrl.protocol !== "https:" || !GOOGLE_CONTENT_HOSTS.has(currentUrl.hostname)) {
      return {
        response: response ?? new Response("", { status: 502 }),
        raw,
        url: currentUrl.toString(),
        bouncedToExec: false,
        detail: `Unexpected Google redirect host: ${currentUrl.hostname}`,
      };
    }

    response = await fetch(currentUrl.toString(), {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(7_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        raw = await response.text();
        return { response, raw, url: currentUrl.toString(), bouncedToExec: false, detail: "Redirect has no Location header" };
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    raw = await response.text();
    const parsed = parseJsonObject(raw);

    // Google has a currently reported intermittent ContentService delivery
    // failure. The same one-time googleusercontent URL can become available
    // after a short delay, so retry only this GET, never the original POST.
    if (!parsed && currentUrl.hostname === "script.googleusercontent.com" && hop < 4) {
      for (let retry = 0; retry < 2; retry++) {
        await delay(1_500 * (retry + 1));
        response = await fetch(currentUrl.toString(), {
          method: "GET",
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(7_000),
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (location) {
            currentUrl = new URL(location, currentUrl);
            break;
          }
        } else {
          raw = await response.text();
          if (parseJsonObject(raw)) {
            return { response, raw, url: currentUrl.toString(), bouncedToExec: false };
          }
        }
      }
      if (response.status >= 300 && response.status < 400) continue;
    }

    return { response, raw, url: currentUrl.toString(), bouncedToExec: false };
  }

  return {
    response: response ?? new Response("", { status: 502 }),
    raw,
    url: currentUrl.toString(),
    bouncedToExec: isAppsScriptExec(currentUrl),
    detail: "Google redirect limit exceeded",
  };
}

async function callGas(gasUrl: string, requestBody: string): Promise<GasReply> {
  const initial = await fetch(gasUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(7_000),
  });

  if (initial.status >= 300 && initial.status < 400) {
    const location = initial.headers.get("location");
    if (!location) {
      const raw = await initial.text();
      return { response: initial, raw, url: gasUrl, bouncedToExec: false, detail: "POST redirect has no Location header" };
    }
    return getContentResponse(new URL(location, gasUrl));
  }

  const raw = await initial.text();
  return { response: initial, raw, url: initial.url || gasUrl, bouncedToExec: false };
}

export async function POST(request: NextRequest) {
  const gasUrl = process.env.GAS_WEB_APP_URL;
  const apiSecret = process.env.GAS_API_SECRET;

  if (!gasUrl || !apiSecret) {
    return NextResponse.json(
      { ok: false, message: "Server ยังไม่ได้ตั้งค่า GAS_WEB_APP_URL และ GAS_API_SECRET" },
      { status: 503 },
    );
  }

  let incoming: Record<string, unknown>;
  try {
    incoming = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const action = String(incoming.action ?? "");
  if (!action) {
    return NextResponse.json({ ok: false, message: "ไม่พบ action" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  const outgoing: Record<string, unknown> = { ...incoming };
  if (action !== "login") outgoing.sessionToken = sessionToken ?? "";
  const requestBody = JSON.stringify({ ...outgoing, apiSecret });

  try {
    let reply: GasReply | null = null;
    // Only repeat the original POST for idempotent read operations. Never replay
    // save/delete/password/logout actions because doPost may already have run.
    const safeToRetryPost = ["publicData", "me", "adminData"].includes(action);
    const postAttempts = safeToRetryPost ? 2 : 1;

    for (let attempt = 0; attempt < postAttempts; attempt++) {
      reply = await callGas(gasUrl, requestBody);
      const parsed = parseJsonObject(reply.raw);
      if (parsed || !reply.bouncedToExec || attempt === postAttempts - 1) break;
      await delay(1_500);
    }

    if (!reply) {
      return NextResponse.json({ ok: false, message: "ไม่ได้รับผลตอบกลับจาก GAS" }, { status: 502 });
    }

    const result = parseJsonObject(reply.raw);
    if (!result) {
      const contentType = reply.response.headers.get("content-type") || "unknown";
      let host = "unknown";
      try { host = new URL(reply.url).hostname; } catch { /* ignore malformed URL */ }
      const preview = reply.raw.replace(/\s+/g, " ").slice(0, 180);
      const detail = reply.detail ? ` ${reply.detail}.` : "";
      const retryHint = safeToRetryPost
        ? " ลองโหลดหน้าใหม่อีกครั้งได้ เพราะคำขอนี้เป็นการอ่านข้อมูล"
        : " คำสั่งอาจทำงานที่ GAS แล้ว แต่ Google ส่งผลลัพธ์กลับไม่สำเร็จ โปรดตรวจข้อมูลก่อนกดบันทึกซ้ำ";
      return NextResponse.json(
        {
          ok: false,
          message: `GAS ไม่ได้ส่ง JSON (HTTP ${reply.response.status}, Content-Type ${contentType}, host ${host}).${detail} ${preview}${retryHint}`.trim(),
        },
        { status: 502 },
      );
    }

    if (!reply.response.ok || result.ok !== true) {
      const status = reply.response.status >= 400 ? reply.response.status : 401;
      return NextResponse.json(result, { status });
    }

    const response = NextResponse.json(result);
    if (action === "login" && typeof result.sessionToken === "string") {
      response.cookies.set(SESSION_COOKIE, result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      });
      delete result.sessionToken;
      return NextResponse.json(result, { headers: response.headers });
    }

    if (action === "logout") {
      response.cookies.set(SESSION_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "เชื่อมต่อ GAS ไม่สำเร็จ";
    return NextResponse.json(
      { ok: false, message: `เชื่อมต่อ Backend ไม่สำเร็จ: ${message}` },
      { status: 502 },
    );
  }
}
