import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function normalizeDate(dateStr) {
  if (!dateStr) return dateStr
  return dateStr.slice(0, 10)  // ensures YYYY-MM-DD
}

export function useMeasurements({ pollutant, stations, dateFrom, dateTo }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetch() {
      let query = supabase
        .from('measurements')
        .select('station,date,value')
        .eq('pollutant', pollutant)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: true })

      if (stations && stations.length > 0) {
        query = query.in('station', stations)
      }

      const { data: rows, error: err } = await query

      if (cancelled) return
      if (err) {
        setError(err)
        setData([])
      } else {
        setData((rows || []).map(r => ({ ...r, date: normalizeDate(r.date) })))
      }
      setLoading(false)
    }

    fetch()
    return () => { cancelled = true }
  }, [pollutant, stations, dateFrom, dateTo])

  return { data, loading, error }
}
