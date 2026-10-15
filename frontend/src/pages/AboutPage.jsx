import React from 'react'
import './AboutPage.css'

const TESTS = [
  { icon: '💧', name: 'Liquid Limit (LL)',         desc: 'Atterberg limit defining transition between liquid and plastic states.' },
  { icon: '🧱', name: 'Plastic Limit (PL)',         desc: 'Atterberg limit defining transition between plastic and semi-solid states.' },
  { icon: '🔢', name: 'Plasticity Index (PI)',       desc: 'Numerical difference between LL and PL — key soil plasticity indicator.' },
  { icon: '⚖️', name: 'Proctor Compaction / MDD',   desc: 'Maximum Dry Density achieved at Optimum Moisture Content.' },
  { icon: '💦', name: 'Optimum Moisture Content (OMC)', desc: 'Moisture content at which maximum dry density is achieved.' },
  { icon: '🏗️', name: 'UCS — Unconfined Compressive Strength', desc: 'Measure of stabilized soil strength under axial loading.' },
  { icon: '🛣️', name: 'CBR — California Bearing Ratio',       desc: 'Pavement subgrade bearing capacity indicator.' },
]

const BA_PERCENTAGES = ['5%', '8%', '11%', '14%', '17%']

const AI_STEPS = [
  'Enter original Black Cotton Soil LL and PL',
  'PI is automatically calculated (PI = LL − PL)',
  'AI model sweeps Bagasse Ash % from 0 to 20% in 0.1% steps',
  'Predicts UCS and CBR at each candidate BA percentage',
  'Computes combined normalised strength score',
  'Returns the BA % with the highest combined score as the optimum',
]

export default function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-hero">
        <h1 className="about-title">About the Project</h1>
        <p className="about-desc">
          A summary of the research objectives, materials, laboratory programme,
          and AI prediction methodology.
        </p>
      </div>

      {/* ── Project overview ─────────────────────────────── */}
      <div className="card about-card">
        <h2 className="about-section-head">Project Overview</h2>
        <div className="about-kv-grid">
          <AboutKV label="Project Title"  value="AI-Based Optimization of Bagasse Ash for Black Cotton Soil Stabilization" />
          <AboutKV label="Soil Type"      value="Black Cotton Soil (BCS)" />
          <AboutKV label="Stabilizer"     value="Sugarcane Bagasse Ash (BA)" />
          <AboutKV label="Soil Condition" value="Original untreated properties used as model input" />
          <AboutKV label="Objective"
            value="Predict the optimum Bagasse Ash percentage based on original soil Liquid Limit and Plastic Limit, and estimate the resulting soil strength (UCS and CBR) at that optimum." />
        </div>
      </div>

      {/* ── BA percentages ───────────────────────────────── */}
      <div className="card about-card">
        <h2 className="about-section-head">Laboratory Bagasse Ash Percentages</h2>
        <p className="about-body-text">
          The following Bagasse Ash percentages are used in the laboratory testing programme
          to generate experimental data for model training and validation:
        </p>
        <div className="ba-chips">
          {BA_PERCENTAGES.map((p) => (
            <span key={p} className="ba-chip">{p}</span>
          ))}
        </div>
        <p className="about-note">
          The AI model predicts a continuous optimum BA value (e.g. 7.6%, 10.4%) and is
          not restricted to these discrete percentages. These are the experimental
          test points used to train and validate the model.
        </p>
      </div>

      {/* ── Laboratory tests ─────────────────────────────── */}
      <div className="card about-card">
        <h2 className="about-section-head">Laboratory Tests</h2>
        <div className="tests-list">
          {TESTS.map((t) => (
            <div key={t.name} className="test-item">
              <span className="test-icon">{t.icon}</span>
              <div>
                <div className="test-name">{t.name}</div>
                <div className="test-desc">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── AI methodology ───────────────────────────────── */}
      <div className="card about-card">
        <h2 className="about-section-head">AI Prediction Methodology</h2>
        <p className="about-body-text">
          The AI system uses supervised machine-learning regression to learn the
          relationship between soil properties, Bagasse Ash content, and the resulting
          strength parameters.
        </p>
        <div className="ai-steps">
          {AI_STEPS.map((step, i) => (
            <div key={i} className="ai-step">
              <span className="ai-step-num">{i + 1}</span>
              <span className="ai-step-text">{step}</span>
            </div>
          ))}
        </div>
        <div className="alert alert-info" style={{ marginTop: 20 }}>
          ℹ️ &nbsp;The optimization criterion is a combined normalised strength score:
          &nbsp;<strong>Score = 0.5 × normalised UCS + 0.5 × normalised CBR</strong>.
          Both UCS and CBR are predicted across the 0–20% BA range in 0.1% steps
          and the BA percentage with the highest combined score is returned as the optimum.
        </div>
      </div>

      {/* ── Model algorithms ─────────────────────────────── */}
      <div className="card about-card">
        <h2 className="about-section-head">Machine Learning Models Evaluated</h2>
        <div className="algo-grid">
          {[
            { name: 'Random Forest Regressor',    desc: 'Ensemble of decision trees with bootstrap aggregation.' },
            { name: 'Extra Trees Regressor',       desc: 'Extremely randomised trees — reduced variance.' },
            { name: 'Gradient Boosting Regressor', desc: 'Sequential boosting for improved accuracy.' },
          ].map((a) => (
            <div key={a.name} className="algo-card">
              <div className="algo-name">{a.name}</div>
              <div className="algo-desc">{a.desc}</div>
            </div>
          ))}
        </div>
        <p className="about-note" style={{ marginTop: 12 }}>
          The best-performing algorithm (by cross-validation R²) is automatically
          selected and saved for prediction.
        </p>
      </div>

      {/* ── Disclaimer ───────────────────────────────────── */}
      <div className="about-disclaimer">
        <p>
          All AI predictions are based on experimental and literature data and must be
          validated through laboratory testing before use in any engineering design.
          This tool is intended as a research and decision-support aid for the
          Civil Engineering final-year project.
        </p>
      </div>
    </div>
  )
}

function AboutKV({ label, value }) {
  return (
    <div className="about-kv">
      <dt className="about-kv-label">{label}</dt>
      <dd className="about-kv-value">{value}</dd>
    </div>
  )
}
