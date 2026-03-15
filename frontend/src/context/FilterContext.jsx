// frontend/src/context/FilterContext.jsx
import { createContext, useContext, useState } from 'react'

const FilterContext = createContext(null)

// These compute YYYY-MM-DD strings at app init time (relative to when app first loads)
function defaultDateFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().slice(0, 10)  // YYYY-MM-DD
}

function defaultDateTo() {
  return new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
}

export function FilterProvider({ children }) {
  const [pollutant, setPollutant] = useState('PM10')
  const [stations, setStations] = useState([])   // [] = all stations
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(defaultDateTo)

  return (
    <FilterContext.Provider value={{
      pollutant, setPollutant,
      stations, setStations,
      dateFrom, setDateFrom,
      dateTo, setDateTo,
    }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilters must be used inside FilterProvider')
  return ctx
}
