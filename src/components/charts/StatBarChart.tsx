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

/** 막대 비교 차트 */
export function StatBarChart({
  items,
  height = 220,
  orientation = 'horizontal',
  className = '',
}: StatBarChartProps) {
  if (orientation === 'vertical') {
    return <VerticalBars items={items} className={className} />
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
      className="h-auto w-full overflow-visible"
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
              fill="#1a2b3c"
              fontFamily="Pretendard, sans-serif"
              fontSize={12}
              fontWeight={600}
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
            />
            <text
              x={pad.left + Math.max(barW, 0) + 8}
              y={y + barH / 2}
              dominantBaseline="middle"
              fill="#6b7280"
              fontFamily="Pretendard, sans-serif"
              fontSize={12}
              fontWeight={700}
            >
              {formatCount(item.value)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function VerticalBars({ items, className }: { items: BarItem[]; className: string }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  const yTicks = 4

  return (
    <div className={`flex h-full min-h-0 w-full gap-2 ${className}`.trim()} role="img" aria-label="로그인 방문자 지표 비교">
      <div className="flex w-8 shrink-0 flex-col justify-between pb-7 pt-7 text-right text-xs font-medium text-ink-faint">
        {Array.from({ length: yTicks + 1 }, (_, i) => (
          <span key={i} className="leading-none">
            {formatCount(Math.round((max * (yTicks - i)) / yTicks))}
          </span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-x-0 bottom-7 top-7 flex flex-col justify-between">
          {Array.from({ length: yTicks + 1 }, (_, i) => (
            <div key={i} className="border-t border-[#eef0f3]" />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-7 top-7 flex items-end justify-around gap-2 px-1">
          {items.map((item) => {
            const pct = (item.value / max) * 100
            return (
              <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <div className="relative w-10 max-w-full" style={{ height: `${Math.max(pct, item.value > 0 ? 2 : 0)}%` }}>
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[13px] font-bold text-ink">
                    {formatCount(item.value)}
                  </span>
                  <div className="h-full w-full rounded-md" style={{ backgroundColor: item.color }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-around gap-2 px-1">
          {items.map((item) => (
            <span
              key={item.label}
              className="min-w-0 flex-1 whitespace-nowrap text-center text-[13px] font-semibold leading-5 text-ink-muted"
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
