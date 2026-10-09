import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { PaperDetailPage } from './pages/PaperDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'

export function App() {
  return <BrowserRouter basename={import.meta.env.BASE_URL}><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/paper/:arxivId" element={<PaperDetailPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes></BrowserRouter>
}
