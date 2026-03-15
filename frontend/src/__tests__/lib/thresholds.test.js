import { describe, it, expect } from 'vitest'
import { THRESHOLDS, getThreshold } from '../../lib/thresholds'

describe('thresholds', () => {
  it('has PM10 threshold of 50', () => {
    expect(THRESHOLDS.PM10).toBe(50)
  })
  it('has PM25 threshold of 25', () => {
    expect(THRESHOLDS.PM25).toBe(25)
  })
  it('getThreshold returns correct value', () => {
    expect(getThreshold('PM10')).toBe(50)
    expect(getThreshold('PM25')).toBe(25)
  })
  it('getThreshold returns null for unknown pollutant', () => {
    expect(getThreshold('NO2')).toBeNull()
  })
})
