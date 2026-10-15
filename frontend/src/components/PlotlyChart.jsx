/**
 * Lightweight Plotly wrapper that bundles plotly.js-dist-min
 * instead of the full plotly.js, resolving the Vite external-dependency warning.
 */
import React from 'react'
import Plotly from 'plotly.js-dist-min'
import createPlotlyComponent from 'react-plotly.js/factory'

const Plot = createPlotlyComponent(Plotly)
export default Plot
