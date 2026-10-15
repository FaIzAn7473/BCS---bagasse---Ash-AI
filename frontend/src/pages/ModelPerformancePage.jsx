import React, { useEffect, useState } from 'react'
import Plot from '../components/PlotlyChart'
import { getModelPerformance } from '../api/client'
import './ModelPerformancePage.css'

const PLOT_CONFIG = { displayModeBar: true, responsive: true }

const LAYOUT_BASE = {
  font: { family: 'Inter, system-ui, sans-serif', size: 12 },
  paper_bgcolor: 'transparent',
  plot_bgcolor: '#fafbfd',
  margin: { t: 50, r: 30, b: 60, l: 60 },
  xaxis: { gridcolor: '#e2e8f0', zeroline: false },
  yaxis: { gridcolor: '#e2e8f0', zeroline: false },
}

function MetricCard({ label, value, unit = '', note }) {
  return (
    <div className="metric-card">
      <div className="mc-label">{label}</div>
      <div className="mc-value">{value}<span className="mc-unit">{unit}</span></div>
      {note && <div className="mc-note">{note}</div>}
    </div>
  )
}

function ScatterChart({ actual, predicted, title, color, unit }) {
  if (!actual || !predicted) return null

  /* perfect-fit reference line */
  const allVals = [...actual, ...predicted]
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)

  return (
    <div className="card chart-card-perf">
      <Plot
        data={[
          {
            x: actual, y: predicted,
            type: 'scatter', mode: 'markers',
            marker: { color, size: 9, opacity: 0.8, line: { width: 1, color: '#fff' } },
            name: 'Data points',
            hovertemplate: `Actual: %{x:.4f} ${unit}<br>Predicted: %{y:.4f} ${unit}<extra></extra>`,
          },
          {
            x: [minV, maxV], y: [minV, maxV],
            type: 'scatter', mode: 'lines',
            line: { color: '#94a3b8', width: 1.5, dash: 'dash' },
            name: 'Perfect fit (y = x)',
            hoverinfo: 'skip',
          },
        ]}
        layout={{
          ...LAYOUT_BASE,
          title: { text: title, font: { size: 14 } },
          xaxis: { ...LAYOUT_BASE.xaxis, title: { text: `Actual ${unit}` } },
          yaxis: { ...LAYOUT_BASE.yaxis, title: { text: `CV Predicted ${unit}` } },
          legend: { orientation: 'h', y: -0.22 },
          autosize: true,
        }}
        config={PLOT_CONFIG}
        style={{ width: '100%', height: '380px' }}
        useResizeHandler
      />
    </div>
  )
}

export default function ModelPerformancePage() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getModelPerformance()
      .then(setMetrics)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="perf-page">
      <div className="perf-hero">
        <h1 className="perf-title">Model Performance</h1>
        <p className="perf-desc">
          Evaluation metrics and cross-validation results for the UCS and CBR
          regression models. Cross-validation R² is the primary reliability indicator.
        </p>
      </div>

      {loading && <div className="spinner" />}

      {error && (
        <div className="alert alert-error">
          <strong>Could not load model metrics.</strong><br />
          {error}<br />
          <span style={{ fontSize: 13, marginTop: 6, display: 'block' }}>
            Make sure you have run: <code className="inline-code">python backend/train_model.py</code>
          </span>
        </div>
      )}

      {metrics && (
        <>
          {/* Dataset info */}
          <div className="alert alert-info" style={{ marginBottom: 24 }}>
            ℹ️ &nbsp;Models trained on <strong>{metrics.num_rows}</strong> validated records.
            Cross-validation R² is reported as mean ± std across folds —
            this is the reliable generalization estimate.
          </div>

          {/* ── UCS section ── */}
          <section className="model-section">
            <div className="model-section-head">
              <div>
                <h2 className="model-section-title">UCS Model</h2>
                <p className="model-section-sub">
                  Unconfined Compressive Strength Prediction &nbsp;·&nbsp;
                  Algorithm: <strong>{metrics.ucs?.algorithm}</strong>
                </p>
              </div>
            </div>

            <div className="metrics-grid">
              <MetricCard
                label="Cross-Val R²"
                value={metrics.ucs?.cv_r2_mean}
                note={`± ${metrics.ucs?.cv_r2_std} std`}
              />
              <MetricCard
                label="Train R²"
                value={metrics.ucs?.train_r2}
                note="Full-dataset fit"
              />
              <MetricCard
                label="Train MAE"
                value={metrics.ucs?.train_mae}
                unit=" MPa"
                note="Mean Absolute Error"
              />
              <MetricCard
                label="Train RMSE"
                value={metrics.ucs?.train_rmse}
                unit=" MPa"
                note="Root Mean Sq. Error"
              />
            </div>

            <ScatterChart
              actual={metrics.ucs?.actual}
              predicted={metrics.ucs?.cv_predicted}
              title="UCS: Actual vs Cross-Val Predicted"
              color="#0f4c81"
              unit="MPa"
            />
          </section>

          <hr className="divider" />

          {/* ── CBR section ── */}
          <section className="model-section">
            <div className="model-section-head">
              <div>
                <h2 className="model-section-title">CBR Model</h2>
                <p className="model-section-sub">
                  California Bearing Ratio Prediction &nbsp;·&nbsp;
                  Algorithm: <strong>{metrics.cbr?.algorithm}</strong>
                </p>
              </div>
            </div>

            <div className="metrics-grid">
              <MetricCard
                label="Cross-Val R²"
                value={metrics.cbr?.cv_r2_mean}
                note={`± ${metrics.cbr?.cv_r2_std} std`}
              />
              <MetricCard
                label="Train R²"
                value={metrics.cbr?.train_r2}
                note="Full-dataset fit"
              />
              <MetricCard
                label="Train MAE"
                value={metrics.cbr?.train_mae}
                unit=" %"
                note="Mean Absolute Error"
              />
              <MetricCard
                label="Train RMSE"
                value={metrics.cbr?.train_rmse}
                unit=" %"
                note="Root Mean Sq. Error"
              />
            </div>

            <ScatterChart
              actual={metrics.cbr?.actual}
              predicted={metrics.cbr?.cv_predicted}
              title="CBR: Actual vs Cross-Val Predicted"
              color="#1a6b4a"
              unit="%"
            />
          </section>

          {/* Disclaimer */}
          <div className="alert alert-warning" style={{ marginTop: 24 }}>
            ⚠️ &nbsp;<strong>Interpretation note:</strong> Train R² reflects fit on training data
            and should not be presented as prediction accuracy.
            Cross-validation R² is the appropriate generalization metric.
            With small datasets, performance estimates carry higher uncertainty.
          </div>
        </>
      )}
    </div>
  )
}
