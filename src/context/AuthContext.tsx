import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearAuthToken,
  getAuthorizationValue,
  saveAuthToken,
} from '../api/authToken'
import { logout as logoutRequest } from '../api/endpoints'
import type { StudentLoginResponse } from '../api/types'

const STORAGE_KEY = 'congraduation.student'
const ACTIVE_MAJOR_TRACK_KEY = 'congraduation.activeMajorTrack'

type AuthContextValue = {
  student: StudentLoginResponse | null
  setStudent: (student: StudentLoginResponse | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStudent(): StudentLoginResponse | null {
  try {
    if (!getAuthorizationValue()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StudentLoginResponse) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [student, setStudentState] = useState<StudentLoginResponse | null>(() => loadStudent())

  const setStudent = useCallback((next: StudentLoginResponse | null) => {
    if (next) {
      if (next.accessToken?.trim()) {
        saveAuthToken({
          accessToken: next.accessToken,
          tokenType: next.tokenType,
          tokenExpiresAt: next.tokenExpiresAt,
        })
      }

      const storedStudent = { ...next }
      delete storedStudent.accessToken
      delete storedStudent.tokenType
      delete storedStudent.tokenExpiresAt
      setStudentState(storedStudent)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedStudent))
      return
    }

    setStudentState(null)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(ACTIVE_MAJOR_TRACK_KEY)
    clearAuthToken()
  }, [])

  const logout = useCallback(() => {
    const authorization = getAuthorizationValue()
    setStudent(null)
    if (!authorization) return

    void logoutRequest({
      headers: { Authorization: authorization },
    }).catch(() => {
      // 서버 무효화 실패와 관계없이 로컬 세션은 종료한다.
    })
  }, [setStudent])

  const value = useMemo(() => ({ student, setStudent, logout }), [student, setStudent, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
