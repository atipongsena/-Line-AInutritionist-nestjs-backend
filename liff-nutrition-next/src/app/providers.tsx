'use client'

import React, { ReactNode } from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { th } from 'date-fns/locale'
import { LiffProvider } from '@/components/providers/LiffProvider'

// 🎨 Enhanced Theme with LINE Design System
const theme = createTheme({
  palette: {
    primary: {
      main: '#06C755', // LINE Green
      light: '#42F77D',
      dark: '#00A23F',
      contrastText: '#fff',
    },
    secondary: {
      main: '#00B2FF', // LINE Blue
      light: '#5DCDFF',
      dark: '#0081CC',
      contrastText: '#fff',
    },
    background: {
      default: '#F8F9FA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1A1A',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: '"Noto Sans Thai", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.4,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 500,
      fontSize: '1.125rem',
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '0.95rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 16px',
        },
        containedPrimary: {
          boxShadow: '0 2px 8px rgba(6, 199, 85, 0.25)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(6, 199, 85, 0.35)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        elevation1: {
          boxShadow: '0 1px 6px rgba(0, 0, 0, 0.08)',
        },
        elevation3: {
          boxShadow: '0 3px 12px rgba(0, 0, 0, 0.12)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 48,
        },
      },
    },
  },
  shape: {
    borderRadius: 8,
  },
})

// 🚨 Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application Error:', error, errorInfo)

    // Send error to monitoring service (e.g., Sentry, LogRocket)
    // if (typeof window !== 'undefined' && window.gtag) {
    //   window.gtag('event', 'exception', {
    //     description: error.toString(),
    //     fatal: false,
    //   })
    // }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              minHeight: '50vh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <h2>🚨 เกิดข้อผิดพลาด</h2>
            <p>ขออภัย แอปพลิเคชันเกิดข้อผิดพลาด กรุณารีเฟรชหน้าเว็บ</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '1rem',
                padding: '8px 16px',
                backgroundColor: '#06C755',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              รีเฟรชหน้าเว็บ
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <AppRouterCacheProvider options={{ enableCssLayer: true }}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={th}>
            <LiffProvider>{children}</LiffProvider>
          </LocalizationProvider>
        </ThemeProvider>
      </AppRouterCacheProvider>
    </ErrorBoundary>
  )
}
