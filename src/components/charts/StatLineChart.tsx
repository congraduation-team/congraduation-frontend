type LinePoint = {
  label: string
  value: number
}

type StatLineChartProps = {
  items: LinePoint[]
  height?: number
  className?: string
}

function formatCount(n: number) {
  return n.toLocaleString('ko-KR')
}

/** 기간별 방문자 꺾은선 (의존성 없이 SVG) */
export function StatLineChart({ items, height = 220, className = '' }: StatLineChartProps) {
  const max = Math.max(...items.map((i) => i.value), 1)
  const pad = { top: 24, right: 8, bottom: 24, left: 44 }
  const width = 640
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const yTicks = 4

  const points = items.map((item, index) => {
    const x =
      items.length <= 1
        ? pad.left + innerW / 2
        : pad.left + (innerW * index) / (items.length - 1)
    const y = pad.top + innerH - (item.value / max) * innerH
    return { ...item, x, y }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const last = points[points.length - 1]
  const first = points[0]
  const areaPath =
    first && last
      ? `${linePath} L ${last.x.toFixed(1)} ${pad.top + innerH} L ${first.x.toFixed(1)} ${pad.top + innerH} Z`
      : ''

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-auto w-full ${className}`.trim()}
      role="img"
      aria-label="최근 6개월 로그인 방문자 꺾은선 차트"
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
      {areaPath && <path d={areaPath} fill="#c8012e" fillOpacity={0.08} />}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke="#c8012e"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {points.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r={5} fill="#c8012e" />
          <circle cx={p.x} cy={p.y} r={2.2} fill="white" />
          <text
            x={p.x}
            y={p.y - 14}
            textAnchor="middle"
            className="fill-ink text-[14px] font-bold"
          >
            {formatCount(p.value)}
          </text>
          <text
            x={p.x}
            y={height - 6}
            textAnchor="middle"
            className="fill-ink-muted text-[14px] font-semibold"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
