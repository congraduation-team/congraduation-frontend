import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { createFeedback, getMyFeedbacks } from '../api/endpoints'
import type { FeedbackItem, FeedbackStatus, FeedbackType } from '../api/types'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../context/AuthContext'
import { formatKstDateTime } from '../utils/formatDate'

const inquiryTypes = [
  { value: 'BUG' as const, label: '오류 신고' },
  { value: 'INQUIRY' as const, label: '문의사항' },
]

const relatedPages = [
  '선택 안 함',
  '졸업요건',
  '공학인증',
  '졸업 시뮬레이션',
  '이수체계도',
  '기이수 성적',
  '기타',
] as const

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
  return formatKstDateTime(value)
}

export function InquiryPage() {
  const { student } = useAuth()
  const [type, setType] = useState<FeedbackType>('BUG')
  const [relatedPage, setRelatedPage] = useState<string>(relatedPages[0])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitOk, setSubmitOk] = useState(false)

  const [mine, setMine] = useState<FeedbackItem[]>([])
  const [mineLoading, setMineLoading] = useState(true)
  const [mineError, setMineError] = useState<string | null>(null)

  const canSubmit =
    title.trim().length > 0 &&
    title.trim().length <= 80 &&
    content.trim().length > 0 &&
    content.trim().length <= 2000 &&
    !submitting

  const loadMine = useCallback(async () => {
    if (!student?.id) {
      setMine([])
      setMineLoading(false)
      return
    }
    setMineLoading(true)
    setMineError(null)
    try {
      const list = await getMyFeedbacks(student.id)
      setMine(Array.isArray(list) ? list : [])
    } catch (err) {
      setMineError(err instanceof ApiError ? err.message : '내 문의 목록을 불러오지 못했습니다.')
    } finally {
      setMineLoading(false)
    }
  }, [student?.id])

  useEffect(() => {
    void loadMine()
  }, [loadMine])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !student) return
    setSubmitting(true)
    setSubmitError(null)
    setSubmitOk(false)
    try {
      const bodyContent =
        relatedPage && relatedPage !== '선택 안 함'
          ? `[관련 화면: ${relatedPage}]\n\n${content.trim()}`
          : content.trim()
      await createFeedback({
        type,
        title: title.trim().slice(0, 80),
        content: bodyContent.slice(0, 2000),
        studentId: student.id,
      })
      setSubmitOk(true)
      setTitle('')
      setContent('')
      setRelatedPage(relatedPages[0])
      setType('BUG')
      await loadMine()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : '접수에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <main className="flex min-w-0 flex-1 flex-col px-4 py-5 md:px-8 md:py-8">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-wide text-sejong">SUPPORT</p>
          <h1 className="mt-1 text-2xl font-extrabold text-ink">오류 신고 · 문의</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {student?.name}님 · 서비스 이용 중 발견한 오류나 궁금한 점을 남겨 주세요.
          </p>
        </header>

        <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            {submitOk && (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
                접수되었습니다.
                <button
                  type="button"
                  onClick={() => setSubmitOk(false)}
                  className="ml-3 text-emerald-700 underline"
                >
                  닫기
                </button>
              </div>
            )}
            {submitError && (
              <div className="mb-5 rounded-2xl border border-sejong/20 bg-sejong-light px-5 py-4 text-sm font-medium text-sejong">
                {submitError}
              </div>
            )}

            <form
              onSubmit={(e) => void onSubmit(e)}
              className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
            >
              <div className="flex flex-wrap gap-2">
                {inquiryTypes.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setType(item.value)}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      type === item.value
                        ? 'bg-sejong text-white'
                        : 'bg-panel text-ink hover:bg-sejong-light'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <label className="mt-6 flex flex-col gap-1.5 text-xs font-semibold text-ink">
                관련 화면
                <select
                  value={relatedPage}
                  onChange={(e) => setRelatedPage(e.target.value)}
                  className="rounded-xl border border-[#e5e7eb] bg-panel px-3 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-sejong/30"
                >
                  {relatedPages.map((page) => (
                    <option key={page} value={page}>
                      {page}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-5 flex flex-col gap-1.5 text-xs font-semibold text-ink">
                제목
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                  maxLength={80}
                  placeholder={type === 'BUG' ? '어떤 오류인가요?' : '무엇을 문의하시나요?'}
                  className="rounded-xl border border-[#e5e7eb] bg-panel px-3 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-sejong/30"
                />
                <span className="font-medium text-ink-faint">{title.trim().length}/80</span>
              </label>

              <label className="mt-5 flex flex-col gap-1.5 text-xs font-semibold text-ink">
                내용
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, 2000))}
                  maxLength={2000}
                  rows={8}
                  placeholder={
                    type === 'BUG'
                      ? '발생 화면, 재현 방법, 기대한 동작을 적어 주세요.'
                      : '문의 내용을 자세히 적어 주세요.'
                  }
                  className="resize-y rounded-xl border border-[#e5e7eb] bg-panel px-3 py-2.5 text-sm font-medium leading-relaxed text-ink outline-none focus:ring-2 focus:ring-sejong/30"
                />
                <span className="font-medium text-ink-faint">{content.trim().length}/2000</span>
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className="mt-6 w-full rounded-full bg-sejong px-6 py-3 text-sm font-bold text-white transition hover:bg-sejong-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? '보내는 중...'
                  : type === 'BUG'
                    ? '오류 신고 보내기'
                    : '문의 보내기'}
              </button>
            </form>
          </div>

          <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h2 className="text-base font-bold text-ink">내 접수 내역</h2>
            <p className="mt-1 text-xs text-ink-muted">최신순으로 표시됩니다.</p>

            {mineLoading ? (
              <p className="mt-8 text-center text-sm text-ink-muted">불러오는 중...</p>
            ) : mineError ? (
              <p className="mt-8 text-center text-sm text-sejong">{mineError}</p>
            ) : mine.length === 0 ? (
              <p className="mt-8 text-center text-sm text-ink-muted">아직 접수한 내용이 없습니다.</p>
            ) : (
              <ul className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto">
                {mine.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-[#f0f0f3] bg-panel/40 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-ink-muted">
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
                    <p className="mt-2 text-sm font-bold text-ink">{item.title}</p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-ink-muted">
                      {item.content}
                    </p>
                    {item.adminNote && (
                      <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-ink">
                        <span className="font-bold text-sejong">관리자 </span>
                        {item.adminNote}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  )
}
