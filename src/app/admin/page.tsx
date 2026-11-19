import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AdminDashboard } from "@/components/AdminDashboard";
import { UcpelFooter } from "@/components/UcpelFooter";
import { UcpelHeader } from "@/components/UcpelHeader";
import { getAdminAuthConfig, isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminRouletteState } from "@/lib/roulette-store";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

export const metadata: Metadata = {
  title: "Painel da Coordenação | Roleta Biomedicina UCPel",
  description:
    "Gerenciamento de itens, regras e ganhadores da Roleta Biomedicina UCPel Pelotas.",
};

async function LiveAdminContent() {
  await connection();
  const authConfig = getAdminAuthConfig();
  const authenticated = await isAdminAuthenticated();
  const initialData = authenticated ? await getAdminRouletteState() : null;
  const mode = initialData?.mode ?? (isSupabaseConfigured() ? "supabase" : "demo");

  return (
    <>
      <UcpelHeader currentPath="admin" />
      <AdminDashboard
        mode={mode}
        initialAuthenticated={authenticated}
        authConfigured={authConfig.configured}
        initialData={initialData}
      />
      <UcpelFooter />
    </>
  );
}

function AdminSkeleton() {
  return (
    <>
      <UcpelHeader currentPath="admin" />
      <main
        id="conteudo-principal"
        tabIndex={-1}
        className="flex-1 mx-auto w-full max-w-5xl px-4 py-12"
      >
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]" />
      </main>
      <UcpelFooter />
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <LiveAdminContent />
    </Suspense>
  );
}
