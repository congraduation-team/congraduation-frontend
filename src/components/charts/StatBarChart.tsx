type BarItem = {
  label: string
  value: number
  color: string
}

type StatBarChartProps = {
  items: BarItem[]
  height?: number
}

function formatCount(n: number) {
  return n.toLocaleString('ko-KR')
}

/** 가로 막대 비교 차트 (의존성 없이 SVG) */
export function StatBarChart({ items, height = 160 }: StatBarChartProps) {
  const max = Math.max(...items.map((i) => i.value), 1)
  const pad = { top: 4, right: 48, bottom: 4, left: 52 }
  const width = 280
  const innerH = height - pad.top - pad.bottom
  const barGap = 10
  const barH = Math.max(14, (innerH - barGap * (items.length - 1)) / items.length)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="방문자 비교 막대 차트"
    >
      {items.map((item, index) => {
        const y = pad.top + index * (barH + barGap)
        const barW = ((width - pad.left - pad.right) * item.value) / max
        return (
          <g key={item.label}>
            <text
              x={pad.left - 12}
              y={y + barH / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-ink text-[12px] font-semibold"
            >
              {item.label}
            </text>
            <rect
              x={pad.left}
              y={y}
              width={Math.max(barW, item.value > 0 ? 4 : 0)}
              height={barH}
              rx={6}
              fill={item.color}
              className="transition-all duration-700"
            />
            <text
              x={pad.left + Math.max(barW, 0) + 8}
              y={y + barH / 2}
              dominantBaseline="middle"
              className="fill-ink-muted text-[12px] font-bold"
            >
              {formatCount(item.value)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
