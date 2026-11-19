"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PrizesAndWinners } from "@/components/PrizesAndWinners";
import { RouletteWheel } from "@/components/RouletteWheel";
import { SpinForm } from "@/components/SpinForm";
import { WinnerDialog } from "@/components/WinnerDialog";
import type {
  Prize,
  PublicRouletteState,
  PublicWinner,
  SpinSuccessResponse,
} from "@/lib/types";

interface RouletteArenaProps {
  initialState: PublicRouletteState;
}

const SPIN_DURATION_MS = 4600;

export function RouletteArena({ initialState }: RouletteArenaProps) {
  const [state, setState] = useState<PublicRouletteState>(initialState);
  const [wheelPrizes, setWheelPrizes] = useState<Prize[]>(initialState.availablePrizes);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [serverError, setServerError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [wonRecord, setWonRecord] = useState<PublicWinner | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [resetSignal, setResetSignal] = useState(0);

  const pendingResultRef = useRef<SpinSuccessResponse | null>(null);
  const isSpinningRef = useRef(false);

  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);

  const refreshState = useCallback(async (showSpinner = false) => {
    if (isSpinningRef.current) return;
    if (showSpinner) setIsRefreshing(true);
    try {
      const res = await fetch("/api/roulette", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as PublicRouletteState;
      if (!isSpinningRef.current) {
        setState(next);
        setWheelPrizes(next.availablePrizes);
      }
    } catch {
      // Silencioso em falhas transitórias de polling
    } finally {
      if (showSpinner) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !isSpinningRef.current && !dialogOpen) {
        void refreshState(false);
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [dialogOpen, refreshState]);

  const handleSpinSubmit = async ({ fullName, cpf }: { fullName: string; cpf: string }) => {
    setServerError(null);

    try {
      const response = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, cpf }),
      });

      const payload = (await response.json()) as
        | SpinSuccessResponse
        | { error?: string; code?: string };

      if (!response.ok) {
        const errPayload = payload as { error?: string; code?: string };
        setServerError(
          errPayload.error || "Não foi possível girar a roleta. Tente novamente."
        );
        if (
          errPayload.code === "NO_PRIZES_AVAILABLE" ||
          errPayload.code === "ROULETTE_INACTIVE"
        ) {
          void refreshState(false);
        }
        return;
      }

      const result = payload as SpinSuccessResponse;
      const preSlices =
        result.preSpinPrizes.length > 0 ? result.preSpinPrizes : [result.prize];
      const winningIndex = Math.max(
        0,
        preSlices.findIndex((p) => p.id === result.prize.id)
      );

      const sliceAngle = 360 / preSlices.length;
      const centerDeg = (winningIndex + 0.5) * sliceAngle;
      const jitter = preSlices.length > 1 ? (Math.random() - 0.5) * (sliceAngle * 0.46) : 0;
      const targetMod = (360 - ((centerDeg + jitter) % 360) + 360) % 360;
      const currentMod = ((rotationDeg % 360) + 360) % 360;
      const delta = (targetMod - currentMod + 360) % 360;
      const nextRotation = rotationDeg + 6 * 360 + delta;

      pendingResultRef.current = result;
      setWheelPrizes(preSlices);
      setStatusMessage("Girando a roleta de Biomedicina UCPel...");

      window.requestAnimationFrame(() => {
        setIsSpinning(true);
        setRotationDeg(nextRotation);
      });
    } catch {
      setServerError("Erro de conexão ao registrar seu giro. Verifique sua internet.");
    }
  };

  const handleSpinComplete = useCallback(() => {
    const result = pendingResultRef.current;
    pendingResultRef.current = null;
    setIsSpinning(false);

    if (!result) return;

    setState(result.state);
    setWheelPrizes(result.state.availablePrizes);
    setWonPrize(result.prize);
    setWonRecord(result.spin);
    setDialogOpen(true);
    setStatusMessage(
      `Parabéns ${result.spin.participantName}! Você ganhou ${result.prize.name}. Este item foi removido da roleta.`
    );
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setResetSignal((n) => n + 1);
  }, []);

  return (
    <main
      id="conteudo-principal"
      tabIndex={-1}
      className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="mb-10">
        <h1 className="hero-title font-editorial font-bold text-[var(--text-primary)]">
          {state.settings.eventTitle}
        </h1>
        <p className="mt-2 max-w-[56ch] text-sm text-[var(--text-secondary)]">
          Informe seu nome e CPF para girar. Ao ganhar um item, ele fica registrado no seu
          CPF e sai da roleta.
        </p>
      </div>

      {/* Região acessível de status do giro */}
      <div aria-live="polite" className="visually-hidden">
        {statusMessage}
      </div>

      {/* Área principal limpa: Roleta + Formulário */}
      <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7 flex justify-center">
          <RouletteWheel
            prizes={wheelPrizes}
            rotationDeg={rotationDeg}
            isSpinning={isSpinning}
            spinDurationMs={SPIN_DURATION_MS}
            onSpinComplete={handleSpinComplete}
          />
        </div>

        <div className="lg:col-span-5">
          <SpinForm
            availableCount={state.availablePrizes.length}
            isActive={state.settings.isActive}
            allowMultipleSpinsPerCpf={state.settings.allowMultipleSpinsPerCpf}
            isSpinning={isSpinning}
            resetSignal={resetSignal}
            serverError={serverError}
            onClearServerError={() => setServerError(null)}
            onSubmitSpin={handleSpinSubmit}
          />
        </div>
      </div>

      <PrizesAndWinners
        availablePrizes={state.availablePrizes}
        recentWinners={state.recentWinners}
        isRefreshing={isRefreshing}
        isSpinning={isSpinning}
        onRefresh={() => void refreshState(true)}
      />

      <WinnerDialog
        open={dialogOpen}
        prize={wonPrize}
        winner={wonRecord}
        onClose={handleCloseDialog}
      />
    </main>
  );
}
