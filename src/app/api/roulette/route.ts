import { NextResponse, connection } from "next/server";
import { getPublicRouletteState } from "@/lib/roulette-store";

export async function GET() {
  await connection();
  try {
    const state = await getPublicRouletteState();
    return NextResponse.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Erro ao carregar estado da roleta:", error);
    return NextResponse.json(
      { error: "Erro ao carregar dados da roleta." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
