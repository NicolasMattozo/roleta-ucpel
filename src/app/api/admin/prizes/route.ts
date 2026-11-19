import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  addPrizes,
  deletePrize,
  getAdminRouletteState,
  RouletteActionError,
  updatePrize,
} from "@/lib/roulette-store";

export async function POST(request: Request) {
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
    name?: unknown;
    description?: unknown;
    category?: unknown;
    color?: unknown;
    quantity?: unknown;
  } | null;

  try {
    await addPrizes({
      name: typeof payload?.name === "string" ? payload.name : "",
      description: typeof payload?.description === "string" ? payload.description : null,
      category: typeof payload?.category === "string" ? payload.category : "Brinde",
      color: typeof payload?.color === "string" ? payload.color : null,
      quantity: typeof payload?.quantity === "number" ? payload.quantity : 1,
    });

    const state = await getAdminRouletteState();
    return NextResponse.json(state, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RouletteActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao adicionar item:", error);
    return NextResponse.json({ error: "Erro ao adicionar item." }, { status: 500 });
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
    id?: unknown;
    name?: unknown;
    description?: unknown;
    category?: unknown;
    color?: unknown;
    isAvailable?: unknown;
  } | null;

  if (typeof payload?.id !== "string" || !payload.id.trim()) {
    return NextResponse.json({ error: "ID do item é obrigatório." }, { status: 400 });
  }

  try {
    await updatePrize(payload.id, {
      name: typeof payload.name === "string" ? payload.name : undefined,
      description:
        payload.description === null || typeof payload.description === "string"
          ? payload.description
          : undefined,
      category: typeof payload.category === "string" ? payload.category : undefined,
      color:
        payload.color === null || typeof payload.color === "string"
          ? payload.color
          : undefined,
      isAvailable: typeof payload.isAvailable === "boolean" ? payload.isAvailable : undefined,
    });

    const state = await getAdminRouletteState();
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RouletteActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao atualizar item:", error);
    return NextResponse.json({ error: "Erro ao atualizar item." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const id =
    typeof (body as { id?: unknown })?.id === "string"
      ? (body as { id: string }).id
      : "";

  if (!id) {
    return NextResponse.json({ error: "ID do item é obrigatório." }, { status: 400 });
  }

  try {
    await deletePrize(id);
    const state = await getAdminRouletteState();
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao remover item:", error);
    return NextResponse.json({ error: "Erro ao remover item." }, { status: 500 });
  }
}
