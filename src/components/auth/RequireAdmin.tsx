import { Navigate, Outlet } from 'react-router-dom'
import { isAdminUser } from '../../api/types'
import { useAuth } from '../../context/AuthContext'

export function RequireAdmin() {
  const { student } = useAuth()

  if (!isAdminUser(student)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
