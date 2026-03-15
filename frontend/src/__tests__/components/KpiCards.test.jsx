// frontend/src/__tests__/components/KpiCards.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import KpiCards from '../../components/KpiCards'

const data = [
  { station: 'A', date: '2024-01-01', value: 60 },  // over PM10 limit (50)
  { station: 'A', date: '2024-01-02', value: 30 },
  { station: 'B', date: '2024-01-01', value: 55 },  // over limit
]

describe('KpiCards', () => {
  it('shows correct average', () => {
    render(<KpiCards data={data} pollutant="PM10" />)
    const avg = (60 + 30 + 55) / 3  // 48.33
    expect(screen.getByText(/48\.3/)).toBeInTheDocument()
  })

  it('counts days over limit correctly', () => {
    render(<KpiCards data={data} pollutant="PM10" />)
    // Days where daily avg > 50:
    // 2024-01-01: avg(60,55)=57.5 > 50 → over
    // 2024-01-02: avg(30)=30 → not over
    // → 1 day over limit
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('shows 0 days over limit when all below threshold', () => {
    const safe = [{ station: 'A', date: '2024-01-01', value: 20 }]
    render(<KpiCards data={safe} pollutant="PM10" />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
