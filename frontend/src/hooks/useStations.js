import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useStations() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('stations')
      .select('name,lat,lon,pollutants')
      .then(({ data: rows, error: err }) => {
        if (err) setError(err)
        else setData(rows || [])
        setLoading(false)
      })
  }, [])

  return { data, loading, error }
}
