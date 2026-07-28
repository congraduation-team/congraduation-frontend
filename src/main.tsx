import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/auth/RequireAuth'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { AuthProvider } from './context/AuthContext'
import { CurriculumPage } from './pages/CurriculumPage'
import { EngineeringPage } from './pages/EngineeringPage'
import { GraduationPage } from './pages/GraduationPage'
import { LoginPage } from './pages/LoginPage'
import { MyCoursesPage } from './pages/MyCoursesPage'
import { UploadPage } from './pages/UploadPage'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<GraduationPage />} />
              <Route path="engineering" element={<EngineeringPage />} />
              <Route path="courses" element={<MyCoursesPage />} />
            </Route>
            <Route path="/curriculum" element={<CurriculumPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
