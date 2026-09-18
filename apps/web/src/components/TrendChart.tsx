"use client";

import { useMemo, useState } from "react";
import type { TrendPoint } from "@/lib/trend-data";

/**
 * A single-series line-over-time chart, built as plain inline SVG (no
 * charting library exists anywhere in this repo yet, and one series
 * doesn't warrant adding one). Follows the project's `dataviz` skill:
 * a true linear time axis (not evenly-spaced categories — real gaps
 * between sessions are a real signal, not noise to hide), a 2px line
 * with an end marker + direct end-label (skill: "lines -> value at the
 * end"), one hairline reference gridline at the midpoint, a hover/focus
 * crosshair+tooltip, and a "View as table" toggle as the WCAG-clean
 * equivalent of the chart (skill: "a table view exists"). No legend box
 * — a single series needs none; the title already names what's plotted.
 */

const VIEW_W = 300;
const VIEW_H = 120;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;
const PLOT_W = VIEW_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM;

export function TrendChart({
  title,
  points,
  color,
  min,
  max,
  formatValue,
  formatDate,
  testId,
}: {
  title: string;
  points: TrendPoint[];
  /** A CSS color value, e.g. "var(--color-wm)". */
  color: string;
  min: number;
  max: number;
  formatValue: (value: number) => string;
  formatDate?: (iso: string) => string;
  testId: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [tableVisible, setTableVisible] = useState(false);

  const dateFmt = formatDate ?? ((iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }));

  const { positions, yMin, yMax } = useMemo(() => {
    const times = points.map((p) => new Date(p.date).getTime());
    const firstMs = times[0];
    const lastMs = times[times.length - 1];
    const timeRange = lastMs - firstMs;

    // Real values can sit outside the task's own nominal min/max (e.g. a
    // reading WPM well above the ladder's default range), so the axis
    // floor/ceiling always includes the real data, never clips it.
    const valueMin = Math.min(min, ...points.map((p) => p.value));
    const valueMax = Math.max(max, ...points.map((p) => p.value));
    const valueRange = valueMax - valueMin || 1;

    const positions = points.map((p, i) => {
      const t = new Date(p.date).getTime();
      const xFrac = timeRange > 0 ? (t - firstMs) / timeRange : points.length > 1 ? i / (points.length - 1) : 0.5;
      const yFrac = (p.value - valueMin) / valueRange;
      return {
        x: PAD_LEFT + xFrac * PLOT_W,
        y: PAD_TOP + (1 - yFrac) * PLOT_H,
        point: p,
      };
    });
    return { positions, yMin: valueMin, yMax: valueMax };
  }, [points, min, max]);

  const linePath = positions.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const midValue = (yMin + yMax) / 2;
  const midY = PAD_TOP + PLOT_H / 2;
  const last = positions[positions.length - 1];

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm" data-testid={testId}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12.5px] font-bold text-text">{title}</div>
        <button
          type="button"
          onClick={() => setTableVisible((v) => !v)}
          className="text-[11px] font-semibold text-text-3 underline decoration-dotted"
          data-testid={`${testId}-table-toggle`}
        >
          {tableVisible ? "Hide table" : "View as table"}
        </button>
      </div>

      {!tableVisible ? (
        <div className="relative">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="w-full"
            role="img"
            aria-label={`${title}: from ${formatValue(points[0].value)} on ${dateFmt(points[0].date)} to ${formatValue(
              points[points.length - 1].value
            )} on ${dateFmt(points[points.length - 1].date)}`}
          >
            {/* Recessive reference gridline at the midpoint value only — see marks-and-anatomy.md's "gridlines carry the values you didn't directly label" */}
            <line
              x1={PAD_LEFT}
              y1={midY}
              x2={VIEW_W - PAD_RIGHT}
              y2={midY}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text x={VIEW_W - PAD_RIGHT} y={midY - 3} textAnchor="end" className="fill-text-3" fontSize={8}>
              {formatValue(Math.round(midValue))}
            </text>

            <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

            {/* One hit target per point (>=24px logical hit area via the invisible circle) for hover/keyboard focus, per interaction.md */}
            {positions.map((p, i) => (
              <g key={p.point.date}>
                {i === positions.length - 1 && (
                  <circle cx={p.x} cy={p.y} r={4} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={10}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${dateFmt(p.point.date)}: ${formatValue(p.point.value)}`}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered((h) => (h === i ? null : h))}
                />
              </g>
            ))}

            {hovered !== null && (
              <line
                x1={positions[hovered].x}
                y1={PAD_TOP}
                x2={positions[hovered].x}
                y2={PAD_TOP + PLOT_H}
                stroke="var(--color-text-3)"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
            )}

            {/* Direct end-label — "lines -> value at the end" */}
            <text x={last.x} y={last.y - 8} textAnchor="end" className="fill-text" fontSize={9} fontWeight={700}>
              {formatValue(last.point.value)}
            </text>
          </svg>

          {hovered !== null && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 rounded-md bg-text px-2 py-1 text-[10px] font-semibold text-surface shadow-md"
              style={{
                left: `${(positions[hovered].x / VIEW_W) * 100}%`,
                top: 0,
              }}
              data-testid={`${testId}-tooltip`}
            >
              {dateFmt(positions[hovered].point.date)} · {formatValue(positions[hovered].point.value)}
            </div>
          )}

          <div className="mt-1 flex justify-between text-[10px] text-text-3">
            <span>{dateFmt(points[0].date)}</span>
            <span>{dateFmt(points[points.length - 1].date)}</span>
          </div>
        </div>
      ) : (
        <table className="w-full text-left text-[11px]" data-testid={`${testId}-table`}>
          <thead>
            <tr className="text-text-3">
              <th className="pb-1 font-semibold">Date</th>
              <th className="pb-1 font-semibold">Value</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date} className="border-t border-border">
                <td className="py-1 text-text-2">{dateFmt(p.date)}</td>
                <td className="py-1 font-num text-text">{formatValue(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
