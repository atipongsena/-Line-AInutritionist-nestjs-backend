'use client' // Add this line to make it a client component

import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation' // Import hooks from next/navigation
import {
  Container,
  Typography,
  CircularProgress,
  Box,
  Paper,
  Alert,
  Tabs,
  Tab,
  AppBar,
} from '@mui/material'
import DailyReportView from '@/components/nutrition/DailyReportView' // Import DailyReportView
import WeeklyReportView from '@/components/nutrition/WeeklyReportView' // Import WeeklyReportView
import MonthlyReportView from '@/components/nutrition/MonthlyReportView' // Import MonthlyReportView

// Navigation tab values
const TAB_VALUES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const

type TabValue = (typeof TAB_VALUES)[keyof typeof TAB_VALUES]

// Example interface for the data this component might fetch or display
// interface ReportData { // No longer needed here
//   title: string
//   summary: string
//   details: Record<string, any>
// }

const NutritionReportMain: React.FC = () => {
  const params = useParams() // For path parameters like /nutrition-report/[logId] or /nutrition-report/user/[userId]/date/[date]
  const searchParams = useSearchParams() // For query parameters like ?type=daily
  const router = useRouter() // For navigation

  const [isLoading, setIsLoading] = useState(true) // Keep for initial page load
  const [activeTab, setActiveTab] = useState<TabValue>(TAB_VALUES.DAILY) // ✅ เพิ่ม tab state

  // ✅ เพิ่ม state สำหรับ identified variables
  const [identifiedLogId, setIdentifiedLogId] = useState<string | null>(null)
  const [identifiedDate, setIdentifiedDate] = useState<string | null>(null)
  const [identifiedReportType, setIdentifiedReportType] = useState<
    string | string[] | null
  >(null)

  // ✅ ย้าย variables เข้าไปใน useEffect เพื่อแก้ไข ESLint warnings
  useEffect(() => {
    // Extract slug parts and query parameters
    const slug = params?.slug // slug will be an array of strings, e.g., ['daily'] or ['log', '12345']
    const dateFromQuery = searchParams?.get('date')
    const reportTypeFromQuery = searchParams?.get('type')
    const logIdFromQuery = searchParams?.get('logId')

    let newIdentifiedLogId: string | null = null
    let newIdentifiedDate: string | null = dateFromQuery
    let newIdentifiedReportType: string | string[] | null = reportTypeFromQuery

    // Logic to interpret slug
    if (slug && slug.length > 0) {
      if (
        slug.length === 1 &&
        Object.values(TAB_VALUES).includes(slug[0] as TabValue)
      ) {
        // ✅ ปรับ logic ให้ทำงานกับ tabs
        newIdentifiedReportType = slug[0]
        setActiveTab(slug[0] as TabValue)

        // ✅ เพิ่มการตั้งค่า default date ถ้าไม่มี
        if (!newIdentifiedDate) {
          const today = new Date()
          if (slug[0] === 'daily') {
            newIdentifiedDate = today.toISOString().split('T')[0] // YYYY-MM-DD
          } else if (slug[0] === 'weekly') {
            // หาวันเริ่มต้นของสัปดาห์ปัจจุบัน
            const startOfWeek = new Date(today)
            startOfWeek.setDate(today.getDate() - today.getDay())
            newIdentifiedDate = startOfWeek.toISOString().split('T')[0]
          } else if (slug[0] === 'monthly') {
            // หาเดือนปัจจุบัน YYYY-MM
            newIdentifiedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
          }
        }
      } else if (slug.includes('daily')) {
        newIdentifiedReportType = 'daily'
        setActiveTab(TAB_VALUES.DAILY)
        // Date might be in slug like /nutrition-report/daily/2024-07-30
        const dateIndex = slug.indexOf('daily') + 1
        if (slug[dateIndex] && !newIdentifiedDate) {
          newIdentifiedDate = slug[dateIndex]
        } else if (!newIdentifiedDate) {
          newIdentifiedDate = new Date().toISOString().split('T')[0]
        }
      } else if (slug.includes('weekly')) {
        newIdentifiedReportType = 'weekly'
        setActiveTab(TAB_VALUES.WEEKLY)
        const dateIndex = slug.indexOf('weekly') + 1
        if (slug[dateIndex] && !newIdentifiedDate) {
          newIdentifiedDate = slug[dateIndex] // e.g. start date of the week
        } else if (!newIdentifiedDate) {
          const today = new Date()
          const startOfWeek = new Date(today)
          startOfWeek.setDate(today.getDate() - today.getDay())
          newIdentifiedDate = startOfWeek.toISOString().split('T')[0]
        }
      } else if (slug.includes('monthly')) {
        newIdentifiedReportType = 'monthly'
        setActiveTab(TAB_VALUES.MONTHLY)
        const dateIndex = slug.indexOf('monthly') + 1
        if (slug[dateIndex] && !newIdentifiedDate) {
          newIdentifiedDate = slug[dateIndex]
        } else if (!newIdentifiedDate) {
          const today = new Date()
          newIdentifiedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
        }
      }
    } else {
      // ✅ ถ้าไม่มี slug ให้ตั้งค่า default เป็น daily
      newIdentifiedReportType = 'daily'
      setActiveTab(TAB_VALUES.DAILY)
      if (!newIdentifiedDate) {
        newIdentifiedDate = new Date().toISOString().split('T')[0]
      }
    }

    // If logId was passed as a query param and not found in slug
    if (logIdFromQuery && !newIdentifiedLogId) {
      newIdentifiedLogId = logIdFromQuery
      if (!newIdentifiedReportType) newIdentifiedReportType = 'log_specific'
    }

    // ✅ ตั้งค่า state variables
    setIdentifiedLogId(newIdentifiedLogId)
    setIdentifiedDate(newIdentifiedDate)
    setIdentifiedReportType(newIdentifiedReportType)

    // ✅ เพิ่ม debug logging
    console.log('[NutritionReportMain] URL Analysis:', {
      slug,
      newIdentifiedLogId,
      newIdentifiedDate,
      newIdentifiedReportType,
      activeTab,
    })
  }, [params?.slug, searchParams, activeTab]) // ✅ เพิ่ม activeTab ใน dependency array

  // ✅ เพิ่ม tab change handler
  const handleTabChange = (event: React.SyntheticEvent, newValue: TabValue) => {
    setActiveTab(newValue)
    // Navigate to new route
    router.push(`/nutrition-report/${newValue}`)
  }

  useEffect(() => {
    // Simulate initial page setup or check for essential params
    // This effect can be simplified or removed if not needed for initial loading logic
    const timer = setTimeout(() => {
      setIsLoading(false) // Stop general loading after a short delay
    }, 500) // Adjust delay as needed, or tie to a real check
    return () => clearTimeout(timer)
  }, [])

  // The actual View components (DailyReportView, WeeklyReportView, etc.)
  // will be responsible for their own data fetching via the Zustand store.
  // NutritionReportMain will now primarily handle routing logic based on slug/params
  // and render the appropriate view component.

  const renderReportView = () => {
    if (activeTab === TAB_VALUES.DAILY) {
      // Props like identifiedDate might be passed if DailyReportView is adapted to take them,
      // or DailyReportView can use useUrlParameters/useNutritionStore to get the date.
      return <DailyReportView /> // Render DailyReportView
    } else if (activeTab === TAB_VALUES.WEEKLY) {
      // return <WeeklyReportView weekStartDate={identifiedDate} />;
      return <WeeklyReportView /> // Render WeeklyReportView
    } else if (activeTab === TAB_VALUES.MONTHLY) {
      // Example, if monthly report is identified via slug or query
      // return <MonthlyReportView month={identifiedDate} /> // Assuming identifiedDate is YYYY-MM for monthly
      return <MonthlyReportView /> // Render MonthlyReportView
    } else if (identifiedReportType === 'log_specific' && identifiedLogId) {
      // This might redirect to the /liff-food-log/[logId] page or render a specific log view here.
      // For now, let's assume /liff-food-log/[logId] handles this.
      // Or, if it's part of a daily report context:
      // return <DailyReportView logId={identifiedLogId} />;
      return (
        <Typography>
          Specific Log View for {identifiedLogId} (To be implemented)
        </Typography>
      )
    }
    // Fallback or error for unknown report type
    return (
      <Alert severity="warning">
        Unknown or incomplete report type specified in URL.
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '80vh',
        }}
      >
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading nutrition report...</Typography>
      </Box>
    )
  }

  // Error state from this component is removed as views handle their own errors
  // if (error) {
  //   return (
  //     <Container sx={{ mt: 4 }}>
  //       <Alert severity="error">{error}</Alert>
  //     </Container>
  //   )
  // }

  // reportData state from this component is removed
  // if (!reportData) {
  //   return (
  //     <Container sx={{ mt: 4 }}>
  //       {renderReportView()} {/* Render the determined view */}
  //     </Container>
  //   )
  // }

  return (
    <Container sx={{ mt: 2, mb: 2 }}>
      {/* ✅ เพิ่ม Navigation Tabs */}
      <Paper elevation={1} sx={{ mb: 2 }}>
        <AppBar position="static" color="default" elevation={0}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 500,
              },
            }}
          >
            <Tab
              label="📊 รายวัน"
              value={TAB_VALUES.DAILY}
              sx={{ minHeight: 56 }}
            />
            <Tab
              label="📈 รายสัปดาห์"
              value={TAB_VALUES.WEEKLY}
              sx={{ minHeight: 56 }}
            />
            <Tab
              label="📅 รายเดือน"
              value={TAB_VALUES.MONTHLY}
              sx={{ minHeight: 56 }}
            />
          </Tabs>
        </AppBar>
      </Paper>

      {/* The Paper and debugging info might be removed or moved if views are full-page */}
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Debugging information - can be removed for production */}
        <Box
          sx={{
            mb: 2,
            p: 2,
            backgroundColor: 'grey.100',
            borderRadius: 1,
            display: 'none',
          }}
        >
          <Typography variant="h6">Parameters Used (Main):</Typography>
          <Typography
            component="pre"
            sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            {JSON.stringify(
              {
                slug: params?.slug,
                identifiedLogId,
                identifiedDate,
                identifiedReportType,
                activeTab, // ✅ เพิ่ม activeTab ใน debug info
                queryParams: Object.fromEntries(searchParams.entries()),
              },
              null,
              2,
            )}
          </Typography>
        </Box>

        {/* Render the determined view component */}
        {renderReportView()}
      </Paper>
    </Container>
  )
}

export default NutritionReportMain
