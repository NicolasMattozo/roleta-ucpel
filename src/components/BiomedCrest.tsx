interface BiomedCrestProps {
  className?: string;
  decorative?: boolean;
}

/**
 * Escudo minimalista com silhueta de microscópio inspirado no avatar oficial de @biomedicina_ucpel.
 */
export function BiomedCrest({ className = "h-8 w-8", decorative = false }: BiomedCrestProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": "Emblema Biomedicina UCPel" })}
    >
      <path
        d="M16 14 H48 V33 C48 45 32 54 32 54 C32 54 16 45 16 33 V20 A6 6 0 0 1 22 14 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <g
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M26 22 L35 31" />
        <path d="M24 24 L28 20" />
        <path d="M35 25 A8 8 0 0 1 31 40" />
        <path d="M25 37 L34 37" />
        <path d="M22 43 L40 43" />
      </g>
    </svg>
  );
}
