import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminAuthConfig,
  isAdminAuthenticated,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export async function GET() {
  const config = getAdminAuthConfig();
  const authenticated = await isAdminAuthenticated();
  return NextResponse.json(
    {
      authenticated,
      configured: config.configured,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const config = getAdminAuthConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        error:
          "Variável ADMIN_PASSWORD não configurada. Defina ADMIN_PASSWORD no .env.local ou na Vercel.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const password =
    typeof (body as { password?: unknown })?.password === "string"
      ? (body as { password: string }).password
      : "";

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const { token, maxAgeSeconds } = createAdminSessionToken();
  const response = NextResponse.json(
    { authenticated: true },
    { headers: { "Cache-Control": "no-store" } }
  );

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json(
    { authenticated: false },
    { headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
