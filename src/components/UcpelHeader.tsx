import Link from "next/link";
import { BiomedCrest } from "@/components/BiomedCrest";

interface UcpelHeaderProps {
  currentPath?: "home" | "admin";
}

export function UcpelHeader({ currentPath = "home" }: UcpelHeaderProps) {
  return (
    <header className="w-full">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 border-b border-[var(--border-hairline)] px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-[var(--text-primary)] no-underline"
        >
          <BiomedCrest
            className="h-6 w-6 shrink-0 text-[#4D8742] dark:text-[#7EC498]"
            decorative
          />
          <span className="font-editorial text-xl font-bold tracking-tight">
            Biomedicina UCPel
          </span>
        </Link>

        <nav aria-label="Navegação principal">
          <ul className="flex items-center gap-6">
            <li>
              <Link
                href="/"
                aria-current={currentPath === "home" ? "page" : undefined}
                className="nav-link"
              >
                Roleta
              </Link>
            </li>
            <li>
              <Link
                href="/admin"
                aria-current={currentPath === "admin" ? "page" : undefined}
                className="nav-link"
              >
                Coordenação
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
