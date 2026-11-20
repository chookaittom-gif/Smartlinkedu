import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "smarklink_session";
const SESSION_MAX_AGE = 6 * 60 * 60;

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

  const outgoing: Record<string, unknown> = {
    ...incoming,
    apiSecret,
  };
  delete outgoing.apiSecret;
  if (action !== "login") {
    outgoing.sessionToken = sessionToken ?? "";
  }

  try {
    const upstream = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...outgoing, apiSecret }),
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
    });

    const raw = await upstream.text();
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { ok: false, message: "GAS ส่งข้อมูลกลับมาไม่ใช่ JSON กรุณาตรวจสอบ Web App deployment" },
        { status: 502 },
      );
    }

    if (!upstream.ok || result.ok !== true) {
      const status = upstream.status >= 400 ? upstream.status : 401;
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
      return NextResponse.json(result, {
        headers: response.headers,
      });
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
