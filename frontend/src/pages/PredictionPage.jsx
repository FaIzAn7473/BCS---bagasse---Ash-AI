import React, { useState, useCallback } from 'react'
import Plot from '../components/PlotlyChart'
import { predict } from '../api/client'
import './PredictionPage.css'

/* ── Plot config shared across all charts ─────────────────────── */
const PLOT_CONFIG = { displayModeBar: true, responsive: true }

const CHART_LAYOUT_BASE = {
  font: { family: 'Inter, system-ui, sans-serif', size: 12 },
  paper_bgcolor: 'transparent',
  plot_bgcolor: '#fafbfd',
  margin: { t: 50, r: 30, b: 60, l: 60 },
  xaxis: { gridcolor: '#e2e8f0', zeroline: false },
  yaxis: { gridcolor: '#e2e8f0', zeroline: false },
}

export default function PredictionPage() {
  const [ll, setLl] = useState('')
  const [pl, setPl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const pi = ll !== '' && pl !== '' ? (parseFloat(ll) - parseFloat(pl)).toFixed(2) : '—'
  const piValue = ll !== '' && pl !== '' ? parseFloat(ll) - parseFloat(pl) : null

  const validate = () => {
    const llV = parseFloat(ll)
    const plV = parseFloat(pl)
    if (isNaN(llV) || llV <= 0) return 'Please enter a valid Liquid Limit (LL) value.'
    if (isNaN(plV) || plV <= 0) return 'Please enter a valid Plastic Limit (PL) value.'
    if (plV >= llV) return 'Plastic Limit (PL) must be less than Liquid Limit (LL).'
    if (llV > 200 || plV > 200) return 'LL and PL values must be ≤ 200%.'
    return null
  }

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    setError(null)
    setResult(null)

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    try {
      const data = await predict(parseFloat(ll), parseFloat(pl))
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [ll, pl])

  /* ── Charts ──────────────────────────────────────────────────── */
  const buildCharts = (result) => {
    const { chart_data, optimum_ba, predicted_ucs, predicted_cbr } = result
    const { ba_values, ucs_values, cbr_values, score_values } = chart_data

    /* find optimum index */
    const optIdx = ba_values.findIndex((v) => Math.abs(v - optimum_ba) < 0.05)

    /* ── Chart 1: BA vs UCS ── */
    const chart1 = {
      data: [
        {
          x: ba_values, y: ucs_values,
          type: 'scatter', mode: 'lines',
          line: { color: '#0f4c81', width: 2.5 },
          name: 'Predicted UCS',
          hovertemplate: 'BA: %{x:.1f}%<br>UCS: %{y:.4f} MPa<extra></extra>',
        },
        {
          x: [optimum_ba], y: [predicted_ucs],
          type: 'scatter', mode: 'markers',
          marker: { color: '#e63946', size: 12, symbol: 'diamond' },
          name: `Optimum (${optimum_ba}%)`,
          hovertemplate: `Optimum BA: ${optimum_ba}%<br>UCS: ${predicted_ucs} MPa<extra></extra>`,
        },
      ],
      layout: {
        ...CHART_LAYOUT_BASE,
        title: { text: 'Bagasse Ash % vs Predicted UCS', font: { size: 14, weight: 600 } },
        xaxis: { ...CHART_LAYOUT_BASE.xaxis, title: { text: 'Bagasse Ash (%)' } },
        yaxis: { ...CHART_LAYOUT_BASE.yaxis, title: { text: 'Predicted UCS (MPa)' } },
        legend: { orientation: 'h', y: -0.2 },
        shapes: [
          { type: 'line', x0: optimum_ba, x1: optimum_ba,
            y0: 0, y1: 1, yref: 'paper',
            line: { color: '#e63946', width: 1.5, dash: 'dot' } },
        ],
      },
    }

    /* ── Chart 2: BA vs CBR ── */
    const chart2 = {
      data: [
        {
          x: ba_values, y: cbr_values,
          type: 'scatter', mode: 'lines',
          line: { color: '#1a6b4a', width: 2.5 },
          name: 'Predicted CBR',
          hovertemplate: 'BA: %{x:.1f}%<br>CBR: %{y:.4f}%<extra></extra>',
        },
        {
          x: [optimum_ba], y: [predicted_cbr],
          type: 'scatter', mode: 'markers',
          marker: { color: '#e63946', size: 12, symbol: 'diamond' },
          name: `Optimum (${optimum_ba}%)`,
          hovertemplate: `Optimum BA: ${optimum_ba}%<br>CBR: ${predicted_cbr}%<extra></extra>`,
        },
      ],
      layout: {
        ...CHART_LAYOUT_BASE,
        title: { text: 'Bagasse Ash % vs Predicted CBR', font: { size: 14, weight: 600 } },
        xaxis: { ...CHART_LAYOUT_BASE.xaxis, title: { text: 'Bagasse Ash (%)' } },
        yaxis: { ...CHART_LAYOUT_BASE.yaxis, title: { text: 'Predicted CBR (%)' } },
        legend: { orientation: 'h', y: -0.2 },
        shapes: [
          { type: 'line', x0: optimum_ba, x1: optimum_ba,
            y0: 0, y1: 1, yref: 'paper',
            line: { color: '#e63946', width: 1.5, dash: 'dot' } },
        ],
      },
    }

    /* ── Chart 3: BA vs Combined Score ── */
    const optScore = score_values[optIdx] ?? Math.max(...score_values)
    const chart3 = {
      data: [
        {
          x: ba_values, y: score_values,
          type: 'scatter', mode: 'lines',
          line: { color: '#7c3aed', width: 2.5 },
          fill: 'tozeroy', fillcolor: 'rgba(124,58,237,0.07)',
          name: 'Combined Strength Score',
          hovertemplate: 'BA: %{x:.1f}%<br>Score: %{y:.4f}<extra></extra>',
        },
        {
          x: [optimum_ba], y: [optScore],
          type: 'scatter', mode: 'markers',
          marker: { color: '#e63946', size: 12, symbol: 'diamond' },
          name: `Optimum (${optimum_ba}%)`,
          hovertemplate: `Optimum BA: ${optimum_ba}%<br>Score: ${optScore.toFixed(4)}<extra></extra>`,
        },
      ],
      layout: {
        ...CHART_LAYOUT_BASE,
        title: { text: 'Bagasse Ash % vs Combined Strength Score', font: { size: 14, weight: 600 } },
        xaxis: { ...CHART_LAYOUT_BASE.xaxis, title: { text: 'Bagasse Ash (%)' } },
        yaxis: { ...CHART_LAYOUT_BASE.yaxis, title: { text: 'Combined Strength Score (0–1)' } },
        legend: { orientation: 'h', y: -0.2 },
        shapes: [
          { type: 'line', x0: optimum_ba, x1: optimum_ba,
            y0: 0, y1: 1, yref: 'paper',
            line: { color: '#e63946', width: 1.5, dash: 'dot' } },
        ],
      },
    }

    return [chart1, chart2, chart3]
  }

  const charts = result ? buildCharts(result) : []

  return (
    <div className="pred-page">
      {/* ── Hero strip ─────────────────────────────────────────── */}
      <div className="pred-hero">
        <h1 className="pred-hero-title">AI Soil Stabilization Predictor</h1>
        <p className="pred-hero-desc">
          Enter the original Black Cotton Soil properties to predict the optimum
          Bagasse Ash content required for maximum soil strength.
        </p>
      </div>

      {/* ── Input card ─────────────────────────────────────────── */}
      <div className="card pred-input-card">
        <h2 className="card-heading">
          <span className="card-heading-icon">🧪</span>
          Black Cotton Soil Input
        </h2>
        <p className="card-desc">
          Enter the original untreated Black Cotton Soil Atterberg limits.
          Plasticity Index is calculated automatically.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="input-grid">
            {/* LL */}
            <div className="input-group">
              <label htmlFor="ll" className="input-label">
                Liquid Limit (LL) <span className="unit">%</span>
              </label>
              <input
                id="ll"
                type="number"
                className="input-field"
                placeholder="e.g. 52"
                min="0" max="200" step="0.1"
                value={ll}
                onChange={(e) => setLl(e.target.value)}
                required
              />
            </div>

            {/* PL */}
            <div className="input-group">
              <label htmlFor="pl" className="input-label">
                Plastic Limit (PL) <span className="unit">%</span>
              </label>
              <input
                id="pl"
                type="number"
                className="input-field"
                placeholder="e.g. 27"
                min="0" max="200" step="0.1"
                value={pl}
                onChange={(e) => setPl(e.target.value)}
                required
              />
            </div>

            {/* PI (auto) */}
            <div className="input-group">
              <label className="input-label">
                Plasticity Index (PI) <span className="unit">%</span>
                <span className="auto-tag">auto</span>
              </label>
              <div className={`pi-display ${piValue !== null && piValue <= 0 ? 'pi-display--error' : ''}`}>
                {piValue !== null && piValue <= 0
                  ? <span className="pi-error">PL ≥ LL — invalid</span>
                  : <span>{pi}</span>
                }
              </div>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn-primary predict-btn" disabled={loading}>
            {loading
              ? <><span className="btn-spinner" />Predicting…</>
              : <>⚙️ &nbsp;PREDICT OPTIMUM BAGASSE ASH</>
            }
          </button>
        </form>
      </div>

      {/* ── Results ────────────────────────────────────────────── */}
      {result && (
        <>
          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="warnings-block">
              {result.warnings.map((w, i) => (
                <div key={i} className="alert alert-warning">⚠️ &nbsp;{w}</div>
              ))}
            </div>
          )}

          {/* Within range badge */}
          <div className="range-row">
            {result.within_experimental_range
              ? <span className="badge badge-green">✓ Within experimental range (5–17%)</span>
              : <span className="badge badge-amber">⚠ Outside experimental range</span>
            }
            <span className="range-note">
              PI = {result.pi.toFixed(2)} % &nbsp;|&nbsp; LL = {parseFloat(ll).toFixed(1)}%
              &nbsp;|&nbsp; PL = {parseFloat(pl).toFixed(1)}%
            </span>
          </div>

          {/* Three result cards */}
          <div className="result-cards">
            <div className="result-card result-card--primary">
              <div className="rc-label">OPTIMUM BAGASSE ASH</div>
              <div className="rc-value">{result.optimum_ba.toFixed(1)}<span className="rc-unit">%</span></div>
              <div className="rc-note">Continuous AI prediction</div>
            </div>
            <div className="result-card result-card--ucs">
              <div className="rc-label">PREDICTED UCS</div>
              <div className="rc-value">{result.predicted_ucs.toFixed(3)}<span className="rc-unit">MPa</span></div>
              <div className="rc-note">At optimum BA content</div>
            </div>
            <div className="result-card result-card--cbr">
              <div className="rc-label">PREDICTED CBR</div>
              <div className="rc-value">{result.predicted_cbr.toFixed(2)}<span className="rc-unit">%</span></div>
              <div className="rc-note">At optimum BA content</div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-section">
            <h2 className="section-heading">Engineering Response Curves</h2>
            <p className="section-desc">
              AI-predicted strength behaviour across the full Bagasse Ash range (0–20%).
              The red diamond marks the predicted optimum.
            </p>

            <div className="charts-grid">
              {charts.map((ch, idx) => (
                <div key={idx} className="card chart-card">
                  <Plot
                    data={ch.data}
                    layout={{ ...ch.layout, autosize: true }}
                    config={PLOT_CONFIG}
                    style={{ width: '100%', height: '360px' }}
                    useResizeHandler
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="alert alert-info disclaimer">
            ℹ️ &nbsp;These predictions are generated by a trained machine-learning regression model
            using existing experimental and literature data. All results must be validated with
            actual laboratory testing before use in any engineering design.
          </div>
        </>
      )}
    </div>
  )
}
