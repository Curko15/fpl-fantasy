import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import HomePage from './pages/HomePage'

// League pages pull in the charting library; keep them out of the home page bundle.
const LeagueLayout = lazy(() => import('./pages/LeagueLayout'))
const OverviewTab = lazy(() => import('./pages/OverviewTab'))
const TransfersTab = lazy(() => import('./pages/TransfersTab'))
const ChipsTab = lazy(() => import('./pages/ChipsTab'))
const AwardsTab = lazy(() => import('./pages/AwardsTab'))
const ManagerPage = lazy(() => import('./pages/ManagerPage'))
const ComparePage = lazy(() => import('./pages/ComparePage'))
const LivePage = lazy(() => import('./pages/LivePage'))

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/league/:leagueId" element={<LeagueLayout />}>
            <Route index element={<OverviewTab />} />
            <Route path="transfers" element={<TransfersTab />} />
            <Route path="chips" element={<ChipsTab />} />
            <Route path="awards" element={<AwardsTab />} />
            <Route path="manager/:entryId" element={<ManagerPage />} />
            <Route path="compare" element={<ComparePage />} />
            <Route path="live" element={<LivePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
