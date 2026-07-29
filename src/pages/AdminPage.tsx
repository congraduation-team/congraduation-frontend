import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { uploadClassSchedule, uploadCourseCatalog } from '../api/endpoints'
import { Sidebar } from '../components/layout/Sidebar'
import { useAuth } from '../context/AuthContext'

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 8 }, (_, i) => currentYear - i)
const semesters = [
  { value: 1, label: '1학기' },
  { value: 2, label: '2학기' },
  { value: 3, label: '여름계절' },
  { value: 4, label: '겨울계절' },
]

type UploadCardProps = {
  title: string
  description: string
  acceptHint: string
  year: number
  onYearChange: (year: number) => void
  semester?: number
  onSemesterChange?: (semester: number) => void
  file: File | null
  onFile: (file: File | null) => void
  loading: boolean
  message: string | null
  error: string | null
  onSubmit: (e: FormEvent) => void
}

function UploadCard({
  title,
  description,
  acceptHint,
  year,
  onYearChange,
  semester,
  onSemesterChange,
  file,
  onFile,
  loading,
  message,
  error,
  onSubmit,
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const pickFile = (next?: File | null) => {
    if (!next) return
    const lower = next.name.toLowerCase()
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls') && !lower.endsWith('.csv')) {
      return
    }
    onFile(next)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-1 flex-col rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
    >
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
          연도
          <select
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="rounded-lg border border-[#e5e7eb] bg-panel px-3 py-2 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-sejong/30"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        {onSemesterChange != null && semester != null && (
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
            학기
            <select
              value={semester}
              onChange={(e) => onSemesterChange(Number(e.target.value))}
              className="rounded-lg border border-[#e5e7eb] bg-panel px-3 py-2 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-sejong/30"
            >
              {semesters.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-5 w-full rounded-2xl px-5 py-10 text-center transition ${
          dragging ? 'bg-sejong-light ring-2 ring-sejong' : 'bg-panel'
        }`}
      >
        <p className="text-sm text-ink-muted">{acceptHint}</p>
        <p className="mt-2 text-xs text-ink-faint">클릭하거나 파일을 끌어다 놓으세요</p>
        {file && <p className="mt-3 text-sm font-semibold text-sejong">{file.name}</p>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0])}
      />

      {error && <p className="mt-3 text-sm font-medium text-sejong">{error}</p>}
      {message && <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p>}

      <button
        type="submit"
        disabled={!file || loading}
        className="mt-5 rounded-full bg-sejong px-6 py-3 text-sm font-bold text-white transition hover:bg-sejong-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? '업로드 중...' : '업데이트'}
      </button>
    </form>
  )
}

export function AdminPage() {
  const { student } = useAuth()

  const [catalogYear, setCatalogYear] = useState(currentYear)
  const [catalogFile, setCatalogFile] = useState<File | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  const [scheduleYear, setScheduleYear] = useState(currentYear)
  const [scheduleSemester, setScheduleSemester] = useState(1)
  const [scheduleFile, setScheduleFile] = useState<File | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  const submitCatalog = async (e: FormEvent) => {
    e.preventDefault()
    if (!catalogFile || catalogLoading) return
    setCatalogLoading(true)
    setCatalogError(null)
    setCatalogMessage(null)
    try {
      const res = await uploadCourseCatalog(catalogFile, catalogYear)
      setCatalogMessage(res.message ?? '수강편람이 업데이트되었습니다.')
      setCatalogFile(null)
    } catch (err) {
      setCatalogError(
        err instanceof ApiError ? err.message : '수강편람 업로드에 실패했습니다.',
      )
    } finally {
      setCatalogLoading(false)
    }
  }

  const submitSchedule = async (e: FormEvent) => {
    e.preventDefault()
    if (!scheduleFile || scheduleLoading) return
    setScheduleLoading(true)
    setScheduleError(null)
    setScheduleMessage(null)
    try {
      const res = await uploadClassSchedule(scheduleFile, scheduleYear, scheduleSemester)
      setScheduleMessage(res.message ?? '강의 시간표가 업데이트되었습니다.')
      setScheduleFile(null)
    } catch (err) {
      setScheduleError(
        err instanceof ApiError ? err.message : '강의 시간표 업로드에 실패했습니다.',
      )
    } finally {
      setScheduleLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col px-8 py-8">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-wide text-sejong">ADMIN</p>
          <h1 className="mt-1 text-2xl font-extrabold text-ink">관리자</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {student?.name}님 · 수강편람·강의 시간표 데이터를 업데이트할 수 있습니다.
          </p>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row">
          <UploadCard
            title="수강편람"
            description="연도별 수강편람(개설 과목·이수구분 등) 파일을 업로드합니다."
            acceptHint="파일 형식 : XLSX / XLS / CSV"
            year={catalogYear}
            onYearChange={setCatalogYear}
            file={catalogFile}
            onFile={(f) => {
              setCatalogFile(f)
              setCatalogError(null)
              setCatalogMessage(null)
            }}
            loading={catalogLoading}
            message={catalogMessage}
            error={catalogError}
            onSubmit={submitCatalog}
          />

          <UploadCard
            title="강의 시간표"
            description="학기별 강의 시간표 파일을 업로드합니다."
            acceptHint="파일 형식 : XLSX / XLS / CSV"
            year={scheduleYear}
            onYearChange={setScheduleYear}
            semester={scheduleSemester}
            onSemesterChange={setScheduleSemester}
            file={scheduleFile}
            onFile={(f) => {
              setScheduleFile(f)
              setScheduleError(null)
              setScheduleMessage(null)
            }}
            loading={scheduleLoading}
            message={scheduleMessage}
            error={scheduleError}
            onSubmit={submitSchedule}
          />
        </div>
      </main>
    </div>
  )
}
