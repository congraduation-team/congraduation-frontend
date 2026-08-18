type ColumnItem = {
  label: string
  value: number
  color: string
}

type StatColumnChartProps = {
  items: ColumnItem[]
  height?: number
}

function formatCount(n: number) {
  return n.toLocaleString('ko-KR')
}

/** 세로 막대 차트 (기간별 방문자 비교) */
export function StatColumnChart({ items, height = 240 }: StatColumnChartProps) {
  const max = Math.max(...items.map((i) => i.value), 1)
  const pad = { top: 28, right: 16, bottom: 40, left: 16 }
  const width = 360
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const colGap = 24
  const colW = Math.max(48, (innerW - colGap * (items.length - 1)) / items.length)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mx-auto h-auto w-full max-w-sm"
      role="img"
      aria-label="기간별 로그인 방문자 막대 차트"
    >
      {items.map((item, index) => {
        const x = pad.left + index * (colW + colGap)
        const barH = (innerH * item.value) / max
        const y = pad.top + innerH - barH
        return (
          <g key={item.label}>
            <text
              x={x + colW / 2}
              y={pad.top - 10}
              textAnchor="middle"
              className="fill-ink-muted text-[11px] font-bold"
            >
              {formatCount(item.value)}
            </text>
            <rect
              x={x}
              y={y}
              width={colW}
              height={Math.max(barH, item.value > 0 ? 4 : 0)}
              rx={8}
              fill={item.color}
              className="transition-all duration-700"
            />
            <text
              x={x + colW / 2}
              y={height - pad.bottom + 22}
              textAnchor="middle"
              className="fill-ink text-[12px] font-semibold"
            >
              {item.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
