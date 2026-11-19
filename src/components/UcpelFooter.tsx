export function UcpelFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border-hairline)] py-6 text-xs text-[var(--text-secondary)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
        <p>
          <span className="font-semibold text-[var(--text-primary)]">Biomedicina UCPel</span> ·
          Conhecimento · Conexão · Experiências · Pelotas/RS
        </p>
        <a
          href="https://www.instagram.com/biomedicina_ucpel/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[var(--brand-primary)] underline decoration-[var(--border-hairline)] underline-offset-4 hover:decoration-current"
        >
          @biomedicina_ucpel ↗
        </a>
      </div>
    </footer>
  );
}
