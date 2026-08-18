type BarItem = {
  label: string
  value: number
  color: string
}

type StatBarChartProps = {
  items: BarItem[]
  height?: number
  orientation?: 'horizontal' | 'vertical'
}

function formatCount(n: number) {
  return n.toLocaleString('ko-KR')
}

/** 막대 비교 차트 (의존성 없이 SVG) */
export function StatBarChart({
  items,
  height = 200,
  orientation = 'horizontal',
}: StatBarChartProps) {
  if (orientation === 'vertical') {
    return <VerticalBars items={items} height={height} />
  }
  return <HorizontalBars items={items} height={height} />
}

function HorizontalBars({ items, height }: { items: BarItem[]; height: number }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  const pad = { top: 8, right: 56, bottom: 8, left: 64 }
  const width = 560
  const innerH = height - pad.top - pad.bottom
  const barGap = 12
  const barH = Math.max(16, (innerH - barGap * (items.length - 1)) / items.length)

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

function VerticalBars({ items, height }: { items: BarItem[]; height: number }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  const pad = { top: 28, right: 20, bottom: 36, left: 20 }
  const width = 560
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const colGap = 28
  const colW = Math.max(36, (innerW - colGap * (items.length - 1)) / items.length)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="방문자 비교 세로 막대 차트"
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
              className="fill-ink-muted text-[12px] font-bold"
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
              y={height - 12}
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
