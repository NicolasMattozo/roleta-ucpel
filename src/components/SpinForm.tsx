"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, Disc3, Lock } from "lucide-react";
import { formatCPF, isValidCPF, normalizeFullName } from "@/lib/cpf";

const subscribeNoop = () => () => {};
const getClientSupportsUserInvalid = () =>
  typeof CSS !== "undefined" ? CSS.supports("selector(:user-invalid)") : true;
const getServerSupportsUserInvalid = () => true;

interface SpinFormProps {
  availableCount: number;
  isActive: boolean;
  allowMultipleSpinsPerCpf: boolean;
  isSpinning: boolean;
  resetSignal: number;
  serverError: string | null;
  onClearServerError: () => void;
  onSubmitSpin: (payload: { fullName: string; cpf: string }) => Promise<void>;
}

export function SpinForm({
  availableCount,
  isActive,
  allowMultipleSpinsPerCpf,
  isSpinning,
  resetSignal,
  serverError,
  onClearServerError,
  onSubmitSpin,
}: SpinFormProps) {
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");

  const [nameTouched, setNameTouched] = useState(false);
  const [cpfTouched, setCpfTouched] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const supportsUserInvalid = useSyncExternalStore(
    subscribeNoop,
    getClientSupportsUserInvalid,
    getServerSupportsUserInvalid
  );

  const formRef = useRef<HTMLFormElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const cpfInputRef = useRef<HTMLInputElement | null>(null);
  const announceTimerRef = useRef<number | null>(null);

  const formHeadingId = useId();
  const nameId = useId();
  const nameHintId = useId();
  const nameErrorId = useId();
  const cpfId = useId();
  const cpfHintId = useId();
  const cpfErrorId = useId();

  useEffect(() => {
    return () => {
      if (announceTimerRef.current) {
        window.clearTimeout(announceTimerRef.current);
      }
    };
  }, []);

  // Limpa formulário após o participante ganhar e fechar o modal (uso contínuo em estande)
  useEffect(() => {
    if (resetSignal === 0) return;
    const frameId = window.requestAnimationFrame(() => {
      setFullName("");
      setCpf("");
      setNameTouched(false);
      setCpfTouched(false);
      setNameError(null);
      setCpfError(null);
      setLiveAnnouncement("");
      nameInputRef.current?.setCustomValidity("");
      cpfInputRef.current?.setCustomValidity("");
      formRef.current?.reset();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [resetSignal]);

  const scheduleAnnouncement = (message: string) => {
    if (announceTimerRef.current) {
      window.clearTimeout(announceTimerRef.current);
    }
    setLiveAnnouncement("");
    announceTimerRef.current = window.setTimeout(() => {
      setLiveAnnouncement(message);
    }, 500);
  };

  const clearAnnouncement = () => {
    if (announceTimerRef.current) {
      window.clearTimeout(announceTimerRef.current);
      announceTimerRef.current = null;
    }
    setLiveAnnouncement("");
  };

  const validateNameValue = (value: string): string | null => {
    const clean = normalizeFullName(value);
    if (clean.length === 0) {
      return "Informe seu nome completo para girar a roleta.";
    }
    if (clean.length < 3) {
      return "Digite pelo menos 3 caracteres no campo Nome completo.";
    }
    if (clean.length > 120) {
      return "O nome pode ter no máximo 120 caracteres.";
    }
    return null;
  };

  const validateCpfValue = (value: string): string | null => {
    if (!value.trim()) {
      return "Informe seu CPF no formato 000.000.000-00.";
    }
    if (!isValidCPF(value)) {
      return "CPF inválido. Verifique os 11 dígitos e tente novamente.";
    }
    return null;
  };

  const handleNameChange = (value: string) => {
    setFullName(value);
    onClearServerError();
    const err = validateNameValue(value);
    nameInputRef.current?.setCustomValidity(err ?? "");

    if (!err) {
      setNameError(null);
      clearAnnouncement();
    } else if (nameTouched) {
      setNameError(err);
    }
  };

  const handleNameBlur = () => {
    if (!fullName && !nameTouched) return;
    setNameTouched(true);
    const err = validateNameValue(fullName);
    nameInputRef.current?.setCustomValidity(err ?? "");
    setNameError(err);
    if (err) {
      scheduleAnnouncement(`Nome completo: ${err}`);
    }
  };

  const handleCpfChange = (rawValue: string) => {
    const formatted = formatCPF(rawValue);
    setCpf(formatted);
    onClearServerError();
    const err = validateCpfValue(formatted);
    cpfInputRef.current?.setCustomValidity(err ?? "");

    if (!err) {
      setCpfError(null);
      clearAnnouncement();
    } else if (cpfTouched) {
      setCpfError(err);
    }
  };

  const handleCpfBlur = () => {
    if (!cpf && !cpfTouched) return;
    setCpfTouched(true);
    const err = validateCpfValue(cpf);
    cpfInputRef.current?.setCustomValidity(err ?? "");
    setCpfError(err);
    if (err) {
      scheduleAnnouncement(`CPF: ${err}`);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSpinning || availableCount === 0 || !isActive) return;

    setNameTouched(true);
    setCpfTouched(true);

    const nextNameErr = validateNameValue(fullName);
    const nextCpfErr = validateCpfValue(cpf);

    nameInputRef.current?.setCustomValidity(nextNameErr ?? "");
    cpfInputRef.current?.setCustomValidity(nextCpfErr ?? "");

    setNameError(nextNameErr);
    setCpfError(nextCpfErr);

    if (nextNameErr) {
      nameInputRef.current?.focus();
      return;
    }
    if (nextCpfErr) {
      cpfInputRef.current?.focus();
      return;
    }

    clearAnnouncement();
    await onSubmitSpin({
      fullName: normalizeFullName(fullName),
      cpf,
    });
  };

  const blockedByInventory = availableCount === 0 || !isActive;

  return (
    <section aria-labelledby={formHeadingId} className="biomed-panel p-6 sm:p-8">
      <h2
        id={formHeadingId}
        className="font-editorial text-2xl sm:text-3xl font-bold text-[var(--text-primary)]"
      >
        Identifique-se para girar
      </h2>
      <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
        {allowMultipleSpinsPerCpf
          ? "Seu nome e CPF ficam registrados junto ao item sorteado."
          : "1 giro por CPF. O item ganho é removido da roleta automaticamente."}
      </p>

      <div aria-live="polite" className="visually-hidden">
        {liveAnnouncement}
      </div>

      <form
        ref={formRef}
        method="POST"
        noValidate
        aria-labelledby={formHeadingId}
        onSubmit={handleSubmit}
        className="mt-6 space-y-5"
      >
        <div>
          <label
            htmlFor={nameId}
            className="block text-sm font-semibold text-[var(--text-primary)]"
          >
            Nome completo <span aria-hidden="true" className="text-[var(--error-ink)]">*</span>
          </label>
          <span
            id={nameHintId}
            className="mt-0.5 mb-1.5 block text-xs text-[var(--text-secondary)]"
          >
            Ex.: Maria Clara da Silva
          </span>
          <input
            ref={nameInputRef}
            id={nameId}
            name="fullName"
            type="text"
            required
            minLength={3}
            maxLength={120}
            autoComplete="name"
            enterKeyHint="next"
            value={fullName}
            disabled={isSpinning}
            aria-invalid={nameError ? "true" : "false"}
            aria-describedby={nameError ? `${nameHintId} ${nameErrorId}` : nameHintId}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={handleNameBlur}
            className={`roleta-input ${
              !supportsUserInvalid && nameTouched
                ? nameError
                  ? "user-invalid-fallback"
                  : "user-valid-fallback"
                : ""
            }`}
          />
          {nameError && (
            <div id={nameErrorId} className="error-msg flex items-start gap-1.5">
              <span role="img" aria-label="Erro">
                ❌
              </span>
              <span>{nameError}</span>
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor={cpfId}
            className="block text-sm font-semibold text-[var(--text-primary)]"
          >
            CPF <span aria-hidden="true" className="text-[var(--error-ink)]">*</span>
          </label>
          <span
            id={cpfHintId}
            className="mt-0.5 mb-1.5 block text-xs text-[var(--text-secondary)]"
          >
            Formato: 000.000.000-00
          </span>
          <input
            ref={cpfInputRef}
            id={cpfId}
            name="cpf"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="done"
            required
            maxLength={14}
            pattern="\d{3}\.\d{3}\.\d{3}-\d{2}"
            value={cpf}
            disabled={isSpinning}
            aria-invalid={cpfError ? "true" : "false"}
            aria-describedby={cpfError ? `${cpfHintId} ${cpfErrorId}` : cpfHintId}
            onChange={(e) => handleCpfChange(e.target.value)}
            onBlur={handleCpfBlur}
            className={`roleta-input font-mono ${
              !supportsUserInvalid && cpfTouched
                ? cpfError
                  ? "user-invalid-fallback"
                  : "user-valid-fallback"
                : ""
            }`}
          />
          {cpfError && (
            <div id={cpfErrorId} className="error-msg flex items-start gap-1.5">
              <span role="img" aria-label="Erro">
                ❌
              </span>
              <span>{cpfError}</span>
            </div>
          )}
        </div>

        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-[var(--error-ink)]/35 bg-[var(--error-bg)] p-3.5 text-sm font-semibold text-[var(--error-ink)]"
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{serverError}</span>
          </div>
        )}

        {!isActive && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-soft)] p-3.5 text-sm font-semibold text-[var(--text-primary)]"
          >
            <Lock className="h-5 w-5 shrink-0 mt-0.5 text-[var(--brand-plum)]" aria-hidden="true" />
            <span>A roleta está temporariamente pausada pela coordenação.</span>
          </div>
        )}

        {isActive && availableCount === 0 && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-soft)] p-3.5 text-sm font-semibold text-[var(--text-primary)]"
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-[var(--brand-plum)]" aria-hidden="true" />
            <span>Todos os itens desta rodada já foram sorteados.</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSpinning || blockedByInventory}
          className="roleta-btn flex w-full min-h-[50px] items-center justify-center gap-2 rounded-full bg-[var(--brand-btn)] px-6 py-3 text-sm sm:text-base font-bold text-[var(--brand-btn-ink)] transition hover:bg-[var(--brand-btn-hover)] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          <Disc3
            className={`h-5 w-5 ${isSpinning ? "motion-safe:animate-spin" : ""}`}
            aria-hidden="true"
          />
          {isSpinning
            ? "Girando a roleta…"
            : availableCount === 0
              ? "Sem itens disponíveis"
              : !isActive
                ? "Roleta pausada"
                : "Girar a Roleta"}
        </button>

        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
          Seus dados ficam protegidos no banco de dados e o CPF aparece mascarado na lista
          pública de ganhadores.
        </p>
      </form>
    </section>
  );
}
