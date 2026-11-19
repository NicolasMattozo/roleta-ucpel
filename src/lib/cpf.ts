/**
 * Utilitários de normalização, máscara, formatação e validação oficial de CPF.
 */

export function cleanCPF(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function formatCPF(value: string): string {
  const digits = cleanCPF(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function maskCPF(value: string): string {
  const digits = cleanCPF(value);
  if (digits.length !== 11) return "***.***.***-**";
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export function isValidCPF(value: string): boolean {
  const cpf = cleanCPF(value);
  if (cpf.length !== 11) return false;

  // Rejeita sequências de dígitos repetidos (ex.: 00000000000, 11111111111)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(cpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(cpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(cpf[10])) return false;

  return true;
}

export function normalizeFullName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
