import { useMemo, useState } from 'react'
import { Sidebar } from '../components/layout/Sidebar'
import { useAuth } from '../context/AuthContext'

type InquiryStatus = 'pending' | 'reviewing' | 'done'
type InquiryType = 'bug' | 'question'

type InquiryItem = {
  id: number
  type: InquiryType
  status: InquiryStatus
  title: string
  content: string
  relatedPage: string
  studentNo: string
  studentName: string
  major: string
  createdAt: string
}

/** UI 미리보기용 더미 데이터 — API 연동 전 */
const MOCK_INQUIRIES: InquiryItem[] = [
  {
    id: 1,
    type: 'bug',
    status: 'pending',
    title: '시뮬레이션 검색에 Capstone이 중복으로 보여요',
    content:
      'cap으로 검색하면 같은 학수번호가 전선으로 여러 줄 나옵니다. 새로고침해도 동일합니다.',
    relatedPage: '졸업 시뮬레이션',
    studentNo: '21011620',
    studentName: '송대현',
    major: '컴퓨터공학과',
    createdAt: '2026-08-03 14:22',
  },
  {
    id: 2,
    type: 'question',
    status: 'reviewing',
    title: '21학번인데 전공기초가 전선으로 잡히나요?',
    content: '전공기초 과목을 계획에 넣었는데 부족 요건에 전공기초가 안 뜨고 전선만 늘어납니다.',
    relatedPage: '졸업 시뮬레이션',
    studentNo: '21011620',
    studentName: '송대현',
    major: '컴퓨터공학과',
    createdAt: '2026-08-03 15:01',
  },
  {
    id: 3,
    type: 'bug',
    status: 'done',
    title: '로드맵 4-1 과목이 비어 있어요',
    content: '이수체계도에서 4-1 칸에 영상처리 등이 안 보입니다. 일반 로드맵 기준입니다.',
    relatedPage: '이수체계도',
    studentNo: '24012357',
    studentName: '김정현',
    major: '컴퓨터공학과',
    createdAt: '2026-08-02 21:40',
  },
  {
    id: 4,
    type: 'question',
    status: 'pending',
    title: '영어인증 문구가 너무 길어요',
    content: '졸업요건 영어인증 카드에 긴 기준 문구가 그대로 보이는데 숨기는 게 맞나요?',
    relatedPage: '졸업요건',
    studentNo: '24012357',
    studentName: '김정현',
    major: '컴퓨터공학과',
    createdAt: '2026-08-03 09:12',
  },
]

const statusLabel: Record<InquiryStatus, string> = {
  pending: '대기',
  reviewing: '확인중',
  done: '완료',
}

const statusClass: Record<InquiryStatus, string> = {
  pending: 'bg-amber-50 text-amber-800',
  reviewing: 'bg-sky-50 text-sky-800',
  done: 'bg-emerald-50 text-emerald-800',
}

const typeLabel: Record<InquiryType, string> = {
  bug: '오류 신고',
  question: '문의사항',
}

export function AdminInquiriesPage() {
  const { student } = useAuth()
  const [items, setItems] = useState(MOCK_INQUIRIES)
  const [typeFilter, setTypeFilter] = useState<'all' | InquiryType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | InquiryStatus>('all')
  const [selectedId, setSelectedId] = useState<number | null>(MOCK_INQUIRIES[0]?.id ?? null)

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (typeFilter !== 'all' && item.type !== typeFilter) return false
        if (statusFilter !== 'all' && item.status !== statusFilter) return false
        return true
      }),
    [items, typeFilter, statusFilter],
  )

  const selected = filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? null

  const updateStatus = (id: number, status: InquiryStatus) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col px-8 py-8">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-wide text-sejong">ADMIN</p>
          <h1 className="mt-1 text-2xl font-extrabold text-ink">문의 · 오류 신고</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {student?.name}님 · 사용자가 보낸 오류 신고와 문의사항을 확인합니다. (UI 미리보기)
          </p>
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ['all', '전체 유형'],
              ['bug', '오류 신고'],
              ['question', '문의사항'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTypeFilter(value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                typeFilter === value ? 'bg-sejong text-white' : 'bg-white text-ink'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-[#e5e7eb] sm:inline-block" />
          {(
            [
              ['all', '전체 상태'],
              ['pending', '대기'],
              ['reviewing', '확인중'],
              ['done', '완료'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                statusFilter === value ? 'bg-ink text-white' : 'bg-white text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="border-b border-[#f0f0f3] px-5 py-3 text-sm font-bold text-ink">
              목록 · {filtered.length}건
            </div>
            <ul className="max-h-[70vh] divide-y divide-[#f0f0f3] overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-5 py-10 text-center text-sm text-ink-muted">
                  해당 조건의 항목이 없습니다.
                </li>
              ) : (
                filtered.map((item) => {
                  const active = selected?.id === item.id
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full px-5 py-4 text-left transition ${
                          active ? 'bg-sejong-light/60' : 'hover:bg-panel'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                            {typeLabel[item.type]}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass[item.status]}`}
                          >
                            {statusLabel[item.status]}
                          </span>
                          <span className="text-[11px] text-ink-faint">{item.createdAt}</span>
                        </div>
                        <p className="mt-2 line-clamp-1 text-sm font-bold text-ink">{item.title}</p>
                        <p className="mt-1 text-xs text-ink-muted">
                          {item.studentName} · {item.studentNo} · {item.relatedPage}
                        </p>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            {!selected ? (
              <p className="py-16 text-center text-sm text-ink-muted">항목을 선택해 주세요.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-panel px-2.5 py-1 text-[11px] font-bold text-ink-muted">
                        {typeLabel[selected.type]}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass[selected.status]}`}
                      >
                        {statusLabel[selected.status]}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-extrabold text-ink">{selected.title}</h2>
                    <p className="mt-2 text-xs text-ink-muted">
                      {selected.studentName} ({selected.studentNo}) · {selected.major}
                      <br />
                      {selected.relatedPage} · {selected.createdAt}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-panel px-4 py-4 text-sm leading-relaxed text-ink whitespace-pre-wrap">
                  {selected.content}
                </div>

                <div className="mt-6">
                  <p className="mb-2 text-xs font-semibold text-ink-muted">상태 변경 (미리보기)</p>
                  <div className="flex flex-wrap gap-2">
                    {(['pending', 'reviewing', 'done'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateStatus(selected.id, status)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                          selected.status === status
                            ? 'bg-sejong text-white'
                            : 'border border-[#e5e7eb] bg-white text-ink'
                        }`}
                      >
                        {statusLabel[status]}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
