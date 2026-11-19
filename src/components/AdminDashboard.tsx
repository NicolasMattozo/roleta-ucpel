"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Undo2,
} from "lucide-react";
import { bindDialogFallbacks, closeTopLayerDialog } from "@/lib/dialog-helpers";
import { BIOMED_SLICE_PALETTE, PRIZE_CATEGORIES, resolveSliceColor } from "@/lib/palette";
import type { AdminRouletteState, Prize, StorageMode } from "@/lib/types";

interface AdminDashboardProps {
  mode: StorageMode;
  initialAuthenticated: boolean;
  authConfigured: boolean;
  initialData: AdminRouletteState | null;
}

export function AdminDashboard({
  mode,
  initialAuthenticated,
  authConfigured,
  initialData,
}: AdminDashboardProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [data, setData] = useState<AdminRouletteState | null>(initialData);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<string>(PRIZE_CATEGORIES[0]);
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState<string>(BIOMED_SLICE_PALETTE[0]);
  const [newQuantity, setNewQuantity] = useState(1);

  const [eventTitle, setEventTitle] = useState(
    initialData?.settings.eventTitle ?? "Roleta Biomedicina UCPel • Pelotas"
  );

  const [busyAction, setBusyAction] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [resetClearHistory, setResetClearHistory] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmDialogRef = useRef<HTMLDialogElement | null>(null);

  const passwordId = useId();
  const passwordHintId = useId();
  const confirmTitleId = useId();
  const prizeNameId = useId();
  const prizeCatId = useId();
  const prizeQtyId = useId();
  const prizeDescId = useId();
  const titleInputId = useId();

  useEffect(() => {
    const dialog = confirmDialogRef.current;
    if (!dialog) return;

    const cleanup = bindDialogFallbacks(dialog, () => setConfirmOpen(false));
    const onClose = () => {
      dialog.returnValue = "";
      setConfirmOpen(false);
    };
    dialog.addEventListener("close", onClose);
    return () => {
      cleanup();
      dialog.removeEventListener("close", onClose);
    };
  }, [authenticated]);

  useEffect(() => {
    const dialog = confirmDialogRef.current;
    if (!dialog) return;
    if (confirmOpen && !dialog.open) {
      dialog.showModal();
    } else if (!confirmOpen && dialog.open) {
      void closeTopLayerDialog(dialog);
    }
  }, [confirmOpen]);

  const loadAdminData = useCallback(async () => {
    const res = await fetch("/api/admin/data", { cache: "no-store" });
    if (res.status === 401) {
      setAuthenticated(false);
      setData(null);
      return;
    }
    if (!res.ok) {
      throw new Error("Erro ao carregar dados.");
    }
    const next = (await res.json()) as AdminRouletteState;
    setData(next);
    setEventTitle(next.settings.eventTitle);
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setLoginError(json.error || "Não foi possível entrar.");
        return;
      }
      setAuthenticated(true);
      setPassword("");
      await loadAdminData();
    } catch {
      setLoginError("Erro de rede ao autenticar.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAuthenticated(false);
    setData(null);
  };

  const handleAddPrize = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    setBusyAction(true);
    try {
      const res = await fetch("/api/admin/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          category: newCategory,
          description: newDescription || null,
          color: newColor,
          quantity: newQuantity,
        }),
      });
      const json = (await res.json()) as AdminRouletteState & { error?: string };
      if (!res.ok) {
        setFeedback({ type: "err", text: json.error || "Erro ao adicionar item." });
        return;
      }
      setData(json);
      setNewName("");
      setNewDescription("");
      setNewQuantity(1);
      setFeedback({
        type: "ok",
        text:
          newQuantity > 1
            ? `${newQuantity} unidades adicionadas na roleta.`
            : "Item adicionado na roleta.",
      });
    } catch {
      setFeedback({ type: "err", text: "Erro de conexão ao adicionar item." });
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleAvailability = async (prize: Prize) => {
    setFeedback(null);
    setBusyAction(true);
    try {
      const res = await fetch("/api/admin/prizes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prize.id, isAvailable: !prize.isAvailable }),
      });
      const json = (await res.json()) as AdminRouletteState & { error?: string };
      if (!res.ok) {
        setFeedback({ type: "err", text: json.error || "Erro ao atualizar item." });
        return;
      }
      setData(json);
      setFeedback({
        type: "ok",
        text: !prize.isAvailable
          ? `"${prize.name}" voltou para a roleta.`
          : `"${prize.name}" ocultado da roleta.`,
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeletePrize = async (prize: Prize) => {
    setFeedback(null);
    setBusyAction(true);
    try {
      const res = await fetch("/api/admin/prizes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prize.id }),
      });
      const json = (await res.json()) as AdminRouletteState & { error?: string };
      if (!res.ok) {
        setFeedback({ type: "err", text: json.error || "Erro ao excluir item." });
        return;
      }
      setData(json);
      setFeedback({ type: "ok", text: `Item "${prize.name}" excluído.` });
    } finally {
      setBusyAction(false);
    }
  };

  const handleUpdateSettings = async (patch: {
    eventTitle?: string;
    allowMultipleSpinsPerCpf?: boolean;
    isActive?: boolean;
  }) => {
    setFeedback(null);
    setBusyAction(true);
    try {
      const res = await fetch("/api/admin/data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as AdminRouletteState & { error?: string };
      if (!res.ok) {
        setFeedback({ type: "err", text: json.error || "Erro ao salvar configurações." });
        return;
      }
      setData(json);
      setEventTitle(json.settings.eventTitle);
      setFeedback({ type: "ok", text: "Configurações atualizadas." });
    } finally {
      setBusyAction(false);
    }
  };

  const handleConfirmReset = async () => {
    setBusyAction(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", clearHistory: resetClearHistory }),
      });
      const json = (await res.json()) as AdminRouletteState & { error?: string };
      if (!res.ok) {
        setFeedback({ type: "err", text: json.error || "Erro ao resetar roleta." });
        return;
      }
      setData(json);
      await closeTopLayerDialog(confirmDialogRef.current);
      setConfirmOpen(false);
      setFeedback({
        type: "ok",
        text: resetClearHistory
          ? "Todos os itens foram restaurados e o histórico foi limpo."
          : "Todos os itens voltaram para a roleta (histórico preservado).",
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleExportCsv = () => {
    if (!data) return;
    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const header = ["Participante", "CPF", "Item Ganho", "Categoria", "Data/Hora"];
    const rows = data.winners.map((w) => [
      escapeCsv(w.participantName),
      escapeCsv(w.formattedCpf),
      escapeCsv(w.prizeName),
      escapeCsv(w.prizeCategory),
      escapeCsv(new Date(w.spunAt).toLocaleString("pt-BR")),
    ]);
    const csv = "\uFEFF" + [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ganhadores-biomedicina-ucpel-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!authenticated) {
    return (
      <main id="conteudo-principal" tabIndex={-1} className="flex-1 mx-auto w-full max-w-md px-4 py-14">
        <div className="biomed-panel p-6 sm:p-8">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand-plum)]">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Área Restrita
          </p>
          <h1 className="mt-1.5 font-editorial text-3xl font-bold text-[var(--text-primary)]">
            Painel da Coordenação
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Gerencie itens da roleta, restaure brindes e exporte ganhadores.
          </p>

          {!authConfigured && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--error-ink)]/35 bg-[var(--error-bg)] p-4 text-sm font-semibold text-[var(--error-ink)]"
            >
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                A variável <code className="font-mono">ADMIN_PASSWORD</code> não está
                configurada. Defina-a no <code className="font-mono">.env.local</code> ou
                nas variáveis de ambiente da Vercel para liberar o painel.
              </span>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <input
              type="text"
              name="username"
              autoComplete="username"
              defaultValue="coordenacao-biomedicina"
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              className="visually-hidden"
            />
            <div>
              <label
                htmlFor={passwordId}
                className="block text-sm font-semibold text-[var(--text-primary)]"
              >
                Senha administrativa
              </label>
              <span
                id={passwordHintId}
                className="mt-0.5 mb-1.5 block text-xs text-[var(--text-secondary)]"
              >
                Definida na variável ADMIN_PASSWORD.
              </span>
              <div className="relative">
                <input
                  id={passwordId}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  aria-describedby={passwordHintId}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="roleta-input pr-12"
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {loginError && (
              <p role="alert" className="text-sm font-semibold text-[var(--error-ink)]">
                ❌ {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loggingIn || !authConfigured}
              className="roleta-btn w-full min-h-[48px] rounded-full bg-[var(--brand-btn)] px-5 py-3 text-sm font-bold text-[var(--brand-btn-ink)] transition hover:bg-[var(--brand-btn-hover)] disabled:opacity-50 cursor-pointer"
            >
              {loggingIn ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const availableCount = data?.prizes.filter((p) => p.isAvailable).length ?? 0;

  return (
    <main id="conteudo-principal" tabIndex={-1} className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">
            {mode === "supabase"
              ? "Banco conectado ao Supabase"
              : "Modo demonstração local — configure o Supabase para persistir dados"}
          </p>
          <h1 className="mt-1 font-editorial text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
            Painel da Roleta
          </h1>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex min-h-[40px] items-center gap-2 self-start rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-primary)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Sair
        </button>
      </div>

      {feedback && (
        <div
          role={feedback.type === "err" ? "alert" : "status"}
          className={`flex items-center gap-2.5 rounded-2xl border p-4 text-sm font-semibold ${
            feedback.type === "err"
              ? "border-[var(--error-ink)]/35 bg-[var(--error-bg)] text-[var(--error-ink)]"
              : "border-[var(--brand-primary)]/35 bg-[var(--success-bg)] text-[var(--success-ink)]"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Resumo minimalista */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="biomed-panel p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Disponíveis
            </p>
            <p className="mt-1.5 font-mono text-3xl font-bold text-[var(--brand-primary)]">
              {availableCount}
            </p>
          </div>
          <div className="biomed-panel p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Cadastrados
            </p>
            <p className="mt-1.5 font-mono text-3xl font-bold text-[var(--text-primary)]">
              {data.prizes.length}
            </p>
          </div>
          <div className="biomed-panel p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Giros
            </p>
            <p className="mt-1.5 font-mono text-3xl font-bold text-[var(--brand-plum)]">
              {data.winners.length}
            </p>
          </div>
          <div className="biomed-panel p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              CPFs únicos
            </p>
            <p className="mt-1.5 font-mono text-3xl font-bold text-[var(--text-primary)]">
              {data.totalParticipants}
            </p>
          </div>
        </div>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-12">
          <section aria-labelledby="add-prize-heading" className="lg:col-span-7 biomed-panel p-6">
            <h2 id="add-prize-heading" className="font-editorial text-2xl font-bold text-[var(--text-primary)]">
              Cadastrar novo item
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Cada unidade vira uma fatia que sai automaticamente da roleta quando sorteada.
            </p>

            <form onSubmit={handleAddPrize} className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor={prizeNameId} className="block text-sm font-semibold">
                  Nome do item <span className="text-[var(--error-ink)]">*</span>
                </label>
                <input
                  id={prizeNameId}
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Ex.: Jaleco Biomedicina UCPel"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="roleta-input mt-1"
                />
              </div>

              <div>
                <label htmlFor={prizeCatId} className="block text-sm font-semibold">
                  Categoria
                </label>
                <select
                  id={prizeCatId}
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="roleta-input mt-1"
                >
                  {PRIZE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={prizeQtyId} className="block text-sm font-semibold">
                  Quantidade (1–20)
                </label>
                <input
                  id={prizeQtyId}
                  type="number"
                  min={1}
                  max={20}
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(Number(e.target.value) || 1)}
                  className="roleta-input mt-1 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor={prizeDescId} className="block text-sm font-semibold">
                  Descrição (opcional)
                </label>
                <input
                  id={prizeDescId}
                  type="text"
                  maxLength={220}
                  placeholder="Detalhes exibidos quando o participante ganhar"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="roleta-input mt-1"
                />
              </div>

              <div className="sm:col-span-2">
                <span className="block text-sm font-semibold mb-2">
                  Cor da fatia (Paleta @biomedicina_ucpel)
                </span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {BIOMED_SLICE_PALETTE.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setNewColor(hex)}
                      aria-label={`Selecionar cor ${hex}`}
                      aria-pressed={newColor === hex}
                      className={`h-8 w-8 rounded-full border transition cursor-pointer ${
                        newColor === hex
                          ? "scale-110 border-[var(--text-primary)] ring-2 ring-[var(--brand-primary)]"
                          : "border-[var(--border-hairline)] opacity-85 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 pt-1">
                <button
                  type="submit"
                  disabled={busyAction}
                  className="roleta-btn inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[var(--brand-btn)] px-6 py-2.5 text-sm font-bold text-[var(--brand-btn-ink)] transition hover:bg-[var(--brand-btn-hover)] disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Adicionar na roleta
                </button>
              </div>
            </form>
          </section>

          <section aria-labelledby="settings-heading" className="lg:col-span-5 biomed-panel p-6 space-y-5">
            <h2 id="settings-heading" className="font-editorial text-2xl font-bold text-[var(--text-primary)]">
              Regras e rodada
            </h2>

            <div>
              <label htmlFor={titleInputId} className="block text-sm font-semibold">
                Título exibido na roleta
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id={titleInputId}
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="roleta-input"
                />
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => void handleUpdateSettings({ eventTitle })}
                  className="shrink-0 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-soft)] px-4 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--brand-primary)] cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </div>

            <div className="space-y-3 border-t border-[var(--border-hairline)] pt-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.settings.isActive}
                  disabled={busyAction}
                  onChange={(e) => void handleUpdateSettings({ isActive: e.target.checked })}
                  className="mt-1 h-4 w-4"
                />
                <span className="text-sm">
                  <strong className="block text-[var(--text-primary)]">Roleta ativa</strong>
                  <span className="text-xs text-[var(--text-secondary)]">
                    Desmarque para pausar novos giros.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.settings.allowMultipleSpinsPerCpf}
                  disabled={busyAction}
                  onChange={(e) =>
                    void handleUpdateSettings({
                      allowMultipleSpinsPerCpf: e.target.checked,
                    })
                  }
                  className="mt-1 h-4 w-4"
                />
                <span className="text-sm">
                  <strong className="block text-[var(--text-primary)]">
                    Permitir múltiplos giros por CPF
                  </strong>
                  <span className="text-xs text-[var(--text-secondary)]">
                    Padrão: 1 giro por CPF.
                  </span>
                </span>
              </label>
            </div>

            <div className="border-t border-[var(--border-hairline)] pt-4 space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Reiniciar rodada
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => {
                    setResetClearHistory(false);
                    setConfirmOpen(true);
                  }}
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-soft)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--brand-primary)] cursor-pointer"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Restaurar itens (manter histórico)
                </button>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => {
                    setResetClearHistory(true);
                    setConfirmOpen(true);
                  }}
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-[var(--error-ink)]/35 bg-[var(--error-bg)] px-4 py-2 text-xs font-semibold text-[var(--error-ink)] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Restaurar itens e limpar histórico/CPFs
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {data && (
        <section aria-labelledby="admin-prizes-heading" className="biomed-panel p-6">
          <h2 id="admin-prizes-heading" className="font-editorial text-2xl font-bold text-[var(--text-primary)] mb-4">
            Itens cadastrados ({data.prizes.length})
          </h2>

          <div
            tabIndex={0}
            role="region"
            aria-labelledby="admin-prizes-heading"
            className="table-wrapper"
          >
            <table
              data-table="admin-prizes"
              className="responsive-table"
              style={
                {
                  "--label-2": '"Categoria"',
                  "--label-3": '"Status"',
                  "--label-4": '"Ações"',
                } as React.CSSProperties
              }
            >
              <caption className="visually-hidden">
                Todos os itens cadastrados no banco de dados da roleta
              </caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.prizes.map((prize, idx) => (
                  <tr key={prize.id}>
                    <th scope="row">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full border border-[var(--border-hairline)]"
                          style={{ backgroundColor: resolveSliceColor(prize.color, idx) }}
                          aria-hidden="true"
                        />
                        <span>{prize.name}</span>
                      </div>
                    </th>
                    <td>{prize.category}</td>
                    <td>
                      {prize.isAvailable ? (
                        <span className="inline-flex rounded-full bg-[var(--success-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--success-ink)]">
                          Disponível
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-[var(--bg-surface-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                          Sorteado
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => void handleToggleAvailability(prize)}
                          className="rounded-full border border-[var(--border-hairline)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--brand-primary)] cursor-pointer"
                        >
                          {prize.isAvailable ? "Ocultar" : "Restaurar"}
                        </button>
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => void handleDeletePrize(prize)}
                          aria-label={`Excluir ${prize.name}`}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--error-ink)]/30 bg-[var(--error-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--error-ink)] cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data && (
        <section aria-labelledby="admin-winners-heading" className="biomed-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 id="admin-winners-heading" className="font-editorial text-2xl font-bold text-[var(--text-primary)]">
              Participantes e ganhadores ({data.winners.length})
            </h2>
            <button
              type="button"
              disabled={data.winners.length === 0}
              onClick={handleExportCsv}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-[var(--brand-plum)] px-4 py-1.5 text-xs font-bold text-white dark:text-[#101512] disabled:opacity-45 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Exportar CSV
            </button>
          </div>

          {data.winners.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Nenhum participante girou a roleta ainda.
            </p>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="admin-winners-heading"
              className="table-wrapper"
            >
              <table
                data-table="winners"
                className="responsive-table"
                style={
                  {
                    "--label-2": '"CPF"',
                    "--label-3": '"Item ganho"',
                    "--label-4": '"Data/Hora"',
                  } as React.CSSProperties
                }
              >
                <caption className="visually-hidden">
                  Registro administrativo completo de participantes com CPF e prêmio obtido
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Participante</th>
                    <th scope="col">CPF</th>
                    <th scope="col">Item ganho</th>
                    <th scope="col">Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {data.winners.map((w) => (
                    <tr key={w.spinId}>
                      <th scope="row">{w.participantName}</th>
                      <td className="font-mono text-xs sm:text-sm">{w.formattedCpf}</td>
                      <td className="font-semibold">{w.prizeName}</td>
                      <td className="font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {new Date(w.spunAt).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <dialog
        ref={confirmDialogRef}
        {...({ closedby: "any" } as Record<string, string>)}
        aria-labelledby={confirmTitleId}
        className="biomed-dialog"
      >
        <div className="p-6 space-y-4">
          <h2 id={confirmTitleId} className="font-editorial text-2xl font-bold text-[var(--text-primary)]">
            {resetClearHistory
              ? "Restaurar itens e apagar histórico?"
              : "Restaurar todos os itens na roleta?"}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {resetClearHistory
              ? "Todos os prêmios voltarão à roleta e todos os registros de giros e CPFs serão removidos."
              : "Todos os prêmios voltarão a aparecer como disponíveis na roleta, mantendo o histórico anterior."}
          </p>
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button
              type="button"
              autoFocus
              onClick={() => {
                void closeTopLayerDialog(confirmDialogRef.current).then(() =>
                  setConfirmOpen(false)
                );
              }}
              className="min-h-[42px] rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-soft)] px-5 py-2 text-xs font-bold text-[var(--text-primary)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busyAction}
              onClick={() => void handleConfirmReset()}
              className="min-h-[42px] rounded-full bg-[var(--error-ink)] px-5 py-2 text-xs font-bold text-white dark:text-[#101512] cursor-pointer"
            >
              Confirmar
            </button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
