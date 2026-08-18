type BarItem = {
  label: string
  value: number
  color: string
}

type StatBarChartProps = {
  items: BarItem[]
  height?: number
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

function formatCount(n: number) {
  return n.toLocaleString('ko-KR')
}

/** 막대 비교 차트 (의존성 없이 SVG) */
export function StatBarChart({
  items,
  height = 360,
  orientation = 'horizontal',
  className = '',
}: StatBarChartProps) {
  if (orientation === 'vertical') {
    return <VerticalBars items={items} height={height} className={className} />
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

function VerticalBars({
  items,
  height,
  className,
}: {
  items: BarItem[]
  height: number
  className: string
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  const pad = { top: 36, right: 12, bottom: 28, left: 52 }
  const width = 640
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const yTicks = 4
  const colGap = 36
  const colW = Math.min(56, Math.max(36, (innerW - colGap * (items.length - 1)) / items.length))
  const groupW = items.length * colW + Math.max(0, items.length - 1) * colGap
  const startX = pad.left + (innerW - groupW) / 2

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMax meet"
      className={`h-full w-full ${className}`.trim()}
      role="img"
      aria-label="로그인 방문자 지표 비교 막대 차트"
    >
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const ratio = i / yTicks
        const y = pad.top + innerH * (1 - ratio)
        const tick = Math.round(max * ratio)
        return (
          <g key={i}>
            <line
              x1={pad.left}
              y1={y}
              x2={width - pad.right}
              y2={y}
              stroke="#eef0f3"
              strokeWidth={1}
            />
            <text
              x={pad.left - 10}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-ink-faint text-[13px] font-medium"
            >
              {formatCount(tick)}
            </text>
          </g>
        )
      })}
      {items.map((item, index) => {
        const x = startX + index * (colW + colGap)
        const barH = (innerH * item.value) / max
        const y = pad.top + innerH - barH
        return (
          <g key={item.label}>
            <text
              x={x + colW / 2}
              y={y - 12}
              textAnchor="middle"
              className="fill-ink text-[14px] font-bold"
            >
              {formatCount(item.value)}
            </text>
            <rect
              x={x}
              y={y}
              width={colW}
              height={Math.max(barH, item.value > 0 ? 4 : 0)}
              rx={6}
              fill={item.color}
            />
            <text
              x={x + colW / 2}
              y={height - 6}
              textAnchor="middle"
              className="fill-ink-muted text-[14px] font-semibold"
            >
              {item.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
