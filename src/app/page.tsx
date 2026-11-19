import { Suspense } from "react";
import { connection } from "next/server";
import { RouletteArena } from "@/components/RouletteArena";
import { UcpelFooter } from "@/components/UcpelFooter";
import { UcpelHeader } from "@/components/UcpelHeader";
import { getPublicRouletteState } from "@/lib/roulette-store";

async function LiveRouletteHome() {
  await connection();
  const state = await getPublicRouletteState();

  return (
    <>
      <UcpelHeader currentPath="home" />
      <RouletteArena initialState={state} />
      <UcpelFooter />
    </>
  );
}

function RouletteSkeleton() {
  return (
    <>
      <UcpelHeader currentPath="home" />
      <main
        id="conteudo-principal"
        tabIndex={-1}
        className="flex-1 mx-auto w-full max-w-5xl px-4 py-10 sm:px-6"
      >
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-72 rounded-xl bg-[var(--bg-surface-soft)]" />
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7 h-[440px] rounded-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] mx-auto w-full max-w-[440px]" />
            <div className="lg:col-span-5 h-[400px] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]" />
          </div>
        </div>
      </main>
      <UcpelFooter />
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<RouletteSkeleton />}>
      <LiveRouletteHome />
    </Suspense>
  );
}
