import React, { useState, useEffect, Suspense, lazy } from 'react'
import {
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Typography,
  Container,
  AppBar,
  Toolbar,
  IconButton,
  Alert,
} from '@mui/material'
import { useNutritionStore } from '../stores/nutritionStore'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { WindowWithLiff, isLiffAvailable } from '../types/liff'
import { format } from 'date-fns'

// Lazy load views for better initial load time
const DailyReportView = lazy(() => import('./DailyReportView'))
const WeeklyReportView = lazy(() => import('./WeeklyReportView'))
const MonthlyReportView = lazy(() => import('./MonthlyReportView'))

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`nutrition-tabpanel-${index}`}
      aria-labelledby={`nutrition-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3, pb: 3 }}>
          <Suspense
            fallback={
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 'calc(100vh - 200px)',
                }}
              >
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>กำลังโหลดรายงาน...</Typography>
              </Box>
            }
          >
            {children}
          </Suspense>
        </Box>
      )}
    </div>
  )
}

function a11yProps(index: number) {
  return {
    id: `nutrition-tab-${index}`,
    'aria-controls': `nutrition-tabpanel-${index}`,
  }
}

const NutritionReportMain: React.FC = () => {
  const [tabValue, setTabValue] = useState(0)
  const [liffReady, setLiffReady] = useState(false) // Renamed from liffInitialized for clarity
  const [liffError, setLiffError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const currentLang = 'th' // Or use a language context/store
  const [renderError, setRenderError] = useState<string | null>(null)
  const [hasCheckedUrlParams, setHasCheckedUrlParams] = useState(false)

  // Zustand store selectors
  const fetchDailyReport = useNutritionStore((state) => state.fetchDailyReport)
  const fetchWeeklyReport = useNutritionStore(
    (state) => state.fetchWeeklyReport,
  )
  const fetchMonthlyReport = useNutritionStore(
    (state) => state.fetchMonthlyReport,
  )
  const selectedDate = useNutritionStore((state) => state.selectedDate)
  const setSelectedWeek = useNutritionStore((state) => state.setSelectedWeek)
  const setSelectedMonth = useNutritionStore((state) => state.setSelectedMonth)

  // Effect เพื่อตรวจสอบ URL parameters และเปลี่ยน tab ถ้ามี logId
  useEffect(() => {
    if (!hasCheckedUrlParams) {
      try {
        const params = new URLSearchParams(window.location.search)
        const logId = params.get('logId')
        const targetDate = params.get('date')

        if (logId) {
          console.log(
            '[NutritionReportMain] Found logId in URL, switching to Daily Report tab',
            { logId, targetDate },
          )
          setTabValue(0) // ไปที่ tab Daily Report

          // ถ้ามี targetDate ให้ set วันที่ตาม parameter
          if (targetDate) {
            console.log(`[NutritionReportMain] Setting date to: ${targetDate}`)
            useNutritionStore.getState().setSelectedDate(targetDate)
          }

          // เก็บ logId ไว้ใน store หรือ state เพื่อใช้งานต่อ
          // (อาจต้องเพิ่ม state หรือ store สำหรับ logId)
          sessionStorage.setItem('targetLogId', logId)
        }

        setHasCheckedUrlParams(true)
      } catch (err) {
        console.error('[NutritionReportMain] Error checking URL params:', err)
        setHasCheckedUrlParams(true)
      }
    }
  }, [hasCheckedUrlParams])

  // เพิ่ม effect boundary แบบง่ายๆ
  useEffect(() => {
    try {
      // ตรวจสอบวันที่เริ่มต้น
      console.log(
        `[DEBUG] NutritionReportMain mounted, checking selectedDate: ${selectedDate}`,
      )
      if (selectedDate) {
        const dateObj = new Date(selectedDate)
        const now = new Date()

        if (isNaN(dateObj.getTime())) {
          console.error(`[ERROR] Invalid initial selectedDate: ${selectedDate}`)
          // รีเซ็ตวันที่เป็นวันปัจจุบัน
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const day = String(now.getDate()).padStart(2, '0')
          const todayStr = `${year}-${month}-${day}`
          console.log(`[DEBUG] Resetting to current date: ${todayStr}`)
          useNutritionStore.getState().setSelectedDate(todayStr)
          return
        }

        // ตรวจสอบว่าไม่ใช่วันในอนาคต
        if (dateObj > now) {
          console.warn(
            `[WARNING] Initial selectedDate is in future: ${selectedDate}`,
          )
          // รีเซ็ตวันที่เป็นวันปัจจุบัน
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const day = String(now.getDate()).padStart(2, '0')
          const todayStr = `${year}-${month}-${day}`
          console.log(`[DEBUG] Resetting to current date: ${todayStr}`)
          useNutritionStore.getState().setSelectedDate(todayStr)
          return
        }
      }
    } catch (err) {
      console.error(
        '[ERROR] Error in NutritionReportMain initial useEffect:',
        err,
      )
      setRenderError('เกิดข้อผิดพลาดในการโหลดหน้ารายงาน กรุณาลองใหม่อีกครั้ง')
    }
  }, [])

  useEffect(() => {
    const initializeLiffInReport = async () => {
      // Access liff object from window, cast to WindowWithLiff
      const win = window as WindowWithLiff
      const localLiff = win.liff

      if (!localLiff || !isLiffAvailable(localLiff)) {
        console.error(
          '[NutritionReport] LIFF SDK not loaded. Ensure script tag is present or App.tsx has initialized it.',
        )
        setLiffError('LIFF SDK not available for report page.')
        setLiffReady(true) // Allow UI to show error state
        return
      }

      try {
        const liffId = import.meta.env.VITE_LIFF_ID

        if (!liffId) {
          console.error(
            '[NutritionReport] LIFF ID not found. Set VITE_LIFF_ID env var.',
          )
          setLiffError('LIFF configuration error on report page.')
          setLiffReady(true)
          return
        }

        // LIFF is typically initialized in App.tsx.
        // Here, we mainly check login status and get profile/token.
        if (!localLiff.isLoggedIn()) {
          console.warn('[NutritionReport] User is not logged in to LIFF.')
          // Optional: Attempt to login or redirect. For now, show error.
          // await localLiff.login(); // This would redirect
          setLiffError(
            'User not logged in. Please login via the main app page.',
          )
          setLiffReady(true)
          return
        }

        const profile = await localLiff.getProfile()
        setUserId(profile.userId)
        const token = localLiff.getIDToken()
        setIdToken(token)
        setLiffReady(true)
      } catch (error) {
        console.error('[NutritionReport] LIFF operation failed:', error)
        let errorMessage = 'Unknown error'
        if (typeof error === 'object' && error !== null && 'message' in error) {
          errorMessage = String((error as { message: unknown }).message)
        } else if (typeof error === 'string') {
          errorMessage = error
        }
        setLiffError(`Failed LIFF operation: ${errorMessage}`)
        setLiffReady(true)
      }
    }
    void initializeLiffInReport()
  }, [])

  // Fetch data when liff is ready and user info is available
  useEffect(() => {
    console.log(
      `[DEBUG] NutritionReportMain useEffect triggered with: liffReady=${liffReady}, tabValue=${tabValue}, userId=${!!userId}, idToken=${!!idToken}, liffError=${!!liffError}`,
    )

    // ป้องกันการเรียกซ้ำเมื่อข้อมูลไม่เปลี่ยน
    if (liffReady && userId && idToken && !liffError) {
      // เริ่มต้นเตรียมข้อมูลตาม tab ที่กำลังแสดง
      if (tabValue === 0) {
        console.log(
          `[DEBUG] About to fetch daily report for date: ${selectedDate}`,
        )

        // ตรวจสอบวันที่และแก้ไขหากเป็นวันที่ในอนาคต
        const currentDate = new Date()
        const selectedDateObj = new Date(selectedDate)

        if (isNaN(selectedDateObj.getTime())) {
          console.error(
            `[ERROR] Invalid selectedDate: ${selectedDate}, using today instead`,
          )
          const todayStr = currentDate.toISOString().split('T')[0]
          useNutritionStore.getState().setSelectedDate(todayStr)
          void fetchDailyReport(todayStr, userId, idToken)
          return
        }

        if (selectedDateObj > currentDate) {
          console.warn(
            `[WARNING] selectedDate ${selectedDate} is in the future, using today instead`,
          )
          const todayStr = currentDate.toISOString().split('T')[0]
          useNutritionStore.getState().setSelectedDate(todayStr)
          void fetchDailyReport(todayStr, userId, idToken)
          return
        }

        void fetchDailyReport(selectedDate, userId, idToken)
      }
      // ตรวจสอบว่าอยู่ที่ tab รายสัปดาห์
      else if (tabValue === 1) {
        // ถ้ายังไม่มีการเลือกสัปดาห์ให้กำหนดเป็นสัปดาห์ปัจจุบัน
        const thisWeekStart = new Date()
        thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay()) // ตั้งเป็นวันอาทิตย์
        const formattedWeekStart = thisWeekStart.toISOString().split('T')[0]

        setSelectedWeek(formattedWeekStart)
        void fetchWeeklyReport(formattedWeekStart, userId, idToken)
      }
      // ตรวจสอบว่าอยู่ที่ tab รายเดือน
      else if (tabValue === 2) {
        // ถ้ายังไม่มีการเลือกเดือนให้กำหนดเป็นเดือนปัจจุบัน
        const thisMonth = format(new Date(), 'yyyy-MM')

        setSelectedMonth(thisMonth)
        void fetchMonthlyReport(thisMonth, userId, idToken)
      }
    }
  }, [
    liffReady,
    userId,
    idToken,
    tabValue,
    liffError,
    fetchDailyReport,
    fetchWeeklyReport,
    fetchMonthlyReport,
    selectedDate,
    setSelectedWeek,
    setSelectedMonth,
  ])

  const handleChangeTab = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleLiffBack = () => {
    const win = window as WindowWithLiff
    const localLiff = win.liff
    // ตรวจสอบว่า liff ถูก initialize และมี closeWindow method
    if (
      localLiff &&
      isLiffAvailable(localLiff) &&
      typeof localLiff.closeWindow === 'function'
    ) {
      localLiff.closeWindow()
    } else {
      console.warn('[NutritionReport] liff.closeWindow() is not available.')
      // Fallback if history navigation is needed and react-router is used here
      // navigate(-1);
    }
  }

  if (!liffReady) {
    // Show loading only if liff operations haven't completed (success or error)
    return (
      <Container
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Box textAlign="center">
          <CircularProgress />
          <Typography>กำลังโหลดรายงานโภชนาการ...</Typography>
        </Box>
      </Container>
    )
  }

  if (liffError) {
    return (
      <Container
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          textAlign: 'center',
        }}
      >
        <Typography color="error">
          ข้อผิดพลาด: {liffError} <br /> กรุณาตรวจสอบว่าคุณได้เข้าสู่ระบบผ่านแอพ
          LINE แล้ว
        </Typography>
      </Container>
    )
  }

  if (renderError) {
    return (
      <Container
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          textAlign: 'center',
        }}
      >
        <Alert severity="error" sx={{ maxWidth: '80%' }}>
          {renderError}
        </Alert>
      </Container>
    )
  }

  if (!userId || !idToken) {
    return (
      <Container
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          textAlign: 'center',
        }}
      >
        <Typography color="textSecondary">
          ไม่สามารถโหลดข้อมูลผู้ใช้สำหรับรายงานได้ <br />{' '}
          กรุณาตรวจสอบว่าคุณได้เข้าสู่ระบบแล้ว
        </Typography>
      </Container>
    )
  }

  return (
    <Container
      maxWidth="lg"
      sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100vh' }}
    >
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar variant="dense">
          <IconButton
            edge="start"
            color="inherit"
            aria-label="back"
            onClick={handleLiffBack}
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, fontSize: '1.1rem' }}
          >
            {currentLang === 'th' ? 'รายงานโภชนาการ' : 'Nutrition Report'}
          </Typography>
          {/* Optional: Settings icon might go here */}
        </Toolbar>
        <Tabs
          value={tabValue}
          onChange={handleChangeTab}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          aria-label="nutrition report tabs"
        >
          <Tab
            label={currentLang === 'th' ? 'รายวัน' : 'Daily'}
            {...a11yProps(0)}
          />
          <Tab
            label={currentLang === 'th' ? 'รายสัปดาห์' : 'Weekly'}
            {...a11yProps(1)}
          />
          <Tab
            label={currentLang === 'th' ? 'รายเดือน' : 'Monthly'}
            {...a11yProps(2)}
          />
        </Tabs>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', backgroundColor: 'grey.50' }}>
        <TabPanel value={tabValue} index={0}>
          <DailyReportView />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <WeeklyReportView />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <MonthlyReportView />
        </TabPanel>
      </Box>
    </Container>
  )
}

export default NutritionReportMain
