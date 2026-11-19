import { NextResponse } from "next/server";
import { RouletteActionError, spinRoulette } from "@/lib/roulette-store";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida.", code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  const payload = body as { fullName?: unknown; cpf?: unknown } | null;
  const fullName = typeof payload?.fullName === "string" ? payload.fullName : "";
  const cpf = typeof payload?.cpf === "string" ? payload.cpf : "";

  try {
    const result = await spinRoulette(fullName, cpf);
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RouletteActionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.error("Erro inesperado ao girar roleta:", error);
    return NextResponse.json(
      {
        error: "Erro interno ao processar o sorteio. Tente novamente.",
        code: "INTERNAL_ERROR",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
