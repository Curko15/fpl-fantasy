import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'

// League pages pull in the charting library; keep them out of the home page bundle.
const LeagueLayout = lazy(() => import('./pages/LeagueLayout'))
const OverviewTab = lazy(() => import('./pages/OverviewTab'))
const TransfersTab = lazy(() => import('./pages/TransfersTab'))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/league/:leagueId" element={<LeagueLayout />}>
            <Route index element={<OverviewTab />} />
            <Route path="transfers" element={<TransfersTab />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
