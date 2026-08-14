import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../api/client'
import { getAdminFeedbacks, updateAdminFeedback } from '../api/endpoints'
import type { FeedbackItem, FeedbackStatus, FeedbackType } from '../api/types'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../context/AuthContext'

const statusLabel: Record<FeedbackStatus, string> = {
  OPEN: '대기',
  IN_PROGRESS: '확인중',
  RESOLVED: '완료',
}

const statusClass: Record<FeedbackStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-800',
  IN_PROGRESS: 'bg-sky-50 text-sky-800',
  RESOLVED: 'bg-emerald-50 text-emerald-800',
}

const typeLabel: Record<FeedbackType, string> = {
  BUG: '오류 신고',
  INQUIRY: '문의사항',
}

function formatFeedbackDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value.replace('T', ' ').slice(0, 16)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

export function AdminInquiriesPage() {
  const { student } = useAuth()
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [typeFilter, setTypeFilter] = useState<'all' | FeedbackType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const loadList = useCallback(async () => {
    if (!student?.id) return
    setLoading(true)
    setError(null)
    try {
      const list = await getAdminFeedbacks(student.id)
      const next = Array.isArray(list) ? list : []
      setItems(next)
      setSelectedId((prev) => {
        if (prev != null && next.some((i) => i.id === prev)) return prev
        return next[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '문의 목록을 불러오지 못했습니다.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [student?.id])

  useEffect(() => {
    void loadList()
  }, [loadList])

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

  useEffect(() => {
    setNoteDraft(selected?.adminNote ?? '')
    setActionError(null)
  }, [selected?.id, selected?.adminNote])

  const patchSelected = async (body: { status?: FeedbackStatus; adminNote?: string }) => {
    if (!selected || !student?.id) return
    setSaving(true)
    setActionError(null)
    try {
      const updated = await updateAdminFeedback(selected.id, body, student.id)
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setSelectedId(updated.id)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : '수정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <main className="flex min-w-0 flex-1 flex-col px-4 py-5 md:px-8 md:py-8">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-wide text-sejong">ADMIN</p>
          <h1 className="mt-1 text-2xl font-extrabold text-ink">문의 · 오류 신고</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {student?.name}님 · 사용자가 보낸 오류 신고와 문의사항을 확인합니다.
          </p>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(
            [
              ['all', '전체 유형'],
              ['BUG', '오류 신고'],
              ['INQUIRY', '문의사항'],
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
              ['OPEN', '대기'],
              ['IN_PROGRESS', '확인중'],
              ['RESOLVED', '완료'],
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
          <button
            type="button"
            onClick={() => void loadList()}
            className="ml-auto rounded-full border border-[#e5e7eb] bg-white px-3.5 py-1.5 text-xs font-bold text-ink"
          >
            새로고침
          </button>
        </div>

        {loading ? (
          <p className="py-20 text-center text-sm text-ink-muted">불러오는 중...</p>
        ) : error ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-sejong">{error}</p>
        ) : (
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
                            <span className="text-[11px] text-ink-faint">
                              {formatFeedbackDate(item.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-1 text-sm font-bold text-ink">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs text-ink-muted">
                            {item.studentName ?? '—'} · {item.studentNo ?? '—'} ·{' '}
                            {item.major ?? '—'}
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
                    {selected.studentName ?? '—'} ({selected.studentNo ?? '—'}) ·{' '}
                    {selected.major ?? '—'}
                    <br />
                    {formatFeedbackDate(selected.createdAt)}
                    {selected.updatedAt && selected.updatedAt !== selected.createdAt
                      ? ` · 수정 ${formatFeedbackDate(selected.updatedAt)}`
                      : ''}
                  </p>

                  <div className="mt-5 rounded-xl bg-panel px-4 py-4 text-sm leading-relaxed text-ink whitespace-pre-wrap">
                    {selected.content}
                  </div>

                  {actionError && (
                    <p className="mt-4 text-sm font-medium text-sejong">{actionError}</p>
                  )}

                  <div className="mt-6">
                    <p className="mb-2 text-xs font-semibold text-ink-muted">상태</p>
                    <div className="flex flex-wrap gap-2">
                      {(['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={saving || selected.status === status}
                          onClick={() => void patchSelected({ status })}
                          className={`rounded-full px-3.5 py-1.5 text-xs font-bold disabled:opacity-60 ${
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

                  <label className="mt-5 flex flex-col gap-1.5 text-xs font-semibold text-ink">
                    관리자 메모
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value.slice(0, 1000))}
                      maxLength={1000}
                      rows={4}
                      placeholder="확인 내용, 답변 요지 등을 남겨 주세요."
                      className="resize-y rounded-xl border border-[#e5e7eb] bg-panel px-3 py-2.5 text-sm font-medium leading-relaxed text-ink outline-none focus:ring-2 focus:ring-sejong/30"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void patchSelected({
                        adminNote: noteDraft.trim() === '' ? '' : noteDraft.trim(),
                      })
                    }
                    className="mt-3 rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {saving ? '저장 중...' : '메모 저장'}
                  </button>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </AppShell>
  )
}
