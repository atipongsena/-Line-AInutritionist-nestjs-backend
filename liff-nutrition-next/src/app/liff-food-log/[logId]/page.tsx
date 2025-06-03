import React, { Suspense } from 'react'
import { Container, Box, CircularProgress, Typography } from '@mui/material'
import LiffFoodLogClient from './client'

// ✅ Static export compatibility: generateStaticParams
export async function generateStaticParams() {
  // Return common logId values for static generation
  return [
    { logId: 'demo' }, // Demo page
  ]
}

export default function LiffFoodLogPage() {
  return (
    <Suspense
      fallback={
        <Container maxWidth="sm" sx={{ py: 4 }}>
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight="60vh"
          >
            <CircularProgress size={40} />
            <Typography variant="body1" sx={{ mt: 2 }} color="text.secondary">
              กำลังโหลด...
            </Typography>
          </Box>
        </Container>
      }
    >
      <LiffFoodLogClient />
    </Suspense>
  )
}
