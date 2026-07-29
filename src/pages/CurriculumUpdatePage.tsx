import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { getDepartments, uploadCurriculumRoadmap } from '../api/endpoints'
import { Sidebar } from '../components/layout/Sidebar'
import { useAuth } from '../context/AuthContext'

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 8 }, (_, i) => currentYear - i)

export function CurriculumUpdatePage() {
  const navigate = useNavigate()
  const { student } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const [departments, setDepartments] = useState<string[]>(['CSE'])
  const [year, setYear] = useState(student?.admissionYear || currentYear)
  const [departmentCode, setDepartmentCode] = useState(
    student?.tracks?.[0]?.departmentCode || 'CSE',
  )
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await getDepartments()
        if (cancelled || !Array.isArray(list) || list.length === 0) return
        setDepartments(list)
        setDepartmentCode((prev) =>
          list.includes(prev) ? prev : list.includes('CSE') ? 'CSE' : list[0],
        )
      } catch {
        // keep default
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pickFile = (next?: File | null) => {
    if (!next) return
    const lower = next.name.toLowerCase()
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls') && !lower.endsWith('.csv')) {
      setError('XLSX, XLS, CSV 파일만 업로드할 수 있습니다.')
      return
    }
    setError(null)
    setMessage(null)
    setFile(next)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file || loading) return

    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await uploadCurriculumRoadmap(file, year, departmentCode)
      setMessage(res.message ?? '이수체계도가 업데이트되었습니다.')
      setFile(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '이수체계도 업로드에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col px-8 py-8">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">이수체계도 업데이트</h1>
            <p className="mt-2 text-sm text-ink-muted">
              학과·연도별 이수체계도(과목·선수과목) 파일을 업로드합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/curriculum')}
            className="rounded-full border border-[#e5e7eb] bg-white px-5 py-2 text-sm font-semibold text-ink transition hover:border-sejong hover:text-sejong"
          >
            이수체계도 보기
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
        >
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
              연도
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-[#e5e7eb] bg-panel px-3 py-2 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-sejong/30"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
              학과
              <select
                value={departmentCode}
                onChange={(e) => setDepartmentCode(e.target.value)}
                className="rounded-lg border border-[#e5e7eb] bg-panel px-3 py-2 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-sejong/30"
              >
                {departments.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
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
            className={`mt-5 w-full rounded-2xl px-5 py-14 text-center transition ${
              dragging ? 'bg-sejong-light ring-2 ring-sejong' : 'bg-panel'
            }`}
          >
            <p className="text-sm text-ink-muted">파일 형식 : XLSX / XLS / CSV</p>
            <p className="mt-2 text-xs text-ink-faint">클릭하거나 파일을 끌어다 놓으세요</p>
            {file && <p className="mt-4 text-sm font-semibold text-sejong">{file.name}</p>}
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
            className="mt-5 w-full rounded-full bg-sejong px-6 py-3 text-sm font-bold text-white transition hover:bg-sejong-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '업로드 중...' : '업데이트'}
          </button>
        </form>
      </main>
    </div>
  )
}
