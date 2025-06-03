'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Alert, AlertTitle, Button, Box, Typography } from '@mui/material'
import { Refresh as RefreshIcon } from '@mui/icons-material'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          padding={3}
          textAlign="center"
        >
          <Alert severity="error" sx={{ maxWidth: 600, mb: 3 }}>
            <AlertTitle>เกิดข้อผิดพลาด</AlertTitle>
            <Typography variant="body2" sx={{ mt: 1 }}>
              แอพพลิเคชันพบข้อผิดพลาดที่ไม่คาดคิด กรุณาลองรีเฟรชหน้าเว็บ
            </Typography>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{ mt: 2, textAlign: 'left' }}>
                <Typography
                  variant="caption"
                  component="pre"
                  sx={{
                    backgroundColor: '#f5f5f5',
                    padding: 1,
                    borderRadius: 1,
                    fontSize: '0.7rem',
                    overflow: 'auto',
                  }}
                >
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack}
                </Typography>
              </Box>
            )}
          </Alert>

          <Button
            variant="contained"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={this.handleReload}
            size="large"
          >
            รีเฟรชหน้าเว็บ
          </Button>
        </Box>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
