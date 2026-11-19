/**
 * Paleta inspirada diretamente no @biomedicina_ucpel (Instagram oficial):
 * Verdes botânicos/floresta + sálvia/menta dos destaques + lilás/ameixa da Biomedicina Estética + marfim.
 */

export const BIOMED_SLICE_PALETTE = [
  "#205937", // Verde Floresta Profundo
  "#C9DCD1", // Verde Sálvia / Menta Pálido (Destaques @biomedicina_ucpel)
  "#725387", // Ameixa Suave (Biomedicina Estética)
  "#F4F4EE", // Marfim Editorial
  "#4D8742", // Verde Folha Botânico
  "#DECBE9", // Lilás Pastel
  "#1E2721", // Pinho Escuro
  "#7BA943", // Verde Oliva (Logo @biomedicina_ucpel)
] as const;

export const PRIZE_CATEGORIES = [
  "Vestuário",
  "Laboratório",
  "Estética",
  "Acadêmico",
  "Institucional",
  "Acessório",
  "Experiência",
  "Brinde",
] as const;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Escolhe automaticamente cor de texto com maior contraste WCAG sobre o fundo da fatia.
 */
export function getContrastTextColor(hexColor: string): "#FFFFFF" | "#1E2721" {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return "#FFFFFF";
  const bgLum = relativeLuminance(rgb);
  const whiteContrast = (1.0 + 0.05) / (bgLum + 0.05);
  const darkLum = relativeLuminance({ r: 30, g: 39, b: 33 }); // #1E2721
  const darkContrast = (bgLum + 0.05) / (darkLum + 0.05);
  return whiteContrast >= darkContrast ? "#FFFFFF" : "#1E2721";
}

export function resolveSliceColor(color: string | null | undefined, index: number): string {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }
  return BIOMED_SLICE_PALETTE[index % BIOMED_SLICE_PALETTE.length];
}
