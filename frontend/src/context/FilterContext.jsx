// frontend/src/context/FilterContext.jsx
import { createContext, useContext, useState } from 'react'

const FilterContext = createContext(null)

function defaultDateFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().slice(0, 10)
}

function defaultDateTo() {
  return new Date().toISOString().slice(0, 10)
}

function loadStations() {
  try { return JSON.parse(localStorage.getItem('filter_stations') || '[]') } catch { return [] }
}

export function FilterProvider({ children }) {
  const [pollutant, setPollutantState] = useState(
    () => localStorage.getItem('filter_pollutant') || 'PM10'
  )
  const [stations, setStationsState] = useState(loadStations)
  const [dateFrom, setDateFromState] = useState(
    () => localStorage.getItem('filter_dateFrom') || defaultDateFrom()
  )
  const [dateTo, setDateToState] = useState(
    () => localStorage.getItem('filter_dateTo') || defaultDateTo()
  )

  const setPollutant = (v) => {
    localStorage.setItem('filter_pollutant', v)
    setPollutantState(v)
  }
  const setStations = (v) => {
    localStorage.setItem('filter_stations', JSON.stringify(v))
    setStationsState(v)
  }
  const setDateFrom = (v) => {
    localStorage.setItem('filter_dateFrom', v)
    setDateFromState(v)
  }
  const setDateTo = (v) => {
    localStorage.setItem('filter_dateTo', v)
    setDateToState(v)
  }

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
