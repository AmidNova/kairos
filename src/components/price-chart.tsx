"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { niceTicks } from "@/lib/chart";
import { formatAxisPrice, formatDateTime, formatPrice } from "@/lib/format";
import type { History } from "@/hooks/use-scan";

const HEIGHT = 240;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 64 };
const Y_TICK_TARGET = 4;
// En dessous, trois dates ne tiennent pas sur l'axe X sans se chevaucher
const MIN_WIDTH_FOR_MID_LABEL = 420;

interface PriceChartProps {
  history: History;
  /** Prix cible saisi dans le formulaire d'alerte : ligne + « buy zone ». */
  target?: number | null;
}

export function PriceChart({ history, target = null }: PriceChartProps) {
  const { points, source } = history;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const prices = points.map((p) => p.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  // La cible fait partie du domaine pour rester visible même loin du prix
  const domainLow = target !== null ? Math.min(low, target) : low;
  const domainHigh = target !== null ? Math.max(high, target) : high;
  const ticks = niceTicks(domainLow, domainHigh, Y_TICK_TARGET);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const last = points.length - 1;
  const x = (i: number) => MARGIN.left + (last === 0 ? innerW / 2 : (i / last) * innerW);
  const y = (v: number) => MARGIN.top + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join("");
  const area = `${line}L${x(last).toFixed(1)},${MARGIN.top + innerH}L${x(0).toFixed(1)},${MARGIN.top + innerH}Z`;
  const xLabelIdx = [
    ...new Set(innerW >= MIN_WIDTH_FOR_MID_LABEL ? [0, Math.round(last / 2), last] : [0, last]),
  ];

  const indexFromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left - MARGIN.left) / (innerW || 1);
    return Math.min(last, Math.max(0, Math.round(ratio * last)));
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: (active ?? last) - 1,
      ArrowRight: (active ?? last) + 1,
      Home: 0,
      End: last,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    setActive(Math.min(last, Math.max(0, moves[e.key])));
  };

  const activePoint = active !== null ? points[active] : null;
  const tooltipLeft = active !== null ? Math.min(Math.max(x(active), 80), width - 80) : 0;

  return (
    <section className="glass animate-rise rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl leading-none">Price history</h2>
            {source === "live" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" aria-hidden />
                Live
              </span>
            ) : (
              <span
                className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted"
                title="No recorded checks yet. This curve is illustrative until the daily job records real prices."
              >
                Simulated
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {source === "live"
              ? `${points.length} recorded checks`
              : "Illustrative curve — real checks appear once an alert is armed"}
          </p>
        </div>

        <dl className="tabular flex gap-6 text-sm">
          <div>
            <dt className="text-xs text-text-subtle">Low</dt>
            <dd className="font-medium">{formatPrice(low)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-subtle">High</dt>
            <dd className="font-medium">{formatPrice(high)}</dd>
          </div>
        </dl>
      </div>

      <div ref={wrapRef} className="relative mt-4">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Price history, ${points.length} points, from ${formatPrice(low)} to ${formatPrice(high)}. Use arrow keys to inspect values.`}
            tabIndex={0}
            className="block touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onPointerMove={(e) => setActive(indexFromPointer(e))}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(last)}
            onBlur={() => setActive(null)}
            onKeyDown={onKeyDown}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.14" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <text
                  x={MARGIN.left - 10}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="tabular fill-text-subtle text-[11px]"
                >
                  {formatAxisPrice(t)}
                </text>
              </g>
            ))}

            {xLabelIdx.map((i) => (
              <text
                key={i}
                x={x(i)}
                y={HEIGHT - 6}
                textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
                className="fill-text-subtle text-[11px]"
              >
                {formatDateTime(points[i].checked_at)}
              </text>
            ))}

            {target !== null && (
              <g>
                <rect
                  x={MARGIN.left}
                  y={y(target)}
                  width={innerW}
                  height={Math.max(0, MARGIN.top + innerH - y(target))}
                  fill="var(--zone)"
                />
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(target)}
                  y2={y(target)}
                  stroke="var(--success)"
                  strokeOpacity={0.7}
                  strokeWidth={1}
                />
              </g>
            )}

            <path d={area} fill={`url(#${gradientId})`} className="animate-rise" />
            <path
              key={points.length}
              d={line}
              pathLength={1}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="animate-draw"
            />

            {active === null && (
              <circle cx={x(last)} cy={y(points[last].price)} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
            )}

            {active !== null && (
              <g pointerEvents="none">
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={MARGIN.top}
                  y2={MARGIN.top + innerH}
                  stroke="var(--border-strong)"
                  strokeWidth={1}
                />
                <circle
                  cx={x(active)}
                  cy={y(points[active].price)}
                  r={5}
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              </g>
            )}
          </svg>
        )}

        {activePoint && active !== null && (
          <div
            className="glass glass-strong pointer-events-none absolute -translate-x-1/2 rounded-xl px-3 py-2 text-xs"
            style={{ left: tooltipLeft, top: Math.max(0, y(activePoint.price) - 64) }}
            aria-hidden
          >
            <div className="tabular text-sm font-semibold">{formatPrice(activePoint.price)}</div>
            <div className="mt-0.5 text-text-subtle">{formatDateTime(activePoint.checked_at)}</div>
          </div>
        )}
        {target !== null && width > 0 && (
          <span
            className="tabular pointer-events-none absolute rounded-md bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success"
            style={{ top: y(target) + 6, left: MARGIN.left + 8 }}
          >
            Buy zone ≤ {formatPrice(target)}
          </span>
        )}
        {width === 0 && <div style={{ height: HEIGHT }} />}
      </div>

      <table className="sr-only">
        <caption>Price history{source === "simulated" ? " (simulated)" : ""}</caption>
        <thead>
          <tr>
            <th scope="col">Checked at</th>
            <th scope="col">Price</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.checked_at}>
              <td>{formatDateTime(p.checked_at)}</td>
              <td>{formatPrice(p.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
