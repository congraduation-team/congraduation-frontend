import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from '../components/layout/Sidebar'
import {
  curriculumCourses,
  curriculumEdges,
  semesters,
  type CurriculumCourse,
  type CurriculumEdge,
} from '../data/mockData'

const years = [2024, 2023, 2022, 2021, 2020, 2019]

const categoryStyle: Record<CurriculumCourse['category'], string> = {
  liberal: 'bg-[#e8eaee] text-ink',
  bsm: 'bg-[#4a5568] text-white',
  'major-required': 'bg-sejong text-white',
  'major-elective': 'bg-sejong-pink text-ink',
}

const rowDefs = [
  { key: 'liberal', label: '전문교양', categories: ['liberal'] as const, border: 'border-[#c5c9d0]' },
  { key: 'bsm', label: 'BSM', categories: ['bsm'] as const, border: 'border-[#4a5568]' },
  { key: 'major', label: '전공', categories: ['major-required', 'major-elective'] as const, border: 'border-sejong' },
]

type NodePos = { x1: number; y1: number; x2: number; y2: number; cx: number; cy: number }

function buildOrthogonalPath(from: NodePos, to: NodePos, bendOffset: number) {
  const startX = from.x2
  const startY = from.cy
  const endX = to.x1
  const endY = to.cy
  const midX = startX + (endX - startX) / 2 + bendOffset

  return `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`
}

export function CurriculumPage() {
  const [year, setYear] = useState(2024)
  const [mode, setMode] = useState<'all' | 'mine'>('all')
  const [filter, setFilter] = useState<string | null>(null)
  const [paths, setPaths] = useState<Array<{ d: string; type: CurriculumEdge['type']; key: string }>>([])

  const boardRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const courses = useMemo(() => {
    let list = curriculumCourses
    if (mode === 'mine') list = list.filter((c) => !c.faded)
    if (filter === 'liberal') list = list.filter((c) => c.category === 'liberal')
    if (filter === 'bsm') list = list.filter((c) => c.category === 'bsm')
    if (filter === 'major-required') list = list.filter((c) => c.category === 'major-required')
    if (filter === 'major-elective') list = list.filter((c) => c.category === 'major-elective')
    return list
  }, [mode, filter])

  const visibleIds = useMemo(() => new Set(courses.map((c) => c.id)), [courses])

  const edges = useMemo(
    () => curriculumEdges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to)),
    [visibleIds],
  )

  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board) return

    const update = () => {
      const boardRect = board.getBoundingClientRect()
      const positions: Record<string, NodePos> = {}

      Object.entries(nodeRefs.current).forEach(([id, el]) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        positions[id] = {
          x1: r.left - boardRect.left,
          y1: r.top - boardRect.top,
          x2: r.right - boardRect.left,
          y2: r.bottom - boardRect.top,
          cx: r.left - boardRect.left + r.width / 2,
          cy: r.top - boardRect.top + r.height / 2,
        }
      })

      const next = edges
        .map((edge, index) => {
          const from = positions[edge.from]
          const to = positions[edge.to]
          if (!from || !to) return null
          const bendOffset = ((index % 5) - 2) * 6
          return {
            key: `${edge.from}-${edge.to}`,
            type: edge.type,
            d: buildOrthogonalPath(from, to, bendOffset),
          }
        })
        .filter(Boolean) as Array<{ d: string; type: CurriculumEdge['type']; key: string }>

      setPaths(next)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(board)
    window.addEventListener('scroll', update, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', update, true)
    }
  }, [edges, courses, mode, filter, year])

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-auto px-8 py-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-ink">이수체계도</h1>
            <div className="flex overflow-hidden rounded-full border border-[#ddd] text-sm font-semibold">
              <button
                type="button"
                onClick={() => setMode('all')}
                className={`px-4 py-1.5 ${mode === 'all' ? 'bg-sejong text-white' : 'bg-white text-ink'}`}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => setMode('mine')}
                className={`px-4 py-1.5 ${mode === 'mine' ? 'bg-sejong text-white' : 'bg-white text-ink'}`}
              >
                마이
              </button>
            </div>
          </div>
        </div>

        {/* 연도 탭 */}
        <div className="mt-5 flex flex-wrap gap-6 border-b border-[#e5e5ea]">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`pb-2.5 text-[15px] font-semibold ${
                year === y
                  ? 'border-b-[3px] border-sejong text-sejong'
                  : 'border-b-[3px] border-transparent text-ink'
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {/* 체계표 안내 / 범례 */}
        <div className="mt-0 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[#e5e5ea] py-3.5">
          <span className="shrink-0 text-sm font-medium text-ink">체계표 안내</span>

          <div className="flex flex-wrap items-center gap-2">
            <LegendPill
              active={filter === 'liberal'}
              onClick={() => setFilter(filter === 'liberal' ? null : 'liberal')}
              className="bg-[#e8eaee] text-ink"
              label="전문교양"
            />
            <LegendPill
              active={filter === 'bsm'}
              onClick={() => setFilter(filter === 'bsm' ? null : 'bsm')}
              className="bg-[#4a5568] text-white"
              label="BSM(기초수학, 과학)"
            />
            <LegendPill
              active={filter === 'major-required'}
              onClick={() => setFilter(filter === 'major-required' ? null : 'major-required')}
              className="bg-sejong text-white"
              label="전공(인필)"
            />
            <LegendPill
              active={filter === 'major-elective'}
              onClick={() => setFilter(filter === 'major-elective' ? null : 'major-elective')}
              className="bg-sejong-pink text-white"
              label="전공(인선)"
            />
          </div>

          <div className="ml-auto flex items-end gap-8">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-ink">필수 선수과목</span>
              <svg width="56" height="12" viewBox="0 0 56 12" aria-hidden>
                <line x1="0" y1="6" x2="46" y2="6" stroke="#222" strokeWidth="1.8" />
                <polygon points="46,1.5 56,6 46,10.5" fill="#222" />
              </svg>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-ink">선택 선수과목</span>
              <svg width="56" height="12" viewBox="0 0 56 12" aria-hidden>
                <line
                  x1="0"
                  y1="6"
                  x2="46"
                  y2="6"
                  stroke="#222"
                  strokeWidth="1.8"
                  strokeDasharray="4 3"
                />
                <polygon points="46,1.5 56,6 46,10.5" fill="#222" />
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div ref={boardRef} className="relative min-w-[1200px]">
            <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible">
              <defs>
                <marker
                  id="arrow-required"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#555" />
                </marker>
                <marker
                  id="arrow-optional"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#888" />
                </marker>
              </defs>
              {paths.map((path) => (
                <path
                  key={path.key}
                  d={path.d}
                  fill="none"
                  stroke={path.type === 'required' ? '#555' : '#888'}
                  strokeWidth="1.5"
                  strokeDasharray={path.type === 'optional' ? '5 4' : undefined}
                  markerEnd={`url(#arrow-${path.type})`}
                />
              ))}
            </svg>

            <div className="relative z-10 mb-3 grid grid-cols-[72px_repeat(8,1fr)] gap-2">
              <div />
              {semesters.map((s) => (
                <div key={s} className="text-center text-sm font-bold text-ink">
                  {s}
                </div>
              ))}
            </div>

            {rowDefs.map((row) => (
              <div key={row.key} className="relative z-10 mb-5 grid grid-cols-[72px_repeat(8,1fr)] gap-2">
                <div className="flex items-center justify-center">
                  <span
                    className={`rounded-full border px-2 py-8 text-center text-[11px] font-bold text-ink ${row.border}`}
                    style={{ writingMode: 'vertical-rl' }}
                  >
                    {row.label}
                  </span>
                </div>
                {semesters.map((semester) => {
                  const cellCourses = courses.filter(
                    (c) => c.semester === semester && row.categories.includes(c.category as never),
                  )
                  const isFirstMajor = row.key === 'major' && semester === '1-1'

                  return (
                    <div
                      key={`${row.key}-${semester}`}
                      className={`relative min-h-[130px] space-y-2.5 rounded-xl p-1.5 ${
                        isFirstMajor ? 'border border-dashed border-sejong bg-sejong-light/40' : ''
                      }`}
                    >
                      {isFirstMajor && (
                        <p className="mb-1 text-center text-[10px] font-semibold text-sejong">
                          모든 전공의 선수 과목
                        </p>
                      )}
                      {cellCourses.map((course) => (
                        <div
                          key={course.id}
                          ref={(el) => {
                            nodeRefs.current[course.id] = el
                          }}
                          className={`rounded-full px-2.5 py-2 text-center text-[11px] font-semibold leading-tight shadow-sm ${
                            categoryStyle[course.category]
                          } ${course.faded && mode === 'all' ? 'opacity-45' : ''}`}
                        >
                          <div>{course.name}</div>
                          <div className="mt-0.5 text-[10px] font-medium opacity-80">{course.hours}</div>
                          {course.name.includes('Capstone') && (
                            <span className="mt-1 inline-flex size-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-sejong">
                              !
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

function LegendPill({
  label,
  className,
  active,
  onClick,
}: {
  label: string
  className: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${className} ${
        active ? 'ring-2 ring-offset-1 ring-ink' : ''
      }`}
    >
      {label}
    </button>
  )
}
