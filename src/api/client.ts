import { getAuthorizationValue } from './authToken'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function parseError(res: Response) {
  let body: unknown
  const text = await res.text().catch(() => '')
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  let message = `요청 실패 (${res.status})`
  if (typeof body === 'object' && body) {
    const record = body as Record<string, unknown>
    if (typeof record.message === 'string' && record.message.trim()) {
      message = record.message
    } else if (typeof record.error === 'string' && record.error.trim()) {
      message = record.error
    } else if (typeof record.detail === 'string' && record.detail.trim()) {
      message = record.detail
    }
  } else if (typeof body === 'string' && body.trim()) {
    message = body.trim().slice(0, 300)
  }

  throw new ApiError(res.status, message, body)
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  if (!(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const authorization = getAuthorizationValue()
  if (authorization) {
    headers.set('Authorization', authorization)
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })
  if (!res.ok) await parseError(res)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function apiForm<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  const authorization = getAuthorizationValue()
  if (authorization) {
    headers.set('Authorization', authorization)
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    ...init,
    headers,
    body: formData,
  })
  if (!res.ok) await parseError(res)
  return res.json() as Promise<T>
}
