"use client";

import { formatCompact } from "@/lib/format";

/**
 * Responsive multi-series line chart — pure inline SVG, zero dependencies.
 *
 * The plot itself is an SVG stretched with `preserveAspectRatio="none"` and
 * non-scaling strokes; axis labels live in HTML so text never distorts.
 * Smooth Catmull-Rom curves per series, 4 hairline gridlines with value
 * labels, a subtle area fill under the first series, and legend chips.
 */

const SERIES_COLORS = [
  "var(--color-brand-500)",
  "var(--color-forest)",
  "var(--color-gold)",
  "var(--color-star)",
  "var(--color-ink-muted)",
  "var(--color-success-500)",
] as const;

const TICK_COUNT = 3; // 3 intervals -> 4 gridlines
const MAX_X_LABELS = 6;

type Point = { x: number; y: number };

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Smallest "nice" step (1/1.5/2/2.5/3/4/5/6/8 x 10^k) covering `raw`. */
function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const mantissas = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const mantissa = mantissas.find((m) => normalized <= m) ?? 10;
  return mantissa * magnitude;
}

/** Catmull-Rom -> cubic Bezier path through every point. */
function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    // Single point: draw a flat line across the plot at that level.
    const y = round(points[0].y);
    return `M 0 ${y} L 100 ${y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const c1x = round(p1.x + (p2.x - p0.x) / 6);
    const c1y = round(clamp(p1.y + (p2.y - p0.y) / 6, 0, 100));
    const c2x = round(p2.x - (p3.x - p1.x) / 6);
    const c2y = round(clamp(p2.y - (p3.y - p1.y) / 6, 0, 100));
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export function LineChart({
  series,
  labels,
  height = 220,
  formatValue,
}: {
  series: { name: string; data: number[]; color?: string }[];
  labels: string[];
  height?: number;
  formatValue?: (n: number) => string;
}) {
  const fmt = formatValue ?? formatCompact;
  const hasData =
    labels.length > 0 && series.some((s) => s.data.length > 0);

  if (!hasData) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-lg bg-tile/40 text-sm text-ink-muted"
        style={{ height }}
      >
        No data to display
      </div>
    );
  }

  const maxValue = Math.max(0, ...series.flatMap((s) => s.data));
  const step = niceStep(maxValue / TICK_COUNT);
  const top = step * TICK_COUNT;
  // Gridline values, top -> bottom.
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
    (TICK_COUNT - i) * step,
  );

  const n = labels.length;
  const xAt = (i: number) => (n > 1 ? round((i / (n - 1)) * 100) : 50);
  const yAt = (value: number) =>
    round(100 - (clamp(value, 0, top) / top) * 100);

  const plotted = series.map((s, si) => {
    const points: Point[] = s.data
      .slice(0, n)
      .map((value, i) => ({ x: xAt(i), y: yAt(value) }));
    return {
      name: s.name,
      color: s.color ?? SERIES_COLORS[si % SERIES_COLORS.length],
      points,
      path: smoothPath(points),
    };
  });

  const first = plotted[0];
  const areaPath =
    first && first.points.length > 1
      ? `${first.path} L ${first.points[first.points.length - 1].x} 100 L ${first.points[0].x} 100 Z`
      : "";

  const labelStep = Math.max(1, Math.ceil(n / MAX_X_LABELS));

  return (
    <div className="w-full">
      {/* Legend chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {plotted.map((s) => (
          <span
            key={s.name}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-medium text-ink-secondary"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.name}
          </span>
        ))}
      </div>

      <div className="flex w-full" style={{ height }}>
        {/* Y-axis value labels (HTML so they never distort) */}
        <div className="relative w-10 shrink-0">
          {ticks.map((value, i) => (
            <span
              key={i}
              className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-ink-muted"
              style={{ top: `${(i / TICK_COUNT) * 100}%` }}
            >
              {fmt(value)}
            </span>
          ))}
        </div>

        {/* Plot */}
        <div className="relative flex-1">
          <svg
            className="absolute inset-0 h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label="Line chart"
          >
            {/* Hairline gridlines */}
            {ticks.map((_, i) => {
              const y = round((i / TICK_COUNT) * 100);
              return (
                <line
                  key={i}
                  x1={0}
                  x2={100}
                  y1={y}
                  y2={y}
                  stroke="var(--color-hairline)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {/* Subtle area fill under the first series */}
            {areaPath && (
              <path d={areaPath} fill={first.color} fillOpacity={0.06} />
            )}

            {/* Series lines */}
            {plotted.map(
              (s) =>
                s.path && (
                  <path
                    key={s.name}
                    d={s.path}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ),
            )}
          </svg>
        </div>
      </div>

      {/* X-axis labels, thinned to ~6 */}
      <div className="relative ml-10 mt-2 h-4">
        {labels.map((label, i) => {
          if (i % labelStep !== 0) return null;
          const translate =
            i === 0
              ? "translate-x-0"
              : i === n - 1
                ? "-translate-x-full"
                : "-translate-x-1/2";
          return (
            <span
              key={`${label}-${i}`}
              className={`absolute whitespace-nowrap text-[10px] text-ink-muted ${translate}`}
              style={{ left: `${xAt(i)}%` }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
