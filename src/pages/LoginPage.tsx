import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { getTranscriptStatus, login } from '../api/endpoints'
import { BrandHeader } from '../components/common/BrandHeader'
import { UniversitySeal } from '../components/common/UniversitySeal'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const navigate = useNavigate()
  const { setStudent } = useAuth()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!agreed || loading) return

    setLoading(true)
    setError(null)
    try {
      const student = await login(userId.trim(), password)
      setStudent(student)

      try {
        const status = await getTranscriptStatus(student.id)
        navigate(status.hasTranscript ? '/dashboard' : '/upload', { replace: true })
      } catch {
        navigate('/upload', { replace: true })
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : '로그인에 실패했습니다. 학번과 비밀번호를 확인해주세요.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <BrandHeader />

      <div className="mx-auto flex max-w-md flex-col items-center px-6 pb-16 pt-14">
        <UniversitySeal />
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-ink">SJU GRADUATION</h1>
        <p className="mt-2 text-sm text-ink-muted">hope you graduate soon</p>

        <form onSubmit={handleSubmit} className="mt-10 w-full space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">학번/아이디</span>
            <input
              type="text"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="학번을 입력해주세요."
              className="w-full rounded-lg bg-[#f3f4f6] px-4 py-3.5 text-sm outline-none ring-sejong placeholder:text-[#b0b5bd] focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">비밀번호</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="세종대학교 포털 비밀번호를 입력해주세요."
                className="w-full rounded-lg bg-[#f3f4f6] px-4 py-3.5 pr-12 text-sm outline-none ring-sejong placeholder:text-[#b0b5bd] focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"
                aria-label="비밀번호 표시"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  {showPassword ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                      <path d="M9.9 5.1A10.4 10.4 0 0112 5c5 0 9.3 3.1 11 7.5a11.8 11.8 0 01-4.2 5.1" />
                      <path d="M6.1 6.1A11.8 11.8 0 001 12.5C2.7 16.9 7 20 12 20a10.4 10.4 0 005.1-1.3" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5C21.3 16.9 17 20 12 20S2.7 16.9 1 12.5z" />
                      <circle cx="12" cy="12.5" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </label>

          <label className="flex items-center justify-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="size-4 accent-sejong"
            />
            개인정보 수집에 동의합니다.
          </label>

          {error && <p className="text-center text-sm text-sejong">{error}</p>}

          <button
            type="submit"
            disabled={!agreed || loading}
            className="w-full rounded-full bg-sejong py-3.5 text-base font-bold text-white transition hover:bg-sejong-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
