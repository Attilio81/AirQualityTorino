import { useState, useMemo, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import Box from '@mui/material/Box'
import { FilterProvider } from './context/FilterContext'
import { Analytics } from '@vercel/analytics/react'

import AppBar from './components/AppBar'
import FilterBar from './components/FilterBar'
import Footer from './components/Footer'
import Trend from './pages/Trend'
import Weather from './pages/Weather'
import Correlation from './pages/Correlation'
import Stazioni from './pages/Stazioni'

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

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#38bdf8' : '#0284c7',
        light: '#7dd3fc',
        dark: '#0369a1',
        contrastText: '#fff',
      },
      secondary: {
        main: '#06b6d4',
      },
      error: {
        main: '#ef4444',
      },
      warning: {
        main: '#f59e0b',
      },
      success: {
        main: '#10b981',
      },
      ...(mode === 'dark' ? {
        background: {
          default: '#070d18',
          paper: '#0d1b2a',
        },
        divider: '#1e3a5f',
      } : {
        background: {
          default: '#f0f9ff',
          paper: '#ffffff',
        },
        divider: '#bae6fd',
      }),
    },
    typography: {
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCard: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
    },
  }), [mode])

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
                <Route path="/stazioni" element={<Stazioni />} />
              </Routes>
              <Footer />
            </Box>
          </BrowserRouter>
        </FilterProvider>
      </ThemeProvider>
      <Analytics />
    </ColorModeContext.Provider>
  )
}
