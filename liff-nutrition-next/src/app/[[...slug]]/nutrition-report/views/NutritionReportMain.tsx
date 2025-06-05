'use client' // Add this line to make it a client component

import React, { useEffect, useState, useMemo, useCallback } from 'react'
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
import { useLiff } from '@/components/providers/LiffProvider' // Added import for useLiff

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

  const {
    isReady: liffReady,
    isLoggedIn: liffLoggedIn,
    userId: liffUserId,
    idToken: liffIdToken,
    error: liffError,
  } = useLiff() // Get LIFF states

  const [activeTab, setActiveTab] = useState<TabValue>(TAB_VALUES.DAILY)
  const [isPageReady, setIsPageReady] = useState(false) // New state for content readiness

  // ✅ เพิ่ม state สำหรับ identified variables
  const [identifiedLogId, setIdentifiedLogId] = useState<string | null>(null)
  const [identifiedDate, setIdentifiedDate] = useState<string | null>(null)
  const [identifiedReportType, setIdentifiedReportType] = useState<
    string | string[] | null
  >(null)

  // Memoize derived values from params and searchParams for the main useEffect dependencies
  const slugValue = params?.slug
  const slugDep = useMemo(() => {
    if (Array.isArray(slugValue)) {
      return slugValue.join(',')
    }
    return slugValue ?? null
  }, [slugValue])
  const dateQueryDep = useMemo(() => searchParams?.get('date'), [searchParams])
  const reportTypeQueryDep = useMemo(
    () => searchParams?.get('type'),
    [searchParams],
  )
  const logIdQueryDep = useMemo(
    () => searchParams?.get('logId'),
    [searchParams],
  )

  useEffect(() => {
    const currentSlug = params?.slug
    const dateFromQuery = searchParams?.get('date')
    const reportTypeFromQuery = searchParams?.get('type')
    const logIdFromQuery = searchParams?.get('logId')

    let newIdentifiedLogId: string | null = null
    let newIdentifiedDate: string | null = dateFromQuery
    let newIdentifiedReportType: string | string[] | null = reportTypeFromQuery

    if (currentSlug && currentSlug.length > 0) {
      if (
        currentSlug.length === 1 &&
        Object.values(TAB_VALUES).includes(currentSlug[0] as TabValue)
      ) {
        newIdentifiedReportType = currentSlug[0]
        setActiveTab(currentSlug[0] as TabValue)
        if (!newIdentifiedDate) {
          const today = new Date()
          if (currentSlug[0] === 'daily') {
            newIdentifiedDate = today.toISOString().split('T')[0]
          } else if (currentSlug[0] === 'weekly') {
            const startOfWeek = new Date(today)
            startOfWeek.setDate(today.getDate() - today.getDay())
            newIdentifiedDate = startOfWeek.toISOString().split('T')[0]
          } else if (currentSlug[0] === 'monthly') {
            newIdentifiedDate = `${today.getFullYear()}-${String(
              today.getMonth() + 1,
            ).padStart(2, '0')}`
          }
        }
      } else if (Array.isArray(currentSlug) && currentSlug.includes('daily')) {
        newIdentifiedReportType = 'daily'
        setActiveTab(TAB_VALUES.DAILY)
        const dateIndex = currentSlug.indexOf('daily') + 1
        if (currentSlug[dateIndex] && !newIdentifiedDate) {
          newIdentifiedDate = currentSlug[dateIndex]
        } else if (!newIdentifiedDate) {
          newIdentifiedDate = new Date().toISOString().split('T')[0]
        }
      } else if (Array.isArray(currentSlug) && currentSlug.includes('weekly')) {
        newIdentifiedReportType = 'weekly'
        setActiveTab(TAB_VALUES.WEEKLY)
        const dateIndex = currentSlug.indexOf('weekly') + 1
        if (currentSlug[dateIndex] && !newIdentifiedDate) {
          newIdentifiedDate = currentSlug[dateIndex]
        } else if (!newIdentifiedDate) {
          const today = new Date()
          const startOfWeek = new Date(today)
          startOfWeek.setDate(today.getDate() - today.getDay())
          newIdentifiedDate = startOfWeek.toISOString().split('T')[0]
        }
      } else if (
        Array.isArray(currentSlug) &&
        currentSlug.includes('monthly')
      ) {
        newIdentifiedReportType = 'monthly'
        setActiveTab(TAB_VALUES.MONTHLY)
        const dateIndex = currentSlug.indexOf('monthly') + 1
        if (currentSlug[dateIndex] && !newIdentifiedDate) {
          newIdentifiedDate = currentSlug[dateIndex]
        } else if (!newIdentifiedDate) {
          const today = new Date()
          newIdentifiedDate = `${today.getFullYear()}-${String(
            today.getMonth() + 1,
          ).padStart(2, '0')}`
        }
      }
    } else {
      newIdentifiedReportType = 'daily'
      setActiveTab(TAB_VALUES.DAILY)
      if (!newIdentifiedDate) {
        newIdentifiedDate = new Date().toISOString().split('T')[0]
      }
    }

    if (logIdFromQuery && !newIdentifiedLogId) {
      newIdentifiedLogId = logIdFromQuery
      if (!newIdentifiedReportType) newIdentifiedReportType = 'log_specific'
    }

    setIdentifiedLogId(newIdentifiedLogId)
    setIdentifiedDate(newIdentifiedDate)
    setIdentifiedReportType(newIdentifiedReportType)

    console.log('[NutritionReportMain] URL Analysis Complete:', {
      slug: currentSlug,
      newIdentifiedLogId,
      newIdentifiedDate,
      newIdentifiedReportType,
      activeTabUsedInEffect: activeTab,
    })
    setIsPageReady(true) // Mark page as ready after URL processing pass
  }, [
    slugDep,
    dateQueryDep,
    reportTypeQueryDep,
    logIdQueryDep,
    params,
    searchParams,
    activeTab,
  ])

  // ✅ เพิ่ม tab change handler
  const handleTabChange = (event: React.SyntheticEvent, newValue: TabValue) => {
    setActiveTab(newValue)
    // Navigate to new route, potentially preserving query params if needed
    // For simplicity, just navigating to /reportType/date if date is available
    if (identifiedDate && newValue !== TAB_VALUES.MONTHLY) {
      router.push(`/nutrition-report/${newValue}/${identifiedDate}`)
    } else if (identifiedDate && newValue === TAB_VALUES.MONTHLY) {
      // Ensure identifiedDate is in YYYY-MM format for monthly
      const monthYear = identifiedDate.substring(0, 7) // Assuming YYYY-MM-DD, take YYYY-MM
      router.push(`/nutrition-report/${newValue}/${monthYear}`)
    } else {
      router.push(`/nutrition-report/${newValue}`)
    }
  }

  // Memoize the report view content
  const reportViewContent = useMemo(() => {
    console.log(
      '[NutritionReportMain] Recalculating reportViewContent. ActiveTab:',
      activeTab,
    )
    if (activeTab === TAB_VALUES.DAILY) {
      return <DailyReportView />
    } else if (activeTab === TAB_VALUES.WEEKLY) {
      return <WeeklyReportView />
    } else if (activeTab === TAB_VALUES.MONTHLY) {
      return <MonthlyReportView />
    } else if (identifiedReportType === 'log_specific' && identifiedLogId) {
      return (
        <Typography>
          Specific Log View for {identifiedLogId} (To be implemented or handled
          by redirect)
        </Typography>
      )
    }
    // Fallback or error for unknown report type
    return (
      <Alert severity="warning">
        Unknown or incomplete report type specified.
      </Alert>
    )
  }, [activeTab, identifiedReportType, identifiedLogId])

  // New rendering logic based on LIFF and page readiness
  let contentToRender
  if (liffError) {
    contentToRender = (
      <Alert severity="error">
        LIFF Error: {liffError || 'An unknown LIFF error occurred.'}
      </Alert>
    )
  } else if (!isPageReady || !liffReady) {
    contentToRender = (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        height="50vh"
      >
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>
          {!isPageReady
            ? 'Initializing report...'
            : liffReady
              ? 'LIFF Ready, checking login...'
              : 'Initializing LIFF...'}
        </Typography>
      </Box>
    )
  } else if (!liffLoggedIn || !liffUserId || !liffIdToken) {
    contentToRender = (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        height="50vh"
      >
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>
          {!liffLoggedIn
            ? 'Waiting for user login...'
            : 'Finalizing user session...'}
        </Typography>
      </Box>
    )
  } else {
    // All checks passed: URL processed, LIFF ready, and user logged in.
    console.log(
      '[NutritionReportMain] Rendering memoized reportViewContent. ActiveTab:',
      activeTab,
    )
    contentToRender = reportViewContent
  }

  return (
    <Container sx={{ mt: { xs: 1, sm: 2 }, mb: 2 }}>
      {/* ✅ เพิ่ม Navigation Tabs */}
      <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden' }}>
        {' '}
        {/* Added overflow: hidden for better AppBar appearance */}
        <AppBar position="static" color="default" elevation={0}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth" // Changed to fullWidth for better responsiveness on small screens
            // scrollButtons="auto" // Enable scroll buttons if many tabs
            // allowScrollButtonsMobile
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1rem' }, // Responsive font size
                fontWeight: 500,
                minWidth: { xs: 'auto', sm: 90 }, // Allow tabs to shrink more on xs
                flexGrow: 1, // Allow tabs to grow
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

      {/* Main content area */}
      <Paper elevation={3} sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
        {' '}
        {/* Responsive padding */}
        {/* Debugging information - can be removed for production */}
        {/*
        <Box sx={{ mb: 2, p: 1, backgroundColor: 'grey.50', borderRadius: 1, overflowX: 'auto' }}>
          <Typography variant="caption" display="block">
            Debug Info: activeTab: {activeTab}, isPageReady: {String(isPageReady)}, liffReady: {String(liffReady)}, liffLoggedIn: {String(liffLoggedIn)}, identifiedDate: {identifiedDate}, identifiedLogId: {identifiedLogId}, liffError: {liffError}
          </Typography>
        </Box>
        */}
        {contentToRender}
      </Paper>
    </Container>
  )
}

export default NutritionReportMain
