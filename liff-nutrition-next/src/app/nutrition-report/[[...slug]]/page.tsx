'use client'

import React, { Suspense } from 'react'
import CircularProgress from '@mui/material/CircularProgress'

// Path to NutritionReportMain: from src/app/nutrition-report/[[...slug]]/page.tsx
// to src/app/[[...slug]]/nutrition-report/views/NutritionReportMain.tsx
// ../../ goes to src/app/
// Then navigate to [[...slug]]/nutrition-report/views/NutritionReportMain.tsx
const NutritionReportMain = React.lazy(
  () => import('../../[[...slug]]/nutrition-report/views/NutritionReportMain'),
)

export default function NutritionReportPage() {
  // NutritionReportMain will be updated to use useParams or useSearchParams internally
  // to get logId, date, or other parameters from the URL.
  return (
    <Suspense fallback={<CircularProgress />}>
      <NutritionReportMain />
    </Suspense>
  )
}
