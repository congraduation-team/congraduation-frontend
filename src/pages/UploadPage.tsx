import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandHeader } from '../components/common/BrandHeader'
import { UniversitySeal } from '../components/common/UniversitySeal'

export function UploadPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const pickFile = (file?: File | null) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      alert('XLSX 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 1024 * 1024) {
      alert('파일 용량은 최대 1MB입니다.')
      return
    }
    setFileName(file.name)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    navigate('/dashboard')
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
          기이수성적조회 엑셀 파일 업로드
        </h1>
        <p className="mt-3 text-center text-xs text-ink-muted">
          학사정보시스템 &gt; 수업/성적 &gt; 성적 및 강의 평가 &gt; 기이수성적조회 엑셀 다운로드
        </p>

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
          {fileName && <p className="mt-4 text-sm font-semibold text-sejong">{fileName}</p>}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />

        <p className="mt-5 text-sm font-medium text-ink">파일을 드래그하거나 클릭하여 선택해주세요!</p>

        <button
          type="submit"
          className="mt-10 w-full max-w-md rounded-full bg-sejong py-3.5 text-base font-bold text-white transition hover:bg-sejong-dark"
        >
          완료
        </button>
      </form>
    </div>
  )
}
