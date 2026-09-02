import { useEffect, useState } from 'react'
import { getStudentRoadmap, getStudentRoadmapByStudent } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { useMajorTrack } from '../context/MajorTrackContext'

/** 로그인 학생(또는 선택 트랙) 학과의 공학인증 대상 여부 */
export function useAbeekTarget() {
  const { student } = useAuth()
  const { active } = useMajorTrack()
  const [abeekTarget, setAbeekTarget] = useState<boolean | null>(null)

  const department = active?.department || student?.major || ''

  useEffect(() => {
    if (!student?.id || !department) {
      setAbeekTarget(null)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const data =
          !active?.department || active.department === student.major
            ? await getStudentRoadmapByStudent(student.id)
            : await getStudentRoadmap(active.department, student.id)
        if (!cancelled) setAbeekTarget(data.abeekTarget === true)
      } catch {
        if (!cancelled) setAbeekTarget(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [student?.id, student?.major, active?.department, department])

  return {
    abeekTarget: abeekTarget === true,
    loading: abeekTarget === null && Boolean(student?.id && department),
  }
}
