import React, { useState } from 'react';

/**
 * StatBarChart
 *
 * Horizontal bar chart for comparing one fantasy stat across drivers or
 * constructors. One bar per entry, sorted descending, colored by team.
 *
 * Follows the house bar-chart spec: <=24px thick bars with a 2px surface gap
 * between them, 4px rounded data-end (square at the baseline), value labeled
 * at the tip, hover tooltip for the exact figure. Color carries team identity
 * as a secondary cue — the name label (not color) is what the reader reads,
 * so this stays legible without relying on color alone.
 *
 * @param {Array<{ label: string, value: number, color: string, sublabel?: string }>} data
 * @param {(value: number) => string} [formatValue]
 */
const BAR_HEIGHT = 22;
const BAR_GAP = 2;
const ROW_HEIGHT = BAR_HEIGHT + BAR_GAP;
const LABEL_WIDTH = 140;
const CHART_WIDTH = 420;

const StatBarChart = ({ data, formatValue = (v) => String(v) }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data.length) {
    return <p className="text-sm text-gray-500 dark:text-f1-muted py-4">No data to chart.</p>;
  }

  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const svgHeight = data.length * ROW_HEIGHT;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${LABEL_WIDTH + CHART_WIDTH} ${svgHeight}`}
      role="img"
      aria-label="Bar chart"
      className="overflow-visible"
    >
      {data.map((d, i) => {
        const barWidth = Math.max(2, (Math.abs(d.value) / maxAbs) * (CHART_WIDTH - 48));
        const y = i * ROW_HEIGHT;
        const isHovered = hoveredIndex === i;

        return (
          <g
            // Index, not label — the feed can list the same name twice after
            // a mid-season team swap (old + new team both linger in a row).
            key={i}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{ cursor: 'default' }}
          >
            {/* Row name label — text token, never the team color, per spec */}
            <text
              x={LABEL_WIDTH - 8}
              y={y + BAR_HEIGHT / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-gray-700 dark:fill-f1-muted text-[11px] font-semibold"
            >
              {d.label}
            </text>

            {/* Bar: rounded data-end, square baseline, thin */}
            <rect
              x={LABEL_WIDTH}
              y={y}
              width={barWidth}
              height={BAR_HEIGHT}
              rx={4}
              fill={d.color}
              opacity={isHovered ? 1 : 0.9}
            />

            {/* Value at the tip */}
            <text
              x={LABEL_WIDTH + barWidth + 6}
              y={y + BAR_HEIGHT / 2}
              dominantBaseline="middle"
              className="fill-gray-900 dark:fill-white text-[11px] font-bold tabular-nums"
            >
              {formatValue(d.value)}
            </text>

            {/* Hover tooltip */}
            {isHovered && (
              <g>
                <rect
                  x={LABEL_WIDTH}
                  y={y - 22}
                  width={(d.sublabel || d.label).length * 6 + 16}
                  height={18}
                  rx={4}
                  className="fill-gray-900 dark:fill-black"
                />
                <text
                  x={LABEL_WIDTH + 8}
                  y={y - 13}
                  dominantBaseline="middle"
                  className="fill-white text-[10px] font-semibold"
                >
                  {d.sublabel || d.label}: {formatValue(d.value)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default StatBarChart;
