import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import './Layout.css'

const NAV_ITEMS = [
  { to: '/',            label: 'Prediction',        icon: '⚗️' },
  { to: '/dataset',     label: 'Dataset',           icon: '📊' },
  { to: '/performance', label: 'Model Performance', icon: '📈' },
  { to: '/about',       label: 'About Project',     icon: 'ℹ️' },
]

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="site-header">
        <div className="container header-inner">
          <div className="brand">
            <span className="brand-icon">🌱</span>
            <div>
              <div className="brand-title">BCS • BAGASSE ASH AI</div>
              <div className="brand-sub">
                AI-Based Optimization of Bagasse Ash for Black Cotton Soil Stabilization
              </div>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="desktop-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  'nav-link' + (isActive ? ' nav-link--active' : '')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="hamburger"
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav className="mobile-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  'mobile-nav-link' + (isActive ? ' mobile-nav-link--active' : '')
                }
                onClick={() => setMenuOpen(false)}
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* ── Page ───────────────────────────────────────────── */}
      <main className="page-content">
        <div className="container">{children}</div>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="site-footer">
        <div className="container">
          <span>
            BCS • Bagasse Ash AI &nbsp;|&nbsp; Civil Engineering Final-Year Project &nbsp;|&nbsp;
            Predictions require laboratory validation.
          </span>
        </div>
      </footer>
    </div>
  )
}
