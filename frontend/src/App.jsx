import { useState, useMemo, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import Box from '@mui/material/Box'
import { FilterProvider } from './context/FilterContext'

import AppBar from './components/AppBar'
import FilterBar from './components/FilterBar'
import Footer from './components/Footer'
import Trend from './pages/Trend'
import Weather from './pages/Weather'
import Correlation from './pages/Correlation'

export const ColorModeContext = createContext({ toggle: () => {} })

export default function App() {
  const stored = localStorage.getItem('colorMode')
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const [mode, setMode] = useState(stored ?? (systemDark ? 'dark' : 'light'))

  const colorMode = useMemo(() => ({
    toggle: () => setMode(m => {
      const next = m === 'light' ? 'dark' : 'light'
      localStorage.setItem('colorMode', next)
      return next
    })
  }), [])

  const theme = useMemo(() => createTheme({ palette: { mode } }), [mode])

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <FilterProvider>
          <BrowserRouter>
            <AppBar />
            <Box component="main" sx={{ p: { xs: 1.5, sm: 3 }, mt: 8, pb: { xs: 9, sm: 3 } }}>
              <FilterBar />
              <Routes>
                <Route path="/" element={<Navigate to="/trend" replace />} />
                <Route path="/trend" element={<Trend />} />
                <Route path="/weather" element={<Weather />} />
                <Route path="/correlation" element={<Correlation />} />
              </Routes>
              <Footer />
            </Box>
          </BrowserRouter>
        </FilterProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}
