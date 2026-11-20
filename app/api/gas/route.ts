import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "smarklink_session";
const SESSION_MAX_AGE = 6 * 60 * 60;
function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw.replace(/^\\uFEFF/, "").trim());
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
    // Apps Script ContentService returns a 302 to a one-time googleusercontent URL.
    // Handle that redirect explicitly so the POST is not replayed as a GET to /exec,
    // and retry only the final read of the one-time response URL if Google's content
    // serving layer has not made the response available yet.
    const initial = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(25_000),
    });

    let upstream = initial;
    let finalUrl = initial.url || gasUrl;
    let raw = "";

    if (initial.status >= 300 && initial.status < 400) {
      const location = initial.headers.get("location");
      if (!location) {
        return NextResponse.json(
          { ok: false, message: `GAS ตอบกลับ HTTP ${initial.status} แต่ไม่มี Location สำหรับ ContentService redirect` },
          { status: 502 },
        );
      }

      const redirectedUrl = new URL(location, gasUrl);
      if (
        redirectedUrl.protocol !== "https:" ||
        !["script.googleusercontent.com", "script.google.com"].includes(redirectedUrl.hostname)
      ) {
        return NextResponse.json(
          { ok: false, message: `GAS redirect ไปยัง host ที่ไม่คาดหมาย: ${redirectedUrl.hostname}` },
          { status: 502 },
        );
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        upstream = await fetch(redirectedUrl.toString(), {
          method: "GET",
          cache: "no-store",
          redirect: "follow",
          signal: AbortSignal.timeout(25_000),
        });
        finalUrl = upstream.url || redirectedUrl.toString();
        raw = await upstream.text();

        if (upstream.ok && parseJsonObject(raw)) break;
        if (attempt < 2) await delay(500 * (attempt + 1));
      }
    } else {
      finalUrl = initial.url || gasUrl;
      raw = await initial.text();
    }

    const result = parseJsonObject(raw);
    if (!result) {
      const contentType = upstream.headers.get("content-type") || "unknown";
      let finalHost = "unknown";
      try {
        finalHost = new URL(finalUrl).hostname;
      } catch {
        // Keep the diagnostic host as unknown if the response URL is malformed.
      }
      const preview = raw.replace(/\\s+/g, " ").slice(0, 180);
      return NextResponse.json(
        {
          ok: false,
          message: `GAS ไม่ได้ส่ง JSON (HTTP ${upstream.status}, Content-Type ${contentType}, host ${finalHost}) ${preview}`.trim(),
        },
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
