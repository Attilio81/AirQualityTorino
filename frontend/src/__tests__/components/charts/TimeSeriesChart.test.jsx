import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('recharts', async () => {
  const React = await import('react')
  return {
    ResponsiveContainer: ({ children }) =>
      React.createElement('div', { style: { width: 800, height: 400 } }, children),
    LineChart: ({ children }) =>
      React.createElement('svg', { 'data-testid': 'line-chart' }, children),
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
  }
})

import TimeSeriesChart from '../../../components/charts/TimeSeriesChart'

const data = [
  { station: 'Rebaudengo', date: '2024-01-01', value: 45 },
  { station: 'Rebaudengo', date: '2024-01-02', value: 55 },
  { station: 'Consolata',  date: '2024-01-01', value: 30 },
]

describe('TimeSeriesChart', () => {
  it('renders without crashing', () => {
    render(<TimeSeriesChart data={data} pollutant="PM10" threshold={50} />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })
})
