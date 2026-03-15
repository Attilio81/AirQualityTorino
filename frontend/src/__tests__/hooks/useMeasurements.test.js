import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMeasurements } from '../../hooks/useMeasurements'

// Mock supabase module
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  }
}))

import { supabase } from '../../lib/supabase'

const mockRows = [
  { station: 'Torino - Rebaudengo', date: '2024-01-15', value: 42.5 },
  { station: 'Torino - Consolata', date: '2024-01-15', value: 38.0 },
]

function makeChain(data, error = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  }
  return chain
}

describe('useMeasurements', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns data on success', async () => {
    supabase.from.mockReturnValue(makeChain(mockRows))
    const { result } = renderHook(() =>
      useMeasurements({ pollutant: 'PM10', stations: [], dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    )
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(mockRows)
    expect(result.current.error).toBeNull()
  })

  it('returns error on failure', async () => {
    supabase.from.mockReturnValue(makeChain(null, new Error('network error')))
    const { result } = renderHook(() =>
      useMeasurements({ pollutant: 'PM10', stations: [], dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
    expect(result.current.data).toEqual([])
  })

  it('normalizes date to YYYY-MM-DD string', async () => {
    const rows = [{ station: 'A', date: '2024-01-15T00:00:00', value: 10 }]
    supabase.from.mockReturnValue(makeChain(rows))
    const { result } = renderHook(() =>
      useMeasurements({ pollutant: 'PM10', stations: [], dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data[0].date).toBe('2024-01-15')
  })
})
