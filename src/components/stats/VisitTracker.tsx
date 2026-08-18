import { useEffect } from 'react'
import { recordSiteVisit } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'

/** 로그인 후 방문 1회 기록 (당일 동일 studentId는 BE에서 중복 무시) */
export function VisitTracker() {
  const { student } = useAuth()

  useEffect(() => {
    if (student?.id == null) return
    void recordSiteVisit({ studentId: student.id }).catch(() => {
      /* 통계 실패는 UX에 영향 없음 */
    })
  }, [student?.id])

  return null
}
