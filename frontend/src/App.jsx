import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import PredictionPage from './pages/PredictionPage'
import DatasetPage from './pages/DatasetPage'
import ModelPerformancePage from './pages/ModelPerformancePage'
import AboutPage from './pages/AboutPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"              element={<PredictionPage />} />
        <Route path="/dataset"       element={<DatasetPage />} />
        <Route path="/performance"   element={<ModelPerformancePage />} />
        <Route path="/about"         element={<AboutPage />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
