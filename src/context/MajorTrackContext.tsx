import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getStudentMajorTracks } from '../api/endpoints'
import type { MajorTrackProgress, StudentLoginResponse } from '../api/types'
import { useAuth } from './AuthContext'
import { buildTrackOptions, type TrackOption } from '../utils/majorTrack'

const STORAGE_KEY = 'congraduation.activeMajorTrack'

type MajorTrackContextValue = {
  options: TrackOption[]
  active: TrackOption | null
  setActiveKey: (key: string) => void
  majorTracksProgress: MajorTrackProgress[]
  setMajorTracksProgress: (tracks: MajorTrackProgress[]) => void
  refreshTracks: (override?: StudentLoginResponse) => Promise<void>
}

const MajorTrackContext = createContext<MajorTrackContextValue | null>(null)

export function MajorTrackProvider({ children }: { children: ReactNode }) {
  const { student, setStudent } = useAuth()
  const [majorTracksProgress, setMajorTracksProgress] = useState<MajorTrackProgress[]>([])
  const [activeKey, setActiveKeyState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })

  const options = useMemo(
    () => buildTrackOptions(student, majorTracksProgress),
    [student, majorTracksProgress],
  )

  const active = useMemo(() => {
    if (options.length === 0) return null
    return options.find((o) => o.key === activeKey) ?? options[0]
  }, [options, activeKey])

  const setActiveKey = useCallback((key: string) => {
    setActiveKeyState(key)
    try {
      localStorage.setItem(STORAGE_KEY, key)
    } catch {
      // ignore
    }
  }, [])

  const studentRef = useRef(student)
  studentRef.current = student

  const refreshTracks = useCallback(async (override?: StudentLoginResponse) => {
    const current = override ?? studentRef.current
    if (!current) return
    try {
      const data = await getStudentMajorTracks(current.id)
      const majorType =
        current.majorType === 'SINGLE' ? 'SINGLE' : (data.majorType ?? current.majorType)
      const isPrimaryOnly = !majorType || majorType === 'SINGLE'
      setStudent({
        ...current,
        major: data.primaryMajor ?? current.major,
        majorType,
        secondaryMajor: isPrimaryOnly ? undefined : data.secondaryMajor || undefined,
        tracks: isPrimaryOnly ? [] : (data.tracks ?? current.tracks),
      })
      if (isPrimaryOnly) {
        setMajorTracksProgress([])
        if (current.major) setActiveKey(`primary:${current.major}`)
      }
    } catch {
      // keep existing student
    }
  }, [setStudent, setActiveKey])

  useEffect(() => {
    if (!student) return
    void refreshTracks()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on student id change
  }, [student?.id])

  useEffect(() => {
    if (options.length === 0) return
    if (!activeKey || !options.some((o) => o.key === activeKey)) {
      setActiveKey(options[0].key)
    }
  }, [options, activeKey, setActiveKey])

  const value = useMemo(
    () => ({
      options,
      active,
      setActiveKey,
      majorTracksProgress,
      setMajorTracksProgress,
      refreshTracks,
    }),
    [options, active, setActiveKey, majorTracksProgress, refreshTracks],
  )

  return <MajorTrackContext.Provider value={value}>{children}</MajorTrackContext.Provider>
}

export function useMajorTrack() {
  const ctx = useContext(MajorTrackContext)
  if (!ctx) throw new Error('useMajorTrack must be used within MajorTrackProvider')
  return ctx
}
