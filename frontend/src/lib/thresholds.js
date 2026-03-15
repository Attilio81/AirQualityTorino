export const THRESHOLDS = { PM10: 50, PM25: 25 }

export function getThreshold(pollutant) {
  return THRESHOLDS[pollutant] ?? null
}
