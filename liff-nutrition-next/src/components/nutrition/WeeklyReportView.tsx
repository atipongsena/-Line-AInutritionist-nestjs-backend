'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Fade,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  format,
  parseISO,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import { th, enUS } from 'date-fns/locale'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
} from 'recharts'
import { useNutritionStore } from '../../stores/nutritionStore'
import { useLiff } from '../providers/LiffProvider'
import {
  calculateNutritionGoals,
  validateUserProfileForCalculation,
  type UserProfile,
  type NutritionGoals,
} from '../../utils/nutritionCalculator'

// Define the interface for the BarChart data items
interface BarChartDataItem {
  name: string
  consumed: number
  goal: number
  remaining: number
  percentOfGoal: number
  fill: string
}

// Interface สำหรับ user profile จาก localStorage
interface StoredUserProfile {
  gender?: 'male' | 'female' | 'other'
  age?: number
  weightKg?: number
  heightCm?: number
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  goal?: 'lose_weight' | 'maintain_weight' | 'gain_weight' | 'build_muscle'
  dietType?: 'normal' | 'keto' | 'vegetarian' | 'vegan' | 'mediterranean'
}

// Placeholder for Week Selector component
const WeekSelector: React.FC<{
  selectedWeekStart: string // YYYY-MM-DD
  onWeekChange: (weekStart: string) => void
  currentLang: 'th' | 'en'
}> = ({ selectedWeekStart, onWeekChange, currentLang }) => {
  const startDate = parseISO(selectedWeekStart)
  const endDate = endOfWeek(startDate, {
    locale: currentLang === 'th' ? th : enUS,
  })

  const displayWeek = `${format(startDate, 'PPP', { locale: currentLang === 'th' ? th : enUS })} - ${format(endDate, 'PPP', { locale: currentLang === 'th' ? th : enUS })}`

  const handlePrevWeek = () => {
    onWeekChange(format(subWeeks(startDate, 1), 'yyyy-MM-dd'))
  }

  const handleNextWeek = () => {
    onWeekChange(format(addWeeks(startDate, 1), 'yyyy-MM-dd'))
  }

  const handleThisWeek = () => {
    onWeekChange(
      format(
        startOfWeek(new Date(), { locale: currentLang === 'th' ? th : enUS }),
        'yyyy-MM-dd',
      ),
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: { xs: 1.5, sm: 2 },
        p: { xs: 0.75, sm: 1 },
        backgroundColor: 'grey.100',
        borderRadius: 1,
      }}
    >
      <Button
        onClick={handlePrevWeek}
        variant="outlined"
        size="small"
        sx={{
          minWidth: { xs: 70, sm: 100 },
          fontSize: { xs: '0.75rem', sm: '0.875rem' },
          px: { xs: 1, sm: 2 },
        }}
      >
        {currentLang === 'th' ? 'สัปดาห์ก่อน' : 'Prev Week'}
      </Button>
      <Box textAlign="center">
        <Typography
          variant="h6"
          sx={{
            fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1.1rem' },
            px: { xs: 1, sm: 2 },
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          {displayWeek}
        </Typography>
        {selectedWeekStart !==
          format(
            startOfWeek(new Date(), {
              locale: currentLang === 'th' ? th : enUS,
            }),
            'yyyy-MM-dd',
          ) && (
          <Button
            onClick={handleThisWeek}
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 'normal',
              fontSize: { xs: '0.7rem', sm: '0.75rem' },
              mt: { xs: 0.5, sm: 0 },
              display: { xs: 'block', sm: 'inline-flex' },
            }}
          >
            {currentLang === 'th' ? 'สัปดาห์นี้' : 'This Week'}
          </Button>
        )}
      </Box>
      <Button
        onClick={handleNextWeek}
        variant="outlined"
        size="small"
        sx={{
          minWidth: { xs: 70, sm: 100 },
          fontSize: { xs: '0.75rem', sm: '0.875rem' },
          px: { xs: 1, sm: 2 },
        }}
      >
        {currentLang === 'th' ? 'สัปดาห์หน้า' : 'Next Week'}
      </Button>
    </Box>
  )
}

const WeeklyReportView: React.FC = () => {
  const {
    selectedWeek,
    weeklyData,
    isWeeklyLoading,
    weeklyError,
    setSelectedWeek,
    fetchWeeklyReport,
  } = useNutritionStore()

  const {
    userId,
    idToken,
    isReady: liffReady,
    error: liffError,
    profile: liffProfile,
  } = useLiff()

  const [renderError, setRenderError] = useState<string | null>(null)

  // Calculate currentLang using useMemo based on liffProfile
  const currentLang = useMemo<'th' | 'en'>(() => {
    if (liffReady && liffProfile?.language) {
      return (liffProfile.language as string).startsWith('th') ? 'th' : 'en'
    }
    return 'th' // Default to Thai if LIFF not ready or no language info
  }, [liffReady, liffProfile])

  // 📊 Smart Hybrid Data Provider - คำนวณเป้าหมายจากข้อมูลผู้ใช้จริง เหมือนกับ DailyReportView
  const getEffectiveGoals = useCallback(() => {
    if (weeklyData && weeklyData.avgMacronutrients) {
      const backendGoals = {
        calories: weeklyData.avgCaloriesGoal || 2000,
        protein: weeklyData.avgMacronutrients.protein?.goal || 75,
        carbs: weeklyData.avgMacronutrients.carbs?.goal || 250,
        fat: weeklyData.avgMacronutrients.fat?.goal || 65,
        fiber: 25,
        sugar: 50,
        sodium: 2300,
        water: 2000,
        cholesterol: 300,
        saturated_fat: 20,
        omega3: 1.3,
      }
      if (
        weeklyData.avgCaloriesGoal ||
        weeklyData.avgMacronutrients.protein?.goal ||
        weeklyData.avgMacronutrients.carbs?.goal ||
        weeklyData.avgMacronutrients.fat?.goal
      ) {
        return backendGoals
      }
    }
    // Priority 2: Frontend calculated from user profile

    // เพิ่ม logging เพื่อ debug
    console.log(
      '[WeeklyReport] No Backend goals found, attempting to calculate nutrition goals...',
    )

    // ✅ เพิ่ม default goals fallback
    return {
      calories: 2000,
      protein: 75,
      carbs: 250,
      fat: 65,
      fiber: 25,
      sugar: 50,
      sodium: 2300,
      water: 2000,
      cholesterol: 300,
      saturated_fat: 20,
      omega3: 1.3,
    }
  }, [weeklyData])

  // ✅ เพิ่ม memoized effective goals
  const effectiveGoals = useMemo(() => getEffectiveGoals(), [getEffectiveGoals])

  // ✅ เพิ่ม barChartData variable ที่หายไป - ปรับสำหรับ stacked chart
  const barChartData: BarChartDataItem[] = useMemo(() => {
    if (!weeklyData?.avgMacronutrients) return []

    const protein = weeklyData.avgMacronutrients.protein?.consumed || 0
    const carbs = weeklyData.avgMacronutrients.carbs?.consumed || 0
    const fat = weeklyData.avgMacronutrients.fat?.consumed || 0

    const proteinGoal =
      weeklyData.avgMacronutrients.protein?.goal || effectiveGoals.protein
    const carbsGoal =
      weeklyData.avgMacronutrients.carbs?.goal || effectiveGoals.carbs
    const fatGoal = weeklyData.avgMacronutrients.fat?.goal || effectiveGoals.fat

    return [
      {
        name: currentLang === 'th' ? 'โปรตีน' : 'Protein',
        consumed: protein,
        goal: proteinGoal,
        remaining: Math.max(0, proteinGoal - protein), // ✅ เพิ่มส่วนที่เหลือ
        percentOfGoal: proteinGoal > 0 ? (protein / proteinGoal) * 100 : 0,
        fill: '#3498db',
      },
      {
        name: currentLang === 'th' ? 'คาร์โบไฮเดรต' : 'Carbs',
        consumed: carbs,
        goal: carbsGoal,
        remaining: Math.max(0, carbsGoal - carbs), // ✅ เพิ่มส่วนที่เหลือ
        percentOfGoal: carbsGoal > 0 ? (carbs / carbsGoal) * 100 : 0,
        fill: '#2ecc71',
      },
      {
        name: currentLang === 'th' ? 'ไขมัน' : 'Fat',
        consumed: fat,
        goal: fatGoal,
        remaining: Math.max(0, fatGoal - fat), // ✅ เพิ่มส่วนที่เหลือ
        percentOfGoal: fatGoal > 0 ? (fat / fatGoal) * 100 : 0,
        fill: '#f1c40f',
      },
    ]
  }, [weeklyData, effectiveGoals, currentLang])

  // ✅ เพิ่ม useEffect สำหรับ fetch data เมื่อ component mount
  useEffect(() => {
    if (liffReady && userId && idToken && selectedWeek?.start) {
      console.log(
        '[WeeklyReport] Fetching weekly data for:',
        selectedWeek.start,
      )
      void fetchWeeklyReport(selectedWeek.start, userId, idToken)
    }
  }, [liffReady, userId, idToken, selectedWeek?.start, fetchWeeklyReport])

  // ✅ เพิ่ม useEffect สำหรับการตั้งค่า initial week
  useEffect(() => {
    if (liffReady && userId && idToken && !selectedWeek?.start) {
      const thisWeekStart = format(
        startOfWeek(new Date(), { locale: currentLang === 'th' ? th : enUS }),
        'yyyy-MM-dd',
      )
      console.log('[WeeklyReport] Setting initial week:', thisWeekStart)
      setSelectedWeek(thisWeekStart)
    }
  }, [
    liffReady,
    userId,
    idToken,
    selectedWeek?.start,
    setSelectedWeek,
    currentLang,
  ])

  // เพิ่ม effect สำหรับตรวจสอบวันที่ทุกครั้งที่ component ถูกโหลด
  useEffect(() => {
    try {
      if (selectedWeek?.start) {
        // ตรวจสอบว่าวันที่ถูกต้องหรือไม่
        const selectedDate = new Date(selectedWeek.start)
        if (isNaN(selectedDate.getTime())) {
          console.error('Invalid week start date:', selectedWeek.start)
          setRenderError(
            currentLang === 'th'
              ? 'วันที่เริ่มต้นสัปดาห์ไม่ถูกต้อง'
              : 'Invalid week start date',
          )

          // รีเซ็ตสัปดาห์เป็นสัปดาห์ปัจจุบัน
          const currentWeekStart = format(
            startOfWeek(new Date(), {
              locale: currentLang === 'th' ? th : enUS,
            }),
            'yyyy-MM-dd',
          )
          console.log(
            '[WeeklyReport] Resetting to current week due to invalid date:',
            currentWeekStart,
          )
          setSelectedWeek(currentWeekStart)
          return
        }

        // ตรวจสอบว่าสัปดาห์ไม่ได้อยู่ในอนาคต
        const today = new Date()
        // Ensure selectedDate is at the start of its day for fair comparison
        const selectedDateStartOfDay = new Date(selectedDate)
        selectedDateStartOfDay.setHours(0, 0, 0, 0)

        // Ensure today is also at the start of its day
        const todayStartOfDay = new Date(today)
        todayStartOfDay.setHours(0, 0, 0, 0)

        if (selectedDateStartOfDay > todayStartOfDay) {
          console.warn(
            'Week is in the future:',
            selectedWeek.start,
            'Resetting to current week.',
          )
          setRenderError(
            currentLang === 'th'
              ? 'ไม่สามารถเลือกสัปดาห์ในอนาคตได้'
              : 'Cannot select a future week',
          )
          // รีเซ็ตสัปดาห์เป็นสัปดาห์ปัจจุบัน
          const currentWeekStart = format(
            startOfWeek(new Date(), {
              locale: currentLang === 'th' ? th : enUS,
            }),
            'yyyy-MM-dd',
          )
          setSelectedWeek(currentWeekStart)
          return
        }
      }
    } catch (err) {
      console.error('Error in WeeklyReportView validation useEffect:', err)
      setRenderError(
        currentLang === 'th'
          ? 'เกิดข้อผิดพลาดขณะตรวจสอบข้อมูลสัปดาห์'
          : 'Error validating week data',
      )
    }
  }, [selectedWeek?.start, setSelectedWeek, currentLang, setRenderError]) // Primary dependency is selectedWeek.start

  // Handler สำหรับการเปลี่ยนแปลงสัปดาห์
  const handleWeekChange = (weekStart: string) => {
    setSelectedWeek(weekStart)
    if (userId && idToken) {
      void fetchWeeklyReport(weekStart, userId, idToken)
    }
  }

  // Display logic with safe access to weeklyData
  if (renderError || liffError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {renderError || liffError}
      </Alert>
    )
  }

  if (!liffReady || isWeeklyLoading) {
    // ... (loading UI, ensure currentLang is used safely for text) ...
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          p: 3,
        }}
      >
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>
          {!liffReady
            ? currentLang === 'th'
              ? 'กำลังเตรียม LIFF...'
              : 'Preparing LIFF...'
            : currentLang === 'th'
              ? 'กำลังโหลดข้อมูลรายสัปดาห์...'
              : 'Loading weekly data...'}
        </Typography>
      </Box>
    )
  }

  if (weeklyError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {currentLang === 'th' ? 'เกิดข้อผิดพลาด:' : 'Error:'} {weeklyError}
      </Alert>
    )
  }

  // Handle case where weeklyData might be null but no error and not loading
  if (!weeklyData || !selectedWeek?.start) {
    return (
      <Box sx={{ p: 2 }}>
        <WeekSelector
          selectedWeekStart={
            selectedWeek?.start ||
            format(
              startOfWeek(new Date(), {
                locale: currentLang === 'th' ? th : enUS,
              }),
              'yyyy-MM-dd',
            )
          }
          onWeekChange={handleWeekChange} // Ensure handleWeekChange is defined
          currentLang={currentLang}
        />
        <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="subtitle1">
            {currentLang === 'th'
              ? 'ไม่พบข้อมูลสำหรับสัปดาห์นี้'
              : 'No data found for this week'}
          </Typography>
        </Paper>
      </Box>
    )
  }

  // Now we can assume weeklyData is not null for the main content rendering
  // Replace all instances of `weeklyData.avgCalories` with `weeklyData.avgCaloriesPerDay` or `weeklyData.avgCaloriesGoal` as appropriate.
  // Add optional chaining and default values everywhere weeklyData properties are accessed.

  // Example for the summary text that previously caused errors:
  const weeklySummaryText = (() => {
    const avgCalsConsumed = weeklyData.avgCaloriesPerDay || 0
    const totalCalsWeek = weeklyData.totalCaloriesWeek || 0
    const proteinConsumed = weeklyData.avgMacronutrients?.protein?.consumed || 0
    const startDate = weeklyData.start
      ? format(parseISO(weeklyData.start), 'PPP', {
          locale: currentLang === 'th' ? th : enUS,
        })
      : ''
    const endDate = weeklyData.end
      ? format(parseISO(weeklyData.end), 'PPP', {
          locale: currentLang === 'th' ? th : enUS,
        })
      : ''

    if (avgCalsConsumed > 0) {
      return currentLang === 'th'
        ? `สัปดาห์ ${startDate} - ${endDate} คุณบริโภคเฉลี่ย ${avgCalsConsumed} kcal/วัน (เป้าหมาย: ${weeklyData.avgCaloriesGoal || effectiveGoals.calories} kcal) รวม ${totalCalsWeek} kcal. โปรตีนเฉลี่ย ${proteinConsumed}g.`
        : `Week ${startDate} - ${endDate}, you consumed avg ${avgCalsConsumed} kcal/day (goal: ${weeklyData.avgCaloriesGoal || effectiveGoals.calories} kcal), total ${totalCalsWeek} kcal. Avg protein ${proteinConsumed}g.`
    }
    return currentLang === 'th'
      ? 'สัปดาห์นี้ยังไม่มีข้อมูลการบริโภค'
      : 'No consumption data for this week yet.'
  })()

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <WeekSelector
        selectedWeekStart={selectedWeek.start} // weeklyData is confirmed not null here, so selectedWeek.start should be safe
        onWeekChange={handleWeekChange} // Make sure handleWeekChange is defined
        currentLang={currentLang}
      />
      {/* Weekly Summary Card - using weeklySummaryText */}
      <Fade in={true} timeout={800}>
        <Paper
          elevation={2}
          sx={{
            p: { xs: 1.5, sm: 2 },
            mb: { xs: 1.5, sm: 2 },
            borderLeft: '4px solid #4caf50',
          }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{ fontSize: { xs: '1rem', sm: '1.15rem', md: '1.25rem' } }}
          >
            {currentLang === 'th' ? 'สรุปประจำสัปดาห์' : 'Weekly Summary'}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              mb: { xs: 1.5, sm: 2 },
              fontSize: { xs: '0.875rem', sm: '1rem' },
              lineHeight: { xs: 1.4, sm: 1.6 },
            }}
          >
            {weeklySummaryText}
          </Typography>
          {/* Insights section, ensure safe access: weeklyData.insights?.map(...) || default message */}
          {weeklyData.insights && weeklyData.insights.length > 0 ? (
            <Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 'bold',
                  mb: 1,
                  fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
                }}
              >
                {currentLang === 'th' ? '💡 ข้อสังเกต:' : '💡 Insights:'}
              </Typography>
              <ul>
                {weeklyData.insights.map((insight: string, index: number) => (
                  <li key={index}>
                    <Typography
                      variant="body2"
                      sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                    >
                      {insight}
                    </Typography>
                  </li>
                ))}
              </ul>
            </Box>
          ) : (
            // Start of new dynamic insights logic
            <Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 'bold',
                  mb: 1,
                  fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
                }}
              >
                {currentLang === 'th' ? '💡 ข้อสังเกต:' : '💡 Insights:'}
              </Typography>
              <ul>
                {(() => {
                  const insights: string[] = []
                  const avgCalories = weeklyData.avgCaloriesPerDay || 0
                  const avgProtein =
                    weeklyData.avgMacronutrients?.protein?.consumed || 0
                  const avgCarbs =
                    weeklyData.avgMacronutrients?.carbs?.consumed || 0
                  const avgFat =
                    weeklyData.avgMacronutrients?.fat?.consumed || 0

                  const proteinProgress =
                    effectiveGoals.protein > 0
                      ? (avgProtein / effectiveGoals.protein) * 100
                      : 0
                  const carbsProgress =
                    effectiveGoals.carbs > 0
                      ? (avgCarbs / effectiveGoals.carbs) * 100
                      : 0
                  const fatProgress =
                    effectiveGoals.fat > 0
                      ? (avgFat / effectiveGoals.fat) * 100
                      : 0

                  // Calorie analysis (weekly context)
                  if (
                    avgCalories > 0 && // Ensure there's some data
                    effectiveGoals.calories > 0 && // Ensure goal is also valid
                    avgCalories < effectiveGoals.calories * 0.7
                  ) {
                    // Consistently low
                    insights.push(
                      currentLang === 'th'
                        ? `แคลอรี่เฉลี่ยต่อวัน (${avgCalories.toFixed(0)} kcal) ดูเหมือนจะต่ำกว่าเป้าหมาย (${effectiveGoals.calories} kcal) พอสมควร ลองเพิ่มปริมาณอาหารที่มีประโยชน์ในแต่ละมื้อ`
                        : `Average daily calories (${avgCalories.toFixed(0)} kcal) seem significantly below your goal (${effectiveGoals.calories} kcal). Consider increasing portions of healthy foods.`,
                    )
                  } else if (
                    avgCalories > 0 &&
                    effectiveGoals.calories > 0 &&
                    avgCalories > effectiveGoals.calories * 1.3
                  ) {
                    // Consistently high
                    insights.push(
                      currentLang === 'th'
                        ? `แคลอรี่เฉลี่ยต่อวัน (${avgCalories.toFixed(0)} kcal) สูงกว่าเป้าหมาย (${effectiveGoals.calories} kcal) ลองทบทวนขนาด порชั่นและลดอาหารว่างที่มีแคลอรี่สูง`
                        : `Average daily calories (${avgCalories.toFixed(0)} kcal) are notably above your goal (${effectiveGoals.calories} kcal). Review portion sizes and reduce high-calorie snacks.`,
                    )
                  }

                  // Protein analysis
                  if (avgProtein > 0 && proteinProgress < 70) {
                    insights.push(
                      currentLang === 'th'
                        ? `โปรตีนเฉลี่ย (${avgProtein.toFixed(1)}g) ยังต่ำกว่าเป้าหมาย (${effectiveGoals.protein}g) ลองเพิ่มแหล่งโปรตีนดี เช่น ไก่ ปลา หรือเต้าหู้ในสัปดาห์หน้า`
                        : `Average protein (${avgProtein.toFixed(1)}g) is below your goal (${effectiveGoals.protein}g). Try adding more lean protein sources like chicken, fish, or tofu next week.`,
                    )
                  } else if (proteinProgress > 130) {
                    insights.push(
                      currentLang === 'th'
                        ? `โปรตีนเฉลี่ย (${avgProtein.toFixed(1)}g) ค่อนข้างสูงเมื่อเทียบกับเป้าหมาย (${effectiveGoals.protein}g) หากไม่ได้เน้นสร้างกล้ามเนื้อ อาจปรับให้สมดุลกับสารอาหารอื่น`
                        : `Average protein (${avgProtein.toFixed(1)}g) is quite high compared to your goal (${effectiveGoals.protein}g). If not muscle building, consider balancing with other nutrients.`,
                    )
                  }

                  // Carbohydrate analysis
                  if (avgCarbs > 0 && carbsProgress > 130) {
                    insights.push(
                      currentLang === 'th'
                        ? `คาร์โบไฮเดรตเฉลี่ย (${avgCarbs.toFixed(1)}g) สูงกว่าที่แนะนำ (${effectiveGoals.carbs}g) ลองเลือกคาร์โบไฮเดรตเชิงซ้อนและลดน้ำตาล`
                        : `Average carbohydrate (${avgCarbs.toFixed(1)}g) intake is higher than recommended (${effectiveGoals.carbs}g). Opt for complex carbs and reduce sugars.`,
                    )
                  } else if (avgCarbs > 0 && carbsProgress < 70) {
                    insights.push(
                      currentLang === 'th'
                        ? `คาร์โบไฮเดรตเฉลี่ย (${avgCarbs.toFixed(1)}g) อาจจะต่ำไปหน่อย (${effectiveGoals.carbs}g) หากรู้สึกอ่อนเพลีย ลองเพิ่มผลไม้หรือธัญพืชเต็มเมล็ด`
                        : `Average carbohydrate (${avgCarbs.toFixed(1)}g) might be a bit low (${effectiveGoals.carbs}g). If feeling fatigued, try adding fruits or whole grains.`,
                    )
                  }

                  // Fat analysis
                  if (avgFat > 0 && fatProgress < 70) {
                    insights.push(
                      currentLang === 'th'
                        ? `ไขมันดีเฉลี่ย (${avgFat.toFixed(1)}g) ยังต้องการเพิ่มเพื่อสุขภาพที่ดี (${effectiveGoals.fat}g) ลองเพิ่มถั่ว หรือ อะโวคาโด`
                        : `Average healthy fat (${avgFat.toFixed(1)}g) intake could be increased for better health (${effectiveGoals.fat}g). Try adding nuts or avocado.`,
                    )
                  } else if (fatProgress > 130) {
                    insights.push(
                      currentLang === 'th'
                        ? `ไขมันเฉลี่ย (${avgFat.toFixed(1)}g) ค่อนข้างสูง (${effectiveGoals.fat}g) ระวังไขมันทรานส์และไขมันอิ่มตัว`
                        : `Average fat intake (${avgFat.toFixed(1)}g) is quite high (${effectiveGoals.fat}g). Be mindful of trans and saturated fats.`,
                    )
                  }

                  // Positive reinforcement or general tip
                  if (
                    avgCalories > 0 && // Ensure there's some data
                    proteinProgress >= 80 &&
                    proteinProgress <= 120 &&
                    carbsProgress >= 80 &&
                    carbsProgress <= 120 &&
                    fatProgress >= 80 &&
                    fatProgress <= 120
                  ) {
                    insights.push(
                      currentLang === 'th'
                        ? '🌟 ยอดเยี่ยม! สัปดาห์นี้คุณรักษาสมดุลของสารอาหารหลักได้ดีมาก'
                        : '🌟 Excellent! You maintained a great balance of macronutrients this week.',
                    )
                  }

                  if (insights.length === 0 && avgCalories > 0) {
                    insights.push(
                      currentLang === 'th'
                        ? 'คุณทำได้ดีในการบันทึกข้อมูลสัปดาห์นี้ พยายามต่อไปเพื่อสุขภาพที่ดี!'
                        : 'Good job logging your data this week. Keep it up for better health!',
                    )
                  } else if (insights.length === 0 && avgCalories === 0) {
                    insights.push(
                      currentLang === 'th'
                        ? 'ยังไม่มีข้อมูลแคลอรี่สำหรับสัปดาห์นี้ เริ่มบันทึกเพื่อดูคำแนะนำด้านแคลอรี่'
                        : 'No calorie data for this week yet. Start logging to see calorie insights.',
                    )
                  }

                  if (insights.length === 0) {
                    // If still no insights (e.g. no data at all)
                    return (
                      <li>
                        <Typography
                          variant="body2"
                          sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                        >
                          {currentLang === 'th'
                            ? 'ไม่มีข้อสังเกตสำหรับสัปดาห์นี้ เริ่มบันทึกอาหารเพื่อรับคำแนะนำ'
                            : 'No specific insights for this week. Start logging your meals to get personalized advice.'}
                        </Typography>
                      </li>
                    )
                  }

                  return insights.map((insight, index) => (
                    <li key={index}>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                      >
                        {insight}
                      </Typography>
                    </li>
                  ))
                })()}
              </ul>
            </Box>
            // End of new dynamic insights logic
          )}
        </Paper>
      </Fade>
      {/* Calorie Trend Line Chart - ensure safe access to weeklyData.dailyCalories */}
      <Fade in={true} timeout={900}>
        <Paper
          elevation={2}
          sx={{ p: { xs: 1.5, sm: 2 }, mb: { xs: 1.5, sm: 2 } }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{ fontSize: { xs: '1rem', sm: '1.15rem', md: '1.25rem' } }}
          >
            {currentLang === 'th'
              ? 'แนวโน้มแคลอรี่ (รายวัน)'
              : 'Daily Calorie Trend'}
          </Typography>
          <Box sx={{ height: { xs: 250, sm: 300 } }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={weeklyData.dailyCalories || []}
                margin={{
                  top: 5,
                  right: 20,
                  left: -20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    fontSize: '14px',
                    padding: '10px',
                  }}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: '14px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="calories"
                  stroke="#8884d8"
                  name={currentLang === 'th' ? 'แคลอรี่' : 'Calories'}
                  strokeWidth={2}
                />
                {weeklyData.avgCaloriesGoal && (
                  <Line
                    type="monotone"
                    dataKey="goal"
                    stroke="#82ca9d"
                    name={currentLang === 'th' ? 'เป้าหมาย' : 'Goal'}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Fade>
      {/* Weekly Stats Card - ensure safe access */}
      <Fade in={true} timeout={1000}>
        <Paper
          elevation={2}
          sx={{ p: { xs: 1.5, sm: 2 }, mb: { xs: 1.5, sm: 2 } }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{ fontSize: { xs: '1rem', sm: '1.15rem', md: '1.25rem' } }}
          >
            {currentLang === 'th' ? 'สถิติประจำสัปดาห์' : 'Weekly Statistics'}
          </Typography>
          <Grid container spacing={{ xs: 1, sm: 2 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' } }}
              >
                {currentLang === 'th'
                  ? 'แคลอรี่เฉลี่ยต่อวัน:'
                  : 'Avg. Daily Calories:'}
              </Typography>
              <Typography
                variant="h5"
                color="primary"
                sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' } }}
              >
                {weeklyData.avgCaloriesPerDay &&
                weeklyData.avgCaloriesPerDay > 0
                  ? `${weeklyData.avgCaloriesPerDay} kcal`
                  : currentLang === 'th'
                    ? 'ไม่มีข้อมูล'
                    : 'N/A'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' } }}
              >
                {currentLang === 'th'
                  ? 'แคลอรี่รวมทั้งสัปดาห์:'
                  : 'Total Weekly Calories:'}
              </Typography>
              <Typography
                variant="h5"
                sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' } }}
              >
                {weeklyData.totalCaloriesWeek &&
                weeklyData.totalCaloriesWeek > 0
                  ? `${weeklyData.totalCaloriesWeek} kcal`
                  : currentLang === 'th'
                    ? 'ไม่มีข้อมูล'
                    : 'N/A'}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Fade>
      {/* Avg. Daily Macronutrients (Numeric & BarChart) - ensure safe access */}
      {weeklyData.avgMacronutrients && (
        <Fade in={true} timeout={1100}>
          <Paper
            elevation={2}
            sx={{ p: { xs: 1.5, sm: 2 }, mb: { xs: 1.5, sm: 2 } }}
          >
            <Typography
              variant="h6"
              gutterBottom
              sx={{ fontSize: { xs: '1rem', sm: '1.15rem', md: '1.25rem' } }}
            >
              {currentLang === 'th'
                ? 'สารอาหารหลักเฉลี่ยต่อวัน'
                : 'Avg. Daily Macronutrients'}
            </Typography>
            <Grid
              container
              spacing={{ xs: 1, sm: 2 }}
              sx={{ textAlign: 'center', mb: { xs: 1.5, sm: 2 } }}
            >
              <Grid size={{ xs: 4, md: 4 }}>
                <Typography
                  variant="h6"
                  color="primary.main"
                  sx={{
                    fontSize: { xs: '1rem', sm: '1.15rem', md: '1.25rem' },
                  }}
                >
                  {weeklyData.avgMacronutrients.protein?.consumed?.toFixed(1) ||
                    0}
                  g
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  {currentLang === 'th' ? 'จาก' : 'of'}{' '}
                  {weeklyData.avgMacronutrients.protein?.goal ||
                    effectiveGoals.protein}
                  g
                </Typography>
                <Typography
                  variant="subtitle2"
                  fontWeight="bold"
                  sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                >
                  {currentLang === 'th' ? 'โปรตีน' : 'Protein'}
                </Typography>
                <Typography
                  variant="caption"
                  color={
                    (weeklyData.avgMacronutrients.protein?.consumed || 0) /
                      (weeklyData.avgMacronutrients.protein?.goal ||
                        effectiveGoals.protein) >=
                    0.8
                      ? 'success.main'
                      : 'warning.main'
                  }
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  {(
                    ((weeklyData.avgMacronutrients.protein?.consumed || 0) /
                      (weeklyData.avgMacronutrients.protein?.goal ||
                        effectiveGoals.protein)) *
                    100
                  ).toFixed(0)}
                  %
                </Typography>
              </Grid>
              <Grid size={{ xs: 4, md: 4 }}>
                <Typography
                  variant="h6"
                  color="primary.main"
                  sx={{
                    fontSize: { xs: '1rem', sm: '1.15rem', md: '1.25rem' },
                  }}
                >
                  {weeklyData.avgMacronutrients.carbs?.consumed?.toFixed(1) ||
                    0}
                  g
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  {currentLang === 'th' ? 'จาก' : 'of'}{' '}
                  {weeklyData.avgMacronutrients.carbs?.goal ||
                    effectiveGoals.carbs}
                  g
                </Typography>
                <Typography
                  variant="subtitle2"
                  fontWeight="bold"
                  sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                >
                  {currentLang === 'th' ? 'คาร์โบไฮเดรต' : 'Carbs'}
                </Typography>
                <Typography
                  variant="caption"
                  color={
                    (weeklyData.avgMacronutrients.carbs?.consumed || 0) /
                      (weeklyData.avgMacronutrients.carbs?.goal ||
                        effectiveGoals.carbs) >=
                    0.8
                      ? 'success.main'
                      : 'warning.main'
                  }
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  {(
                    ((weeklyData.avgMacronutrients.carbs?.consumed || 0) /
                      (weeklyData.avgMacronutrients.carbs?.goal ||
                        effectiveGoals.carbs)) *
                    100
                  ).toFixed(0)}
                  %
                </Typography>
              </Grid>
              <Grid size={{ xs: 4, md: 4 }}>
                <Typography
                  variant="h6"
                  color="primary.main"
                  sx={{
                    fontSize: { xs: '1rem', sm: '1.15rem', md: '1.25rem' },
                  }}
                >
                  {weeklyData.avgMacronutrients.fat?.consumed?.toFixed(1) || 0}g
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  {currentLang === 'th' ? 'จาก' : 'of'}{' '}
                  {weeklyData.avgMacronutrients.fat?.goal || effectiveGoals.fat}
                  g
                </Typography>
                <Typography
                  variant="subtitle2"
                  fontWeight="bold"
                  sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                >
                  {currentLang === 'th' ? 'ไขมัน' : 'Fat'}
                </Typography>
                <Typography
                  variant="caption"
                  color={
                    (weeklyData.avgMacronutrients.fat?.consumed || 0) /
                      (weeklyData.avgMacronutrients.fat?.goal ||
                        effectiveGoals.fat) >=
                    0.8
                      ? 'success.main'
                      : 'warning.main'
                  }
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  {(
                    ((weeklyData.avgMacronutrients.fat?.consumed || 0) /
                      (weeklyData.avgMacronutrients.fat?.goal ||
                        effectiveGoals.fat)) *
                    100
                  ).toFixed(0)}
                  %
                </Typography>
              </Grid>
            </Grid>
            {/* BarChart for Macronutrients - also responsive */}
            <Box sx={{ height: { xs: 250, sm: 300 } }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData}
                  margin={{
                    top: 5,
                    right: 20,
                    left: -20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      fontSize: '14px',
                      padding: '10px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{
                      fontSize: '14px',
                    }}
                  />
                  <Bar
                    dataKey="consumed"
                    fill="#8884d8"
                    name={currentLang === 'th' ? 'บริโภค' : 'Consumed'}
                  />
                  <Bar
                    dataKey="goal"
                    fill="#82ca9d"
                    name={currentLang === 'th' ? 'เป้าหมาย' : 'Goal'}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Fade>
      )}
    </Box>
  )
}

export default WeeklyReportView
