const ACCESS_TOKEN_KEY = 'congraduation.accessToken'
const TOKEN_TYPE_KEY = 'congraduation.tokenType'
const TOKEN_EXPIRES_AT_KEY = 'congraduation.tokenExpiresAt'

export type AuthToken = {
  accessToken: string
  tokenType?: string
  tokenExpiresAt?: number
}

export function saveAuthToken(token: AuthToken) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token.accessToken)
  localStorage.setItem(TOKEN_TYPE_KEY, token.tokenType?.trim() || 'Bearer')

  if (token.tokenExpiresAt != null) {
    localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(token.tokenExpiresAt))
  } else {
    localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
  }
}

export function clearAuthToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(TOKEN_TYPE_KEY)
  localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
}

export function getAuthorizationValue(): string | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)?.trim()
  if (!accessToken) return null

  const rawExpiresAt = localStorage.getItem(TOKEN_EXPIRES_AT_KEY)
  const expiresAt = rawExpiresAt ? Number(rawExpiresAt) : null
  if (expiresAt != null && Number.isFinite(expiresAt) && Date.now() >= expiresAt * 1000) {
    clearAuthToken()
    return null
  }

  const tokenType = localStorage.getItem(TOKEN_TYPE_KEY)?.trim() || 'Bearer'
  return `${tokenType} ${accessToken}`
}
