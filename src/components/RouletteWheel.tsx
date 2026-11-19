"use client";

import { useEffect, useRef } from "react";
import { getContrastTextColor, resolveSliceColor } from "@/lib/palette";
import type { Prize } from "@/lib/types";

interface RouletteWheelProps {
  prizes: Prize[];
  rotationDeg: number;
  isSpinning: boolean;
  spinDurationMs: number;
  onSpinComplete: () => void;
}

const CX = 260;
const CY = 260;
const OUTER_RING_R = 242;
const WHEEL_R = 224;
const HUB_R = 44;

function polarToCartesian(cx: number, cy: number, r: number, angleDegFromTop: number) {
  const rad = ((angleDegFromTop - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function createSlicePath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
): string {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArcFlag = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)} Z`;
}

function truncateSliceLabel(label: string, totalSlices: number): string {
  const maxLen = totalSlices <= 6 ? 22 : totalSlices <= 10 ? 18 : totalSlices <= 14 ? 14 : 11;
  const trimmed = label.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}

export function RouletteWheel({
  prizes,
  rotationDeg,
  isSpinning,
  spinDurationMs,
  onSpinComplete,
}: RouletteWheelProps) {
  const rotorRef = useRef<SVGGElement | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!isSpinning) {
      completedRef.current = false;
      return;
    }

    const finishOnce = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onSpinComplete();
    };

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      const reducedTimer = window.setTimeout(finishOnce, 220);
      return () => window.clearTimeout(reducedTimer);
    }

    const rotor = rotorRef.current;
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === rotor && event.propertyName === "transform") {
        finishOnce();
      }
    };

    rotor?.addEventListener("transitionend", onTransitionEnd);

    let rafId = 0;
    let quickTimer = 0;
    rafId = window.requestAnimationFrame(() => {
      if (rotor && rotor.getAnimations().length === 0) {
        quickTimer = window.setTimeout(finishOnce, 220);
      }
    });

    const safetyTimer = window.setTimeout(finishOnce, spinDurationMs + 350);

    return () => {
      rotor?.removeEventListener("transitionend", onTransitionEnd);
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(quickTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [isSpinning, rotationDeg, spinDurationMs, onSpinComplete]);

  const count = prizes.length;
  const sliceAngle = count > 0 ? 360 / count : 360;
  const fontSize = count <= 6 ? 13 : count <= 10 ? 11.25 : count <= 14 ? 9.75 : 8.5;
  const tickCount = 36;

  return (
    <div className="relative mx-auto flex w-full max-w-[440px] flex-col items-center select-none">
      {/* Ponteiro minimalista no topo (12h) */}
      <div
        className={`relative z-20 -mb-5 flex flex-col items-center ${
          isSpinning ? "roulette-pointer-spinning" : ""
        }`}
        aria-hidden="true"
      >
        <svg width="36" height="44" viewBox="0 0 36 44" className="drop-shadow-sm">
          <path
            d="M18 42 L5 14 A13 13 0 1 1 31 14 Z"
            fill="#1E2721"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="15" r="4.5" fill="#7BA943" />
        </svg>
      </div>

      <div className="relative w-full aspect-square">
        <svg
          viewBox="0 0 520 520"
          role="img"
          aria-label={
            count > 0
              ? `Roleta Biomedicina UCPel com ${count} ${
                  count === 1 ? "item disponível" : "itens disponíveis"
                }`
              : "Roleta Biomedicina UCPel vazia — todos os itens já foram sorteados"
          }
          className="h-full w-full overflow-visible drop-shadow-[0_18px_38px_rgba(30,39,33,0.12)]"
        >
          {/* Aro externo minimalista botânico */}
          <circle
            cx={CX}
            cy={CY}
            r={OUTER_RING_R}
            fill="#FFFFFF"
            stroke="#1E2721"
            strokeWidth="2.5"
          />

          {/* Marcações delicadas de escala no aro */}
          {Array.from({ length: tickCount }, (_, idx) => {
            const angle = (idx * 360) / tickCount;
            const inner = polarToCartesian(CX, CY, WHEEL_R + 4, angle);
            const outer = polarToCartesian(CX, CY, OUTER_RING_R - 6, angle);
            return (
              <line
                key={idx}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={idx % 3 === 0 ? "#205937" : "#C9DCD1"}
                strokeWidth={idx % 3 === 0 ? "2" : "1.2"}
                strokeLinecap="round"
              />
            );
          })}

          {/* Disco rotativo das fatias */}
          <g
            ref={rotorRef}
            className="roulette-rotor"
            style={
              {
                transform: `rotate(${rotationDeg}deg)`,
                "--spin-duration": `${spinDurationMs}ms`,
              } as React.CSSProperties
            }
          >
            {count === 0 ? (
              <g>
                <circle
                  cx={CX}
                  cy={CY}
                  r={WHEEL_R}
                  fill="#EBF2ED"
                  stroke="#C9DCD1"
                  strokeWidth="2"
                />
                <text
                  x={CX}
                  y={CY - 82}
                  textAnchor="middle"
                  fill="#1E2721"
                  fontSize="15"
                  fontWeight="700"
                >
                  TODOS OS ITENS SORTEADOS
                </text>
                <text
                  x={CX}
                  y={CY + 94}
                  textAnchor="middle"
                  fill="#4B5A50"
                  fontSize="13"
                  fontWeight="500"
                >
                  Aguarde reposição da coordenação
                </text>
              </g>
            ) : count === 1 ? (
              <g>
                {(() => {
                  const singlePrize = prizes[0];
                  const fill = resolveSliceColor(singlePrize.color, 0);
                  const ink = getContrastTextColor(fill);
                  return (
                    <>
                      <circle
                        cx={CX}
                        cy={CY}
                        r={WHEEL_R}
                        fill={fill}
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                      <text
                        x={CX}
                        y={CY - 110}
                        textAnchor="middle"
                        fill={ink}
                        fontSize="16"
                        fontWeight="700"
                      >
                        {truncateSliceLabel(singlePrize.name, 1)}
                      </text>
                      <text
                        x={CX}
                        y={CY + 118}
                        textAnchor="middle"
                        fill={ink}
                        fontSize="12"
                        fontWeight="600"
                        opacity="0.85"
                      >
                        Último item disponível
                      </text>
                    </>
                  );
                })()}
              </g>
            ) : (
              prizes.map((prize, index) => {
                const startDeg = index * sliceAngle;
                const endDeg = (index + 1) * sliceAngle;
                const midDeg = startDeg + sliceAngle / 2;
                const fill = resolveSliceColor(prize.color, index);
                const textInk = getContrastTextColor(fill);
                const displayText = truncateSliceLabel(prize.name, count);

                return (
                  <g key={prize.id}>
                    <path
                      d={createSlicePath(CX, CY, WHEEL_R, startDeg, endDeg)}
                      fill={fill}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <g transform={`rotate(${midDeg - 90} ${CX} ${CY})`}>
                      <text
                        x={CX + WHEEL_R - 18}
                        y={CY}
                        fill={textInk}
                        fontSize={fontSize}
                        fontWeight="700"
                        textAnchor="end"
                        dominantBaseline="central"
                        style={{ letterSpacing: "0.005em" }}
                      >
                        {displayText}
                      </text>
                    </g>
                  </g>
                );
              })
            )}
          </g>

          {/* Cubo central inspirado no avatar circular @biomedicina_ucpel */}
          <circle
            cx={CX}
            cy={CY}
            r={HUB_R}
            fill="#FFFFFF"
            stroke="#1E2721"
            strokeWidth="2"
          />
          <circle
            cx={CX}
            cy={CY}
            r={HUB_R - 5}
            fill="none"
            stroke="#C9DCD1"
            strokeWidth="1.5"
          />
          {/* Escudo + microscópio minimalista verde oliva */}
          <g transform={`translate(${CX - 22}, ${CY - 22}) scale(0.6875)`}>
            <path
              d="M16 14 H48 V33 C48 45 32 54 32 54 C32 54 16 45 16 33 V20 A6 6 0 0 1 22 14 Z"
              fill="none"
              stroke="#7BA943"
              strokeWidth="3.4"
              strokeLinejoin="round"
            />
            <g
              stroke="#4D8742"
              strokeWidth="3"
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
          </g>
        </svg>
      </div>
    </div>
  );
}
