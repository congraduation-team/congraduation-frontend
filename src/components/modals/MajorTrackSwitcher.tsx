import { useEffect, useState } from 'react'
import { getMajorOptions, updateStudentMajorTrack } from '../../api/endpoints'
import type { MajorType, StudentLoginResponse } from '../../api/types'
import { useAuth } from '../../context/AuthContext'
import { useMajorTrack } from '../../context/MajorTrackContext'
import { trackTypeLabel } from '../../utils/majorTrack'
import { Modal } from './Modal'

const ADDITIONAL_TYPES: MajorType[] = [
  'DOUBLE',
  'MINOR',
  'SECOND_MAJOR',
  'LINKED_FUSION',
  'SELF_DESIGNED',
]

function normalizeMajorType(type?: MajorType | null): MajorType {
  if (!type) return 'SINGLE'
  return type === 'DOUBLE_MAJOR' ? 'DOUBLE' : type
}

export function MajorTrackSwitcher() {
  const { student, setStudent } = useAuth()
  const { options, active, setActiveKey, setMajorTracksProgress, refreshTracks } = useMajorTrack()
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (!student) return null

  const showSwitcher = options.length > 1

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showSwitcher && (
        <div className="flex overflow-hidden rounded-full border border-[#e5e7eb] bg-white">
          {options.map((opt) => {
            const selected = active?.key === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setActiveKey(opt.key)}
                className={`px-3.5 py-1.5 text-xs font-semibold transition ${
                  selected ? 'bg-sejong text-white' : 'text-ink hover:bg-panel'
                }`}
              >
                {trackTypeLabel(opt.trackType)} · {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {!showSwitcher && student.major && (
        <span className="rounded-full bg-panel px-3 py-1.5 text-xs font-semibold text-ink-muted">
          {trackTypeLabel(student.majorType)} · {student.major}
        </span>
      )}

      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-panel"
      >
        복수전공 설정
      </button>

      <MajorTrackSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={async (next) => {
          const majorType = normalizeMajorType(next.majorType)
          const normalized: StudentLoginResponse =
            majorType === 'SINGLE'
              ? { ...next, majorType: 'SINGLE', secondaryMajor: undefined, tracks: [] }
              : { ...next, majorType, secondaryMajor: next.secondaryMajor || undefined }
          setStudent(normalized)
          if (majorType === 'SINGLE') {
            setMajorTracksProgress([])
            if (normalized.major) setActiveKey(`primary:${normalized.major}`)
          }
          await refreshTracks(normalized)
          setSettingsOpen(false)
        }}
      />
    </div>
  )
}

function MajorTrackSettingsModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: (student: StudentLoginResponse) => void | Promise<void>
}) {
  const { student } = useAuth()
  const [mode, setMode] = useState<'primary' | 'additional'>('primary')
  const [majorType, setMajorType] = useState<MajorType>('DOUBLE')
  const [secondaryMajor, setSecondaryMajor] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !student) return
    const currentType = normalizeMajorType(student.majorType)
    const hasSecondary = Boolean(student.secondaryMajor) && currentType !== 'SINGLE'
    setMode(hasSecondary ? 'additional' : 'primary')
    setMajorType(hasSecondary ? currentType : 'DOUBLE')
    setSecondaryMajor(student.secondaryMajor || '')
    setError(null)
    ;(async () => {
      try {
        const list = await getMajorOptions()
        setOptions(list.map((o) => o.name).filter(Boolean))
      } catch {
        setOptions(
          [student.major, student.secondaryMajor].filter((v): v is string => Boolean(v)),
        )
      }
    })()
  }, [open, student])

  if (!student) return null

  const currentSecondaryLabel = student.secondaryMajor
    ? `${trackTypeLabel(student.majorType)} · ${student.secondaryMajor}`
    : ''

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const next = await updateStudentMajorTrack(
        student.id,
        mode === 'primary'
          ? {
              majorType: 'SINGLE',
              secondaryMajor: null,
              tracks: [],
            }
          : {
              majorType,
              secondaryMajor,
              tracks: [
                {
                  trackType: majorType,
                  departmentCode: secondaryMajor,
                },
              ],
            },
      )
      await onSaved(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : '전공 트랙 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="복수전공 설정" subtitle="주전공만 쓰거나 추가 트랙을 설정합니다">
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">사용 방식</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('primary')}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                mode === 'primary'
                  ? 'border-sejong bg-sejong-light text-sejong'
                  : 'border-[#e5e7eb] bg-white text-ink hover:bg-panel'
              }`}
            >
              <p className="text-sm font-bold">주전공만</p>
              <p className="mt-0.5 text-[11px] font-medium opacity-80">추가 트랙 없이 주전공만 봅니다</p>
            </button>
            <button
              type="button"
              onClick={() => setMode('additional')}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                mode === 'additional'
                  ? 'border-sejong bg-sejong-light text-sejong'
                  : 'border-[#e5e7eb] bg-white text-ink hover:bg-panel'
              }`}
            >
              <p className="text-sm font-bold">추가 트랙</p>
              <p className="mt-0.5 text-[11px] font-medium opacity-80">복수전공·부전공 등을 설정합니다</p>
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-panel px-4 py-3">
          <p className="text-xs font-semibold text-ink-muted">주전공</p>
          <p className="mt-1 text-sm font-bold text-ink">{student.major}</p>
        </div>

        {mode === 'primary' && currentSecondaryLabel && (
          <p className="rounded-xl bg-sejong-light px-4 py-3 text-sm leading-relaxed text-sejong">
            현재 <span className="font-bold">{currentSecondaryLabel}</span>이 설정되어 있습니다.
            저장하면 주전공만 사용하도록 해제됩니다.
          </p>
        )}

        {mode === 'additional' && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">추가 트랙 유형</span>
              <select
                value={majorType}
                onChange={(e) => setMajorType(e.target.value as MajorType)}
                className="w-full rounded-lg border border-[#e5e7eb] bg-panel px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sejong/30"
              >
                {ADDITIONAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {trackTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">
                {trackTypeLabel(majorType)} 학과
              </span>
              <select
                value={secondaryMajor}
                onChange={(e) => setSecondaryMajor(e.target.value)}
                className="w-full rounded-lg border border-[#e5e7eb] bg-panel px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sejong/30"
              >
                <option value="">선택하세요</option>
                {options
                  .filter((name) => name !== student.major)
                  .map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}

        {error && <p className="text-sm text-sejong">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-ink"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || (mode === 'additional' && !secondaryMajor)}
            className="rounded-full bg-sejong px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? '저장 중...' : mode === 'primary' ? '주전공만 저장' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
