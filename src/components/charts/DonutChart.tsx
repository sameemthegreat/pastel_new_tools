"use client";

import { formatCompact } from "@/lib/format";

/**
 * Donut chart — pure inline SVG using stroke-dasharray segments on a circle,
 * with a compact-formatted total in the center and a legend alongside.
 * Deterministic, zero dependencies; empty/all-zero data renders a muted
 * track ring with a "No data" caption (never NaN).
 */

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function DonutChart({
  data,
  size = 180,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);
  const strokeWidth = Math.max(12, Math.round(size * 0.11));
  const center = size / 2;
  const radius = (size - strokeWidth) / 2 - 1;
  const circumference = 2 * Math.PI * radius;

  type Segment = {
    key: string;
    color: string;
    label: string;
    value: number;
    dash: number;
    offset: number;
  };

  const segments: Segment[] = [];
  let cumulative = 0;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    if (d.value <= 0 || total <= 0) continue;
    const fraction = d.value / total;
    segments.push({
      key: `${d.label}-${i}`,
      color: d.color,
      label: d.label,
      value: d.value,
      dash: round(fraction * circumference),
      offset: round(-cumulative * circumference),
    });
    cumulative += fraction;
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-6">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        role="img"
        aria-label="Donut chart"
      >
        <g transform={`rotate(-90 ${center} ${center})`}>
          {/* Track ring (visible when there is no data) */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-tile)"
            strokeWidth={strokeWidth}
          />
          {segments.map((s) => (
            <circle
              key={s.key}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${s.dash} ${round(circumference)}`}
              strokeDashoffset={s.offset}
            >
              <title>{`${s.label}: ${formatCompact(s.value)}`}</title>
            </circle>
          ))}
        </g>

        {/* Center total */}
        <text
          x={center}
          y={center + size * 0.02}
          textAnchor="middle"
          fontSize={round(size * 0.15)}
          fontWeight={600}
          className="fill-ink tabular-nums"
        >
          {formatCompact(total)}
        </text>
        <text
          x={center}
          y={center + size * 0.13}
          textAnchor="middle"
          fontSize={round(size * 0.062)}
          className="fill-ink-muted"
        >
          {total > 0 ? "Total" : "No data"}
        </text>
      </svg>

      {/* Legend */}
      {data.length > 0 && (
        <div className="flex min-w-[150px] flex-1 flex-col gap-2">
          {data.map((d, i) => {
            const pct =
              total > 0
                ? Math.round((Math.max(0, d.value) / total) * 100)
                : 0;
            return (
              <div
                key={`${d.label}-${i}`}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                <span className="truncate text-ink-secondary" title={d.label}>
                  {d.label}
                </span>
                <span className="ml-auto font-medium tabular-nums text-ink">
                  {formatCompact(d.value)}
                </span>
                <span className="w-8 text-right tabular-nums text-ink-muted">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
