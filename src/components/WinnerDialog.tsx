"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { bindDialogFallbacks, closeTopLayerDialog } from "@/lib/dialog-helpers";
import type { Prize, PublicWinner } from "@/lib/types";

interface WinnerDialogProps {
  open: boolean;
  prize: Prize | null;
  winner: PublicWinner | null;
  onClose: () => void;
}

export function WinnerDialog({ open, prize, winner, onClose }: WinnerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const cleanupFallbacks = bindDialogFallbacks(dialog, () => {
      onCloseRef.current();
    });

    const handleNativeClose = () => {
      dialog.returnValue = "";
      onCloseRef.current();
    };

    dialog.addEventListener("close", handleNativeClose);
    return () => {
      cleanupFallbacks();
      dialog.removeEventListener("close", handleNativeClose);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && prize) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      void closeTopLayerDialog(dialog);
    }
  }, [open, prize]);

  const handleCloseClick = () => {
    void closeTopLayerDialog(dialogRef.current).then(() => {
      onCloseRef.current();
    });
  };

  const firstName = winner?.participantName?.split(" ")[0];

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as Record<string, string>)}
      aria-labelledby={titleId}
      className="biomed-dialog"
    >
      <div className="p-7 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-medium text-[var(--brand-primary)]">
            {firstName ? `Parabéns, ${firstName}` : "Parabéns"}
          </p>

          <button
            type="button"
            onClick={handleCloseClick}
            aria-label="Fechar janela do prêmio"
            className="-mr-2 -mt-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {prize && (
          <div className="mt-2">
            <h2
              id={titleId}
              className="font-editorial text-3xl sm:text-4xl font-bold text-[var(--text-primary)] leading-tight"
            >
              {prize.name}
            </h2>
            {prize.description && (
              <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                {prize.description}
              </p>
            )}
          </div>
        )}

        <hr className="my-6 border-0 border-t border-[var(--border-hairline)]" />

        {winner && (
          <p className="text-sm text-[var(--text-primary)]">
            <span className="font-medium">{winner.participantName}</span>
            <span className="mx-2 text-[var(--text-secondary)]">·</span>
            <span className="font-mono text-xs text-[var(--text-secondary)]">
              {winner.maskedCpf}
            </span>
          </p>
        )}

        <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
          Item removido da roleta. Apresente seu CPF à equipe de Biomedicina UCPel para retirar.
        </p>

        <div className="mt-7 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={handleCloseClick}
            className="roleta-btn inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center rounded-full bg-[var(--brand-btn)] px-7 py-2.5 text-sm font-bold text-[var(--brand-btn-ink)] transition hover:bg-[var(--brand-btn-hover)] cursor-pointer"
          >
            Continuar
          </button>
        </div>
      </div>
    </dialog>
  );
}
