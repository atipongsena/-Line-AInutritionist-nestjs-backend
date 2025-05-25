import React from 'react'
import {
  Box,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Container,
  Paper,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import HomeIcon from '@mui/icons-material/Home'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // อัพเดท state เพื่อแสดง UI ของ error
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error สำหรับ debugging
    console.error('Error Boundary caught an error:', error, errorInfo)

    this.setState({
      error,
      errorInfo,
    })

    // เรียก callback ถ้ามี
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleRefresh = () => {
    this.resetError()
    window.location.reload()
  }

  handleGoHome = () => {
    this.resetError()
    // Navigate to home - assumes React Router is available
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // ใช้ custom fallback component ถ้ามี
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return (
          <FallbackComponent
            error={this.state.error!}
            resetError={this.resetError}
          />
        )
      }

      // Default error UI
      return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
          <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              <AlertTitle>เกิดข้อผิดพลาดที่ไม่คาดคิด</AlertTitle>
              แอปพลิเคชันเกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง
            </Alert>

            <Typography variant="h5" gutterBottom color="textSecondary">
              😕 อุปส์! มีบางอย่างผิดพลาด
            </Typography>

            <Typography variant="body1" sx={{ mb: 3 }} color="textSecondary">
              เราขออภัยในความไม่สะดวก กรุณาลองรีเฟรชหน้าเว็บหรือกลับไปหน้าหลัก
            </Typography>

            {/* Error details สำหรับ development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  backgroundColor: 'grey.100',
                  borderRadius: 1,
                  textAlign: 'left',
                  overflow: 'auto',
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Error Details (Development Only):
                </Typography>
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleRefresh}
                color="primary"
              >
                รีเฟรชหน้า
              </Button>
              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={this.handleGoHome}
                color="secondary"
              >
                กลับหน้าหลัก
              </Button>
            </Box>
          </Paper>
        </Container>
      )
    }

    return this.props.children
  }
}

// Hook version สำหรับ functional components
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryConfig?: {
    fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  },
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary
      fallback={errorBoundaryConfig?.fallback}
      onError={errorBoundaryConfig?.onError}
    >
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Simple error fallback component
export const SimpleErrorFallback: React.FC<{
  error: Error
  resetError: () => void
}> = ({ error, resetError }) => (
  <Alert severity="error" sx={{ m: 2 }}>
    <AlertTitle>เกิดข้อผิดพลาด</AlertTitle>
    <Typography variant="body2" sx={{ mb: 2 }}>
      {error.message}
    </Typography>
    <Button size="small" onClick={resetError} variant="outlined">
      ลองใหม่
    </Button>
  </Alert>
)

export default ErrorBoundary
