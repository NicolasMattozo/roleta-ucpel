import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  getAdminRouletteState,
  resetRoulette,
  updateRouletteSettings,
} from "@/lib/roulette-store";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const state = await getAdminRouletteState();
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao carregar dados do admin:", error);
    return NextResponse.json(
      { error: "Erro ao carregar painel administrativo." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const payload = body as {
    action?: unknown;
    clearHistory?: unknown;
    eventTitle?: unknown;
    allowMultipleSpinsPerCpf?: unknown;
    isActive?: unknown;
  } | null;

  try {
    if (payload?.action === "reset") {
      await resetRoulette(Boolean(payload.clearHistory));
    } else {
      await updateRouletteSettings({
        eventTitle: typeof payload?.eventTitle === "string" ? payload.eventTitle : undefined,
        allowMultipleSpinsPerCpf:
          typeof payload?.allowMultipleSpinsPerCpf === "boolean"
            ? payload.allowMultipleSpinsPerCpf
            : undefined,
        isActive: typeof payload?.isActive === "boolean" ? payload.isActive : undefined,
      });
    }

    const state = await getAdminRouletteState();
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao atualizar configurações:", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar configurações." },
      { status: 500 }
    );
  }
}
