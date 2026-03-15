import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('recharts', async () => {
  const React = await import('react')
  return {
    ResponsiveContainer: ({ children }) =>
      React.createElement('div', { style: { width: 800, height: 400 } }, children),
    ScatterChart: ({ children }) =>
      React.createElement('svg', { 'data-testid': 'scatter-chart' }, children),
    Scatter: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  }
})

import PmScatterChart from '../../../components/charts/ScatterChart'

const points = [
  { x: 5.2, y: 42 },
  { x: 10.1, y: 55 },
]

describe('ScatterChart', () => {
  it('renders without crashing', () => {
    render(<PmScatterChart points={points} xLabel="Temperatura (°C)" yLabel="PM10 µg/m³" />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })
})
