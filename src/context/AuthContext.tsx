import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { StudentLoginResponse } from '../api/types'

const STORAGE_KEY = 'congraduation.student'

type AuthContextValue = {
  student: StudentLoginResponse | null
  setStudent: (student: StudentLoginResponse | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStudent(): StudentLoginResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StudentLoginResponse) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [student, setStudentState] = useState<StudentLoginResponse | null>(() => loadStudent())

  const setStudent = useCallback((next: StudentLoginResponse | null) => {
    setStudentState(next)
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  const logout = useCallback(() => setStudent(null), [setStudent])

  const value = useMemo(() => ({ student, setStudent, logout }), [student, setStudent, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
