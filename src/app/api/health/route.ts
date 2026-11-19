import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      storage: isSupabaseConfigured() ? "supabase" : "demo",
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
