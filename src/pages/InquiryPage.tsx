import { useState, type FormEvent } from 'react'
import { Sidebar } from '../components/layout/Sidebar'
import { useAuth } from '../context/AuthContext'

const inquiryTypes = [
  { value: 'bug', label: '오류 신고' },
  { value: 'question', label: '문의사항' },
] as const

const relatedPages = [
  '선택 안 함',
  '졸업요건',
  '공학인증',
  '졸업 시뮬레이션',
  '이수체계도',
  '기이수 성적',
  '기타',
] as const

type InquiryType = (typeof inquiryTypes)[number]['value']

export function InquiryPage() {
  const { student } = useAuth()
  const [type, setType] = useState<InquiryType>('bug')
  const [relatedPage, setRelatedPage] = useState<string>(relatedPages[0])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const canSubmit = title.trim().length > 0 && content.trim().length > 0

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    // UI only — API 연동 전
    setSubmitted(true)
    setTitle('')
    setContent('')
    setRelatedPage(relatedPages[0])
    setType('bug')
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col px-8 py-8">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-wide text-sejong">SUPPORT</p>
          <h1 className="mt-1 text-2xl font-extrabold text-ink">오류 신고 · 문의</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {student?.name}님 · 서비스 이용 중 발견한 오류나 궁금한 점을 남겨 주세요.
          </p>
        </header>

        <div className="mx-auto w-full max-w-2xl">
          {submitted && (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              접수되었습니다. (현재 UI 미리보기 — 서버 전송은 아직 연결되지 않았습니다.)
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="ml-3 text-emerald-700 underline"
              >
                닫기
              </button>
            </div>
          )}

          <form
            onSubmit={onSubmit}
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
                onChange={(e) => setTitle(e.target.value)}
                placeholder={type === 'bug' ? '어떤 오류인가요?' : '무엇을 문의하시나요?'}
                className="rounded-xl border border-[#e5e7eb] bg-panel px-3 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-sejong/30"
              />
            </label>

            <label className="mt-5 flex flex-col gap-1.5 text-xs font-semibold text-ink">
              내용
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder={
                  type === 'bug'
                    ? '발생 화면, 재현 방법, 기대한 동작을 적어 주세요.'
                    : '문의 내용을 자세히 적어 주세요.'
                }
                className="resize-y rounded-xl border border-[#e5e7eb] bg-panel px-3 py-2.5 text-sm font-medium leading-relaxed text-ink outline-none focus:ring-2 focus:ring-sejong/30"
              />
            </label>

            <div className="mt-4 rounded-xl bg-panel px-4 py-3 text-xs leading-relaxed text-ink-muted">
              학번 {student?.studentNo ?? '—'} · {student?.major ?? '학과 미확인'} 정보가 함께
              전달됩니다. (미리보기)
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-6 w-full rounded-full bg-sejong px-6 py-3 text-sm font-bold text-white transition hover:bg-sejong-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {type === 'bug' ? '오류 신고 보내기' : '문의 보내기'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
