import { apiForm, apiJson } from './client'
import type {
  GraduationProgressResponse,
  StudentLoginResponse,
  TranscriptStatusResponse,
  TranscriptUploadResponse,
} from './types'

export function login(userId: string, password: string) {
  return apiJson<StudentLoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ userId, password }),
  })
}

export function getTranscriptStatus(studentId: number) {
  return apiJson<TranscriptStatusResponse>(`/api/transcripts/status/${studentId}`)
}

export function uploadTranscript(studentId: number, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiForm<TranscriptUploadResponse>(`/api/transcripts/upload/${studentId}`, form)
}

export function getGraduationProgress(studentId: number) {
  return apiJson<GraduationProgressResponse>(`/api/evaluate/graduation-progress/${studentId}`)
}
