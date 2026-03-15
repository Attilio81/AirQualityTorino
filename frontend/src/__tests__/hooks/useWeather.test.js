// frontend/src/__tests__/hooks/useWeather.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useWeather } from '../../hooks/useWeather'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() }
}))

import { supabase } from '../../lib/supabase'

const mockWeather = [
  { date: '2024-01-15', tmed: 5.2, prec: 0, v_med: 2.1, ur_med: 70 },
]

function makeChain(data, error = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  }
}

describe('useWeather', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns data on success', async () => {
    supabase.from.mockReturnValue(makeChain(mockWeather))
    const { result } = renderHook(() =>
      useWeather({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(mockWeather)
    expect(result.current.error).toBeNull()
  })

  it('normalizes date to YYYY-MM-DD', async () => {
    const rows = [{ date: '2024-01-15T00:00:00', tmed: 5, prec: 0, v_med: 1, ur_med: 60 }]
    supabase.from.mockReturnValue(makeChain(rows))
    const { result } = renderHook(() =>
      useWeather({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data[0].date).toBe('2024-01-15')
  })

  it('always queries city Torino', async () => {
    supabase.from.mockReturnValue(makeChain([]))
    renderHook(() => useWeather({ dateFrom: '2024-01-01', dateTo: '2024-01-31' }))
    await waitFor(() => {})
    const chain = supabase.from.mock.results[0].value
    expect(chain.eq).toHaveBeenCalledWith('city', 'Torino')
  })
})
