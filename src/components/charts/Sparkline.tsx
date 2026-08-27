"use client";

/**
 * Tiny inline-SVG trend line for stat cards and table cells.
 * Fixed size, deterministic — no axes, no labels, no dependencies.
 * Empty or single-value data renders as a flat line (never NaN).
 */

const PAD = 2;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function Sparkline({
  data,
  width = 96,
  height = 28,
  stroke = "var(--color-brand-500)",
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  const innerWidth = width - PAD * 2;
  const innerHeight = height - PAD * 2;

  let points: string;

  if (data.length <= 1) {
    // Empty -> flat midline; single value -> flat line at that level (mid, since
    // a lone value has no range to scale against).
    const y = round(height / 2);
    points = `${PAD},${y} ${width - PAD},${y}`;
  } else {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    const stepX = innerWidth / (data.length - 1);

    points = data
      .map((value, i) => {
        const x = PAD + i * stepX;
        // All-equal (incl. all-zero) series -> flat line through the middle.
        const t = range > 0 ? (value - min) / range : 0.5;
        const y = PAD + (1 - t) * innerHeight;
        return `${round(x)},${round(y)}`;
      })
      .join(" ");
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
      role="img"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
