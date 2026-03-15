// frontend/src/pages/Map.jsx
import { useState, useEffect, useMemo, useCallback } from 'react'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import { supabase } from '../lib/supabase'
import { useFilters } from '../context/FilterContext'
import { useMeasurements } from '../hooks/useMeasurements'
import StationMap from '../components/StationMap'
import ErrorBanner from '../components/ErrorBanner'

export default function Map() {
  const { pollutant, dateFrom, dateTo } = useFilters()
  const [stations, setStations] = useState([])
  const [stationsLoading, setStationsLoading] = useState(true)
  const [stationsError, setStationsError] = useState(null)

  // Map always loads ALL stations regardless of sidebar station filter
  const { data: measurements, loading: measLoading, error: measError } =
    useMeasurements({ pollutant, stations: [], dateFrom, dateTo })

  useEffect(() => {
    supabase
      .from('stations')
      .select('name,lat,lon,pollutants')
      .then(({ data, error }) => {
        setStationsLoading(false)
        if (error) setStationsError(error)
        else setStations(data || [])
      })
  }, [])

  const measurementsByStation = useMemo(() => {
    const map = {}
    for (const row of measurements) {
      if (!map[row.station]) map[row.station] = []
      map[row.station].push(row)
    }
    return map
  }, [measurements])

  const retry = useCallback(() => window.location.reload(), [])

  if (stationsLoading || measLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  if (stationsError || measError)
    return <ErrorBanner message="Errore nel caricamento della mappa." onRetry={retry} />

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Mappa stazioni — {pollutant}</Typography>
      <StationMap
        stations={stations}
        measurementsByStation={measurementsByStation}
        pollutant={pollutant}
      />
    </Box>
  )
}
