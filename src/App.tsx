import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { CurriculumPage } from './pages/CurriculumPage'
import { EngineeringPage } from './pages/EngineeringPage'
import { GraduationPage } from './pages/GraduationPage'
import { LoginPage } from './pages/LoginPage'
import { MyCoursesPage } from './pages/MyCoursesPage'
import { UploadPage } from './pages/UploadPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<GraduationPage />} />
          <Route path="engineering" element={<EngineeringPage />} />
          <Route path="courses" element={<MyCoursesPage />} />
        </Route>
        <Route path="/curriculum" element={<CurriculumPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
