'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material'
import { Refresh as RefreshIcon, CheckCircle, Error } from '@mui/icons-material'
import { useLiff } from '../../components/providers/LiffProvider'
import { healthCheck } from '../../lib/api'

interface DebugInfo {
  environment: Record<string, string>
  liffStatus: any
  apiStatus: any
}

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const liff = useLiff()

  const loadDebugInfo = useCallback(async () => {
    setLoading(true)
    try {
      // Environment Variables
      const environment = {
        NEXT_PUBLIC_LIFF_ID: process.env.NEXT_PUBLIC_LIFF_ID || 'Not set',
        NEXT_PUBLIC_API_BASE_URL:
          process.env.NEXT_PUBLIC_API_BASE_URL || 'Not set',
        NODE_ENV: process.env.NODE_ENV || 'Not set',
        NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG || 'Not set',
      }

      // LIFF Status
      const liffStatus = {
        isReady: liff.isReady,
        isLoggedIn: liff.isLoggedIn,
        userId: liff.userId,
        hasProfile: !!liff.profile,
        language: liff.language,
        error: liff.error,
      }

      // API Status
      let apiStatus = {
        reachable: false,
        error: null as string | null,
        response: null as any,
      }

      try {
        const response = await healthCheck()
        apiStatus = {
          reachable: true,
          error: null,
          response: response,
        }
      } catch (error: any) {
        apiStatus = {
          reachable: false,
          error: error.message,
          response: null,
        }
      }

      setDebugInfo({
        environment,
        liffStatus,
        apiStatus,
      })
    } catch (error) {
      console.error('Failed to load debug info:', error)
    } finally {
      setLoading(false)
    }
  }, [
    liff.isReady,
    liff.isLoggedIn,
    liff.userId,
    liff.profile,
    liff.language,
    liff.error,
  ])

  useEffect(() => {
    loadDebugInfo()
  }, [loadDebugInfo])

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!debugInfo) {
    return (
      <Box p={3}>
        <Alert severity="error">Failed to load debug information</Alert>
      </Box>
    )
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        🔧 Debug Information
      </Typography>

      <Button
        variant="outlined"
        startIcon={<RefreshIcon />}
        onClick={loadDebugInfo}
        sx={{ mb: 3 }}
      >
        Refresh
      </Button>

      {/* Environment Variables */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📊 Environment Variables
          </Typography>
          {Object.entries(debugInfo.environment).map(([key, value]) => (
            <Box key={key} display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2" fontWeight="bold">
                {key}:
              </Typography>
              <Chip
                label={value}
                size="small"
                color={value === 'Not set' ? 'error' : 'success'}
                variant="outlined"
              />
            </Box>
          ))}
        </CardContent>
      </Card>

      {/* LIFF Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📱 LIFF Status
          </Typography>
          {Object.entries(debugInfo.liffStatus).map(([key, value]) => (
            <Box key={key} display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2" fontWeight="bold">
                {key}:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {typeof value === 'boolean'
                  ? value
                    ? '✅'
                    : '❌'
                  : String(value)}
              </Typography>
            </Box>
          ))}

          {debugInfo.liffStatus.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2">
                {debugInfo.liffStatus.error}
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* API Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🌐 API Status
          </Typography>

          <Box display="flex" alignItems="center" mb={2}>
            {debugInfo.apiStatus.reachable ? (
              <CheckCircle color="success" sx={{ mr: 1 }} />
            ) : (
              <Error color="error" sx={{ mr: 1 }} />
            )}
            <Typography>
              Backend API:{' '}
              {debugInfo.apiStatus.reachable ? 'Reachable' : 'Unreachable'}
            </Typography>
          </Box>

          {debugInfo.apiStatus.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Error: {debugInfo.apiStatus.error}
              </Typography>
            </Alert>
          )}

          {debugInfo.apiStatus.response && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Health Check Response:
              </Typography>
              <Box
                component="pre"
                sx={{
                  backgroundColor: '#f5f5f5',
                  p: 2,
                  borderRadius: 1,
                  fontSize: '0.875rem',
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(debugInfo.apiStatus.response, null, 2)}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            💡 Recommendations
          </Typography>

          <Typography variant="body2" paragraph>
            <strong>Environment Issues:</strong>
          </Typography>
          <ul>
            <li>LIFF ID should be in format: xxxxxxxxx-xxxxxxxx</li>
            <li>API Base URL should point to your backend server</li>
            <li>Environment should be &apos;production&apos; in Azure</li>
          </ul>

          <Typography variant="body2" paragraph>
            <strong>LIFF Issues:</strong>
          </Typography>
          <ul>
            <li>
              LIFF should be ready and logged in when accessed from LINE app
            </li>
            <li>Error messages indicate configuration problems</li>
          </ul>

          <Typography variant="body2" paragraph>
            <strong>API Issues:</strong>
          </Typography>
          <ul>
            <li>Backend should be reachable and return JSON responses</li>
            <li>CORS should be configured to allow frontend domain</li>
            <li>Health endpoint should return status information</li>
          </ul>
        </CardContent>
      </Card>
    </Box>
  )
}
