// frontend/src/hooks/useWeather.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function normalizeDate(d) { return d ? d.slice(0, 10) : d }

export function useWeather({ dateFrom, dateTo }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetch() {
      const { data: rows, error: err } = await supabase
        .from('weather')
        .select('date,tmin,tmax,tmed,prec,v_med,ur_med')
        .eq('city', 'Torino')
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: true })

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
  }, [dateFrom, dateTo])

  return { data, loading, error }
}
