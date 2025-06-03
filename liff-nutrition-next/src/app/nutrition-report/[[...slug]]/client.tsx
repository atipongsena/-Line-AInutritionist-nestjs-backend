'use client'

import React from 'react'

// Path to NutritionReportMain: from src/app/nutrition-report/[[...slug]]/client.tsx
// to src/app/[[...slug]]/nutrition-report/views/NutritionReportMain.tsx
// ../../ goes to src/app/
// Then navigate to [[...slug]]/nutrition-report/views/NutritionReportMain.tsx
const NutritionReportMain = React.lazy(
  () => import('../../[[...slug]]/nutrition-report/views/NutritionReportMain'),
)

export default function NutritionReportClient() {
  // NutritionReportMain will be updated to use useParams or useSearchParams internally
  // to get logId, date, or other parameters from the URL.
  return <NutritionReportMain />
}
