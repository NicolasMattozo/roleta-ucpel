"use client";

import { useId, useRef, useState } from "react";
import type { Prize, PublicWinner } from "@/lib/types";

interface PrizesAndWinnersProps {
  availablePrizes: Prize[];
  recentWinners: PublicWinner[];
  isRefreshing: boolean;
  isSpinning: boolean;
  onRefresh: () => void;
}

function formatDateTimePtBr(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function PrizesAndWinners({
  availablePrizes,
  recentWinners,
  isRefreshing,
  isSpinning,
  onRefresh,
}: PrizesAndWinnersProps) {
  const [activeTab, setActiveTab] = useState<"prizes" | "winners">("prizes");
  const prizesTabRef = useRef<HTMLButtonElement | null>(null);
  const winnersTabRef = useRef<HTMLButtonElement | null>(null);

  const prizesTabId = useId();
  const winnersTabId = useId();
  const winnersCaptionId = useId();

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key === "ArrowRight" ||
      event.key === "ArrowLeft" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? "prizes"
          : event.key === "End"
            ? "winners"
            : activeTab === "prizes"
              ? "winners"
              : "prizes";
      setActiveTab(next);
      if (next === "prizes") {
        prizesTabRef.current?.focus();
      } else {
        winnersTabRef.current?.focus();
      }
    }
  };

  return (
    <section
      aria-label="Itens da roleta e ganhadores"
      className="mt-14 border-t border-[var(--border-hairline)] pt-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-hairline)]">
        <div
          role="tablist"
          aria-label="Visualizar itens ou ganhadores"
          {...({ focusgroup: "tablist nomemory" } as Record<string, string>)}
          className="biomed-tablist"
        >
          <button
            ref={prizesTabRef}
            type="button"
            role="tab"
            id={prizesTabId}
            aria-selected={activeTab === "prizes"}
            tabIndex={activeTab === "prizes" ? 0 : -1}
            onClick={() => setActiveTab("prizes")}
            onKeyDown={handleTabKeyDown}
            className="biomed-tab"
          >
            Itens na roleta ({availablePrizes.length})
          </button>
          <button
            ref={winnersTabRef}
            type="button"
            role="tab"
            id={winnersTabId}
            aria-selected={activeTab === "winners"}
            tabIndex={activeTab === "winners" ? 0 : -1}
            onClick={() => setActiveTab("winners")}
            onKeyDown={handleTabKeyDown}
            className="biomed-tab"
          >
            Ganhadores ({recentWinners.length})
          </button>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isSpinning || isRefreshing}
          className="text-xs font-medium text-[var(--text-secondary)] underline decoration-[var(--border-hairline)] underline-offset-4 transition hover:text-[var(--text-primary)] hover:decoration-current disabled:opacity-50 cursor-pointer py-2"
        >
          {isRefreshing ? "Atualizando…" : "Atualizar lista"}
        </button>
      </div>

      {/* Painel 1: Índice tipográfico direto sobre o fundo, sem caixas ou bolinhas */}
      <div
        role="tabpanel"
        aria-labelledby={prizesTabId}
        tabIndex={activeTab === "prizes" ? 0 : undefined}
        hidden={activeTab !== "prizes"}
      >
        <div className="pt-6">
          {availablePrizes.length === 0 ? (
            <p className="py-6 text-sm text-[var(--text-secondary)]">
              Todos os itens desta rodada já foram sorteados.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
              {availablePrizes.map((prize) => (
                <li key={prize.id} className="space-y-0.5">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {prize.name}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">{prize.category}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Painel 2: Tabela responsiva limpa diretamente sobre a superfície */}
      <div
        role="tabpanel"
        aria-labelledby={winnersTabId}
        tabIndex={activeTab === "winners" && recentWinners.length === 0 ? 0 : undefined}
        hidden={activeTab !== "winners"}
      >
        <div className="pt-4">
          {recentWinners.length === 0 ? (
            <p className="py-6 text-sm text-[var(--text-secondary)]">
              Nenhum giro registrado ainda.
            </p>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby={winnersCaptionId}
              className="table-wrapper table-plain"
            >
              <table
                data-table="winners"
                className="responsive-table"
                style={
                  {
                    "--label-2": '"CPF"',
                    "--label-3": '"Item"',
                    "--label-4": '"Horário"',
                  } as React.CSSProperties
                }
              >
                <caption id={winnersCaptionId} className="visually-hidden">
                  Lista dos últimos ganhadores da Roleta Biomedicina UCPel
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Participante</th>
                    <th scope="col">CPF</th>
                    <th scope="col">Item</th>
                    <th scope="col">Horário</th>
                  </tr>
                </thead>
                <tbody>
                  {recentWinners.map((winner) => (
                    <tr key={winner.spinId}>
                      <th scope="row">{winner.participantName}</th>
                      <td className="font-mono text-xs sm:text-sm text-[var(--text-secondary)]">
                        {winner.maskedCpf}
                      </td>
                      <td className="font-medium text-[var(--text-primary)]">
                        {winner.prizeName}
                      </td>
                      <td className="font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {formatDateTimePtBr(winner.spunAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
