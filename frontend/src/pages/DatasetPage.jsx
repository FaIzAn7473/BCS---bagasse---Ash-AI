import React, { useState, useEffect, useRef } from 'react'
import { getDatasetSummary, uploadDataset } from '../api/client'
import './DatasetPage.css'

const COLUMNS = ['LL', 'PL', 'PI', 'BA_Percentage', 'MDD', 'OMC', 'UCS', 'CBR']
const COL_LABELS = {
  LL: 'LL (%)', PL: 'PL (%)', PI: 'PI (%)',
  BA_Percentage: 'BA (%)', MDD: 'MDD (g/cc)',
  OMC: 'OMC (%)', UCS: 'UCS (MPa)', CBR: 'CBR (%)',
}

export default function DatasetPage() {
  const [summary, setSummary] = useState(null)
  const [loadingData, setLoadingData] = useState(true)
  const [dataError, setDataError] = useState(null)

  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const fileRef = useRef()

  const fetchSummary = async () => {
    setLoadingData(true)
    setDataError(null)
    try {
      const data = await getDatasetSummary()
      setSummary(data)
    } catch (err) {
      setDataError(err.message)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => { fetchSummary() }, [])

  const handleUpload = async (e) => {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { setUploadError('Please select a CSV file.'); return }
    if (!file.name.endsWith('.csv')) { setUploadError('Only CSV files are accepted.'); return }

    setUploading(true)
    setUploadMsg(null)
    setUploadError(null)

    try {
      const res = await uploadDataset(file)
      setUploadMsg(res.message || 'Dataset uploaded successfully.')
      fileRef.current.value = ''
      fetchSummary()
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = () => {
    window.open('/api/download-dataset', '_blank')
  }

  return (
    <div className="ds-page">
      <div className="ds-hero">
        <h1 className="ds-title">Dataset</h1>
        <p className="ds-desc">
          Manage the training dataset used for AI model development. Upload new validated
          experimental data or view the current dataset.
        </p>
      </div>

      {/* ── Upload card ──────────────────────────────────────── */}
      <div className="card ds-upload-card">
        <h2 className="card-heading">
          <span className="card-heading-icon">📂</span>
          Upload Dataset
        </h2>
        <p className="card-desc">
          Upload a CSV file with the following required columns:&nbsp;
          <code className="inline-code">LL, PL, PI, BA_Percentage, MDD, OMC, UCS, CBR</code>.
          PI will be recalculated automatically from LL − PL.
        </p>

        {/* Required columns reference */}
        <div className="col-chips">
          {COLUMNS.map((c) => (
            <span key={c} className="col-chip">{c}</span>
          ))}
        </div>

        <form onSubmit={handleUpload} className="upload-form">
          <label className="file-drop">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="file-input"
              onChange={() => { setUploadError(null); setUploadMsg(null) }}
            />
            <div className="file-drop-inner">
              <span className="file-icon">📄</span>
              <span className="file-text">Click to select a CSV file</span>
              <span className="file-hint">.csv format only</span>
            </div>
          </label>

          {uploadError && <div className="alert alert-error">{uploadError}</div>}
          {uploadMsg   && (
            <div className="alert alert-success">
              ✓ &nbsp;{uploadMsg}
              <div className="mt-4" style={{ fontSize: 13, color: '#166534' }}>
                After uploading, retrain the models by running:&nbsp;
                <code className="inline-code">python backend/train_model.py</code>
              </div>
            </div>
          )}

          <div className="upload-actions">
            <button type="submit" className="btn-primary" disabled={uploading} style={{ width: 'auto', padding: '12px 28px' }}>
              {uploading ? <><span className="btn-spinner" />Uploading…</> : '⬆ Upload & Validate'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleDownload}>
              ⬇ Download Current
            </button>
          </div>
        </form>
      </div>

      {/* ── Dataset summary ──────────────────────────────────── */}
      {loadingData && <div className="spinner" />}

      {dataError && (
        <div className="alert alert-error">
          Could not load dataset: {dataError}
        </div>
      )}

      {summary && (
        <>
          {/* Warnings from validation */}
          {summary.warnings?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {summary.warnings.map((w, i) => (
                <div key={i} className="alert alert-warning">⚠️ &nbsp;{w}</div>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="card ds-stats-card">
            <h2 className="card-heading">
              <span className="card-heading-icon">📊</span>
              Dataset Summary
              <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>
                {summary.num_records} Records
              </span>
            </h2>

            <div className="stat-grid ds-stat-grid">
              {[
                { key: 'LL',           label: 'Liquid Limit (LL)',       unit: '%' },
                { key: 'PL',           label: 'Plastic Limit (PL)',      unit: '%' },
                { key: 'PI',           label: 'Plasticity Index (PI)',   unit: '%' },
                { key: 'BA_Percentage',label: 'Bagasse Ash',             unit: '%' },
                { key: 'MDD',          label: 'MDD',                     unit: 'g/cc' },
                { key: 'OMC',          label: 'OMC',                     unit: '%' },
                { key: 'UCS',          label: 'UCS',                     unit: 'MPa' },
                { key: 'CBR',          label: 'CBR',                     unit: '%' },
              ].map(({ key, label, unit }) => (
                <div key={key} className="stat-item">
                  <div className="stat-label">{label}</div>
                  <div className="stat-value">
                    {summary[key]?.min} – {summary[key]?.max}
                  </div>
                  <div className="stat-sub">{unit} &nbsp;|&nbsp; mean: {summary[key]?.mean}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Data table */}
          <div className="card ds-table-card">
            <div className="table-header-row">
              <h2 className="card-heading" style={{ marginBottom: 0 }}>
                <span className="card-heading-icon">🗂</span>
                Dataset Records
              </h2>
              <span className="badge badge-blue">{summary.records?.length} rows shown</span>
            </div>

            <div className="data-table-wrap mt-6">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {COLUMNS.map((c) => <th key={c}>{COL_LABELS[c]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {summary.records?.map((row, i) => (
                    <tr key={i}>
                      <td style={{ color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                      {COLUMNS.map((c) => (
                        <td key={c}>{row[c] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
