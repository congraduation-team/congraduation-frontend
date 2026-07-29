import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { evaluateAbeekFromTranscript, getTranscriptStatus, uploadTranscript } from '../api/endpoints'
import { BrandHeader } from '../components/common/BrandHeader'
import { UniversitySeal } from '../components/common/UniversitySeal'
import { useAuth } from '../context/AuthContext'

export function UploadPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isUpdate = searchParams.get('update') === '1'
  const { student } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(!isUpdate)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!student || isUpdate) {
      setChecking(false)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const status = await getTranscriptStatus(student.id)
        if (!cancelled && status.hasTranscript) {
          navigate('/dashboard', { replace: true })
          return
        }
      } catch {
        // keep upload screen
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [student, navigate, isUpdate])

  const pickFile = (next?: File | null) => {
    if (!next) return
    if (!next.name.toLowerCase().endsWith('.xlsx')) {
      setError('XLSX 파일만 업로드할 수 있습니다.')
      return
    }
    if (next.size > 1024 * 1024) {
      setError('파일 용량은 최대 1MB입니다.')
      return
    }
    setError(null)
    setFile(next)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!student || !file || loading) return

    setLoading(true)
    setError(null)
    try {
      await uploadTranscript(student.id, file)

      // 졸업요건 업로드와 별개로 ABEEK 공학인증 학생/이수 정보를 등록
      try {
        await evaluateAbeekFromTranscript(file, {
          studentId: student.studentNo || String(student.id),
          name: student.name,
          entranceYear: student.admissionYear,
          departmentCode: student.tracks?.[0]?.departmentCode || 'CSE',
        })
      } catch (abeekErr) {
        console.warn('ABEEK evaluate-from-transcript failed', abeekErr)
      }

      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '업로드에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-ink-muted">
        성적 정보를 확인하는 중...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <BrandHeader />

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-2xl flex-col items-center px-6 pb-16 pt-14"
      >
        <UniversitySeal />
        <h1 className="mt-6 text-center text-3xl font-extrabold text-ink">
          {isUpdate ? '기이수성적 업데이트' : '기이수성적조회 엑셀 파일 업로드'}
        </h1>
        <p className="mt-3 text-center text-xs text-ink-muted">
          학사정보시스템 &gt; 수업/성적 &gt; 성적 및 강의 평가 &gt; 기이수성적조회 엑셀 다운로드
        </p>
        {isUpdate && (
          <p className="mt-2 text-center text-xs text-ink-faint">
            새 파일을 올리면 기존 기이수 성적 정보가 갱신됩니다.
          </p>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-10 w-full rounded-2xl px-6 py-14 text-center transition ${
            dragging ? 'bg-sejong-light ring-2 ring-sejong' : 'bg-panel'
          }`}
        >
          <p className="text-sm text-ink-muted">파일 형식 : XLSX</p>
          <p className="mt-1 text-sm text-ink-muted">파일 용량 : 최대 1MB</p>
          <p className="mt-3 text-xs text-ink-faint">*업로드한 파일은 서버에 별도로 저장되지 않음*</p>
          {file && <p className="mt-4 text-sm font-semibold text-sejong">{file.name}</p>}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />

        <p className="mt-5 text-sm font-medium text-ink">파일을 드래그하거나 클릭하여 선택해주세요!</p>
        {error && <p className="mt-3 text-sm text-sejong">{error}</p>}

        <button
          type="submit"
          disabled={!file || loading}
          className="mt-10 w-full max-w-md rounded-full bg-sejong py-3.5 text-base font-bold text-white transition hover:bg-sejong-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? '업로드 중...' : isUpdate ? '업데이트' : '완료'}
        </button>

        {isUpdate && (
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mt-3 text-sm font-medium text-ink-muted hover:text-sejong"
          >
            대시보드로 돌아가기
          </button>
        )}
      </form>
    </div>
  )
}
