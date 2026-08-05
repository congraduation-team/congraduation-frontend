import { useEffect } from 'react'
import { recordSiteVisit } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'
import { getOrCreateVisitorKey } from '../../utils/visitorKey'

/** 앱 진입 시 방문 1회 기록 (당일 동일 키는 BE에서 중복 무시) */
export function VisitTracker() {
  const { student } = useAuth()

  useEffect(() => {
    const visitorKey = getOrCreateVisitorKey()
    void recordSiteVisit({
      visitorKey,
      ...(student?.id != null ? { studentId: student.id } : {}),
    }).catch(() => {
      /* 통계 실패는 UX에 영향 없음 */
    })
  }, [student?.id])

  return null
}
