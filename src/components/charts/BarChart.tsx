"use client";

import { formatCompact } from "@/lib/format";

/**
 * Bar chart — pure inline SVG, zero dependencies, deterministic.
 *
 * Vertical (default): responsive via viewBox + width 100%, rounded-top bars
 * (rx=3), category labels thinned when crowded, value shown on hover via
 * a native `<title>` tooltip. All-zero data renders a flat baseline.
 *
 * Horizontal: one row per datum — label left, track + bar middle, value right.
 */

const VIEW_WIDTH = 640;
const PAD_X = 6;
const PAD_TOP = 8;
const LABEL_AREA = 22;
const MAX_BAR_WIDTH = 48;
const MAX_X_LABELS = 8;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function BarChart({
  data,
  height = 220,
  color = "var(--color-brand-500)",
  formatValue,
  horizontal,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatValue?: (n: number) => string;
  horizontal?: boolean;
}) {
  const fmt = formatValue ?? formatCompact;

  if (data.length === 0) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-lg bg-tile/40 text-sm text-ink-muted"
        style={{ height: horizontal ? undefined : height, minHeight: 64 }}
      >
        No data to display
      </div>
    );
  }

  const max = Math.max(0, ...data.map((d) => d.value));
  const denom = max > 0 ? max : 1;

  if (horizontal) {
    return (
      <div className="flex w-full flex-col gap-3">
        {data.map((d, i) => {
          const pct = round((Math.max(0, d.value) / denom) * 100);
          return (
            <div
              key={`${d.label}-${i}`}
              className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3"
            >
              <span
                className="truncate text-xs text-ink-secondary"
                title={d.label}
              >
                {d.label}
              </span>
              <svg className="h-2.5 w-full" role="img" aria-label={`${d.label}: ${fmt(d.value)}`}>
                <title>{`${d.label}: ${fmt(d.value)}`}</title>
                <rect
                  x={0}
                  y={0}
                  width="100%"
                  height="100%"
                  rx={3}
                  fill="var(--color-tile)"
                />
                {pct > 0 && (
                  <rect
                    x={0}
                    y={0}
                    width={`${pct}%`}
                    height="100%"
                    rx={3}
                    fill={color}
                    className="transition-opacity hover:opacity-75"
                  />
                )}
              </svg>
              <span className="text-xs font-medium tabular-nums text-ink">
                {fmt(d.value)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  const plotHeight = height - PAD_TOP - LABEL_AREA;
  const baselineY = PAD_TOP + plotHeight;
  const slot = (VIEW_WIDTH - PAD_X * 2) / data.length;
  const barWidth = round(Math.min(slot * 0.62, MAX_BAR_WIDTH));
  const labelStep = Math.max(1, Math.ceil(data.length / MAX_X_LABELS));

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Bar chart"
    >
      {/* Baseline */}
      <line
        x1={PAD_X}
        x2={VIEW_WIDTH - PAD_X}
        y1={baselineY}
        y2={baselineY}
        stroke="var(--color-hairline)"
        strokeWidth={1}
      />

      {data.map((d, i) => {
        const x = round(PAD_X + i * slot + (slot - barWidth) / 2);
        const barHeight = round((Math.max(0, d.value) / denom) * plotHeight);
        const y = round(baselineY - barHeight);
        const labelX = round(PAD_X + i * slot + slot / 2);
        return (
          <g key={`${d.label}-${i}`}>
            <title>{`${d.label}: ${fmt(d.value)}`}</title>
            {barHeight > 0 && (
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                fill={color}
                className="transition-opacity hover:opacity-75"
              />
            )}
            {i % labelStep === 0 && (
              <text
                x={labelX}
                y={height - 6}
                textAnchor="middle"
                fontSize={11}
                className="fill-ink-muted"
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
