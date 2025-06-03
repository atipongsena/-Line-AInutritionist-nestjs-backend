'use client'

import { useState } from 'react'
import { Button, Typography, Card, CardContent, Box } from '@mui/material'

export default function TestApiPage() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testHealthEndpoint = async () => {
    setLoading(true)
    setResult('Testing...')

    try {
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'
      console.log('API_BASE_URL:', API_BASE_URL)

      const response = await fetch(`${API_BASE_URL}/health`)
      console.log('Response:', response)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Data:', data)

      setResult(JSON.stringify(data, null, 2))
    } catch (error: any) {
      console.error('Error:', error)
      setResult(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testDirectUrl = async () => {
    setLoading(true)
    setResult('Testing direct URL...')

    try {
      const response = await fetch(
        'https://ai-nutritionist-backend.wittyground-3784ecfe.southeastasia.azurecontainerapps.io/health',
      )
      console.log('Direct Response:', response)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Direct Data:', data)

      setResult(JSON.stringify(data, null, 2))
    } catch (error: any) {
      console.error('Direct Error:', error)
      setResult(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        🧪 API Test Page
      </Typography>

      <Typography variant="body1" paragraph>
        Environment: {process.env.NODE_ENV}
      </Typography>

      <Typography variant="body1" paragraph>
        API Base URL: {process.env.NEXT_PUBLIC_API_BASE_URL || 'Not set'}
      </Typography>

      <Box display="flex" gap={2} mb={3}>
        <Button
          variant="contained"
          onClick={testHealthEndpoint}
          disabled={loading}
        >
          Test Health (with env var)
        </Button>

        <Button variant="outlined" onClick={testDirectUrl} disabled={loading}>
          Test Direct URL
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Result:
          </Typography>
          <Typography
            component="pre"
            sx={{
              whiteSpace: 'pre-wrap',
              backgroundColor: '#f5f5f5',
              p: 2,
              borderRadius: 1,
              minHeight: '100px',
            }}
          >
            {result || 'Click a button to test API connectivity'}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
