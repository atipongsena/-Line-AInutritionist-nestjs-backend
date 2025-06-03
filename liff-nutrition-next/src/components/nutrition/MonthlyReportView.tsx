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
import { format, parseISO, addMonths, subMonths } from 'date-fns'
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
} from 'recharts'
import { useNutritionStore } from '../../stores/nutritionStore'
import { useLiff } from '../providers/LiffProvider'
import {
  calculateNutritionGoals,
  validateUserProfileForCalculation,
  type UserProfile,
  type NutritionGoals,
} from '../../utils/nutritionCalculator'

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

// Interface สำหรับ BarChart data items
interface BarChartDataItem {
  name: string
  consumed: number
  goal: number
  remaining: number
  percentOfGoal: number
  fill: string
}

// Placeholder for Month Selector component
const MonthSelector: React.FC<{
  selectedMonth: string // YYYY-MM
  onMonthChange: (month: string) => void
  currentLang: 'th' | 'en'
}> = ({ selectedMonth, onMonthChange, currentLang }) => {
  const currentMonthDate = parseISO(`${selectedMonth}-01`)

  const displayMonth = format(currentMonthDate, 'LLLL yyyy', {
    locale: currentLang === 'th' ? th : enUS,
  })

  const handlePrevMonth = () => {
    onMonthChange(format(subMonths(currentMonthDate, 1), 'yyyy-MM'))
  }

  const handleNextMonth = () => {
    onMonthChange(format(addMonths(currentMonthDate, 1), 'yyyy-MM'))
  }

  const handleThisMonth = () => {
    onMonthChange(format(new Date(), 'yyyy-MM'))
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
        onClick={handlePrevMonth}
        variant="outlined"
        size="small"
        sx={{
          minWidth: { xs: 70, sm: 100 },
          fontSize: { xs: '0.75rem', sm: '0.875rem' },
          px: { xs: 1, sm: 2 },
        }}
      >
        {currentLang === 'th' ? 'เดือนก่อน' : 'Prev Month'}
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
          {displayMonth}
        </Typography>
        {selectedMonth !== format(new Date(), 'yyyy-MM') && (
          <Button
            onClick={handleThisMonth}
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 'normal',
              fontSize: { xs: '0.7rem', sm: '0.75rem' },
              mt: { xs: 0.5, sm: 0 },
              display: { xs: 'block', sm: 'inline-flex' },
            }}
          >
            {currentLang === 'th' ? 'เดือนนี้' : 'This Month'}
          </Button>
        )}
      </Box>
      <Button
        onClick={handleNextMonth}
        variant="outlined"
        size="small"
        sx={{
          minWidth: { xs: 70, sm: 100 },
          fontSize: { xs: '0.75rem', sm: '0.875rem' },
          px: { xs: 1, sm: 2 },
        }}
      >
        {currentLang === 'th' ? 'เดือนหน้า' : 'Next Month'}
      </Button>
    </Box>
  )
}

const MonthlyReportView: React.FC = () => {
  const {
    selectedMonth,
    monthlyData,
    isMonthlyLoading,
    monthlyError,
    setSelectedMonth,
    fetchMonthlyReport,
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

  // ฟังก์ชันสำหรับคำนวณ goals โดยใช้ลำดับความสำคัญ
  const getEffectiveGoals = useCallback(() => {
    let calculatedGoals: NutritionGoals | null = null

    // Priority 1: Backend data (most accurate)
    if (monthlyData?.avgMacronutrients) {
      const backendGoals = {
        calories: monthlyData.avgCaloriesGoal || 0,
        protein: monthlyData.avgMacronutrients.protein?.goal || 0,
        carbs: monthlyData.avgMacronutrients.carbs?.goal || 0,
        fat: monthlyData.avgMacronutrients.fat?.goal || 0,
        fiber: 25, // Default values since MonthlyData doesn't have these fields
        sugar: 50,
        sodium: 2300,
        water: 2000,
        cholesterol: 300,
        saturated_fat: 20,
        omega3: 1.6,
      }

      // Use backend data if calories goal is valid
      if (backendGoals.calories > 0) {
        console.log('[MonthlyReport] Using backend nutrition goals')
        return backendGoals
      }
    }

    // Priority 1.5: User profile stored nutrition goals (from database)
    try {
      const cachedProfile = localStorage.getItem(`userProfile_${userId}`)
      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile) as any // Cast to access all fields

        const storedGoals = {
          calories: profile.dailyCaloriesGoal || 0,
          protein: profile.dailyProteinGoal || 0,
          carbs: profile.dailyCarbsGoal || 0,
          fat: profile.dailyFatGoal || 0,
          fiber: profile.dailyFiberGoal || 25,
          sugar: profile.dailySugarGoal || 50,
          sodium: profile.dailySodiumGoal || 2300,
          water: profile.dailyWaterGoal || 2000,
          cholesterol: profile.dailyCholesterolGoal || 300,
          saturated_fat: profile.dailySaturatedFatGoal || 20,
          omega3: profile.dailyOmega3Goal || 1.6,
        }

        // Use stored goals if they have valid values (greater than 0 for main nutrients)
        if (storedGoals.calories > 0 && storedGoals.protein > 0) {
          console.log(
            '[MonthlyReport] Using stored nutrition goals from user profile',
          )
          return storedGoals
        }
      }
    } catch (error) {
      console.error(
        '[MonthlyReport] Error accessing stored profile goals:',
        error,
      )
    }

    // Priority 2: Frontend calculated fallback
    try {
      const cachedProfile = localStorage.getItem(`userProfile_${userId}`)
      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile) as StoredUserProfile

        // ตรวจสอบข้อมูลที่จำเป็นสำหรับการคำนวณ
        if (
          profile.gender &&
          profile.age &&
          profile.weightKg &&
          profile.heightCm &&
          profile.activityLevel &&
          profile.goal
        ) {
          const userProfile: UserProfile = {
            gender: profile.gender,
            age: profile.age,
            weightKg: profile.weightKg,
            heightCm: profile.heightCm,
            activityLevel: profile.activityLevel || 'moderate',
            goal: profile.goal || 'maintain_weight',
            dietType: profile.dietType || 'normal',
          }

          console.log(
            '[MonthlyReport] User profile for calculation:',
            userProfile,
          )

          // ตรวจสอบข้อมูลและคำนวณ
          if (validateUserProfileForCalculation(userProfile)) {
            calculatedGoals = calculateNutritionGoals(userProfile)
            console.log('[MonthlyReport] Calculated goals:', calculatedGoals)
          } else {
            console.warn('[MonthlyReport] User profile validation failed')
          }
        }
      } else {
        console.warn('[MonthlyReport] No user profile found in localStorage')
      }
    } catch (error) {
      console.error('[MonthlyReport] Error calculating nutrition goals:', error)
    }

    // Priority 3: Default values (last resort)
    const defaultGoals = {
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

    const finalGoals = calculatedGoals || defaultGoals
    console.log(
      '[MonthlyReport] Using goals (calculated or default):',
      finalGoals,
    )
    return finalGoals
  }, [monthlyData, userId])

  // Memoized effective goals
  const effectiveGoals = useMemo(() => {
    const goals = getEffectiveGoals()
    console.log('[MonthlyReport] Final effective goals:', goals)
    return goals
  }, [getEffectiveGoals])

  // เพิ่ม effect เพื่อเตรียมข้อมูลเริ่มต้นสำหรับรายงานรายเดือน
  useEffect(() => {
    if (liffReady && userId && idToken) {
      // ถ้ายังไม่มีเดือนที่เลือก ให้ใช้เดือนปัจจุบัน
      if (!selectedMonth) {
        const thisMonth = format(new Date(), 'yyyy-MM')
        setSelectedMonth(thisMonth)
      } else {
        // ถ้ามีเดือนที่เลือกแล้ว ให้ดึงข้อมูลรายงาน
        void fetchMonthlyReport(selectedMonth, userId, idToken)
      }
    }
  }, [
    liffReady,
    userId,
    idToken,
    selectedMonth,
    fetchMonthlyReport,
    setSelectedMonth,
  ])

  // เพิ่ม effect สำหรับตรวจสอบวันที่ทุกครั้งที่ component ถูกโหลด
  useEffect(() => {
    try {
      if (selectedMonth) {
        // ตรวจสอบว่าเดือนถูกต้องหรือไม่
        if (!/^\d{4}-\d{2}$/.test(selectedMonth)) {
          console.error('Invalid month format:', selectedMonth)
          setRenderError('รูปแบบเดือนไม่ถูกต้อง')

          // รีเซ็ตเดือนเป็นเดือนปัจจุบัน
          const thisMonth = format(new Date(), 'yyyy-MM')
          setSelectedMonth(thisMonth)
          return
        }

        const selectedMonthDate = new Date(`${selectedMonth}-01`)
        if (isNaN(selectedMonthDate.getTime())) {
          console.error('Invalid month date:', selectedMonth)
          setRenderError('เดือนไม่ถูกต้อง')

          // รีเซ็ตเดือนเป็นเดือนปัจจุบัน
          const thisMonth = format(new Date(), 'yyyy-MM')
          setSelectedMonth(thisMonth)
          return
        }

        // ตรวจสอบว่าเดือนไม่ได้อยู่ในอนาคต
        const today = new Date()
        const currentMonth = format(today, 'yyyy-MM')
        if (selectedMonth > currentMonth) {
          console.error('Month is in the future:', selectedMonth)

          // รีเซ็ตเดือนเป็นเดือนปัจจุบัน
          setSelectedMonth(currentMonth)
          return
        }
      }
    } catch (err) {
      console.error('Error in MonthlyReportView useEffect:', err)
      setRenderError('เกิดข้อผิดพลาดขณะแสดงรายงานเดือน')
    }
  }, [selectedMonth, setSelectedMonth])

  // Handler สำหรับการเปลี่ยนแปลงเดือน
  const handleMonthChange = (month: string) => {
    setSelectedMonth(month)
    if (userId && idToken) {
      void fetchMonthlyReport(month, userId, idToken)
    }
  }

  // Prepare data for the Macronutrients BarChart with null checks
  const barChartData = useMemo(() => {
    if (!monthlyData) return []

    const data: BarChartDataItem[] = []
    const proteinData = monthlyData.avgMacronutrients?.protein
    const carbsData = monthlyData.avgMacronutrients?.carbs
    const fatData = monthlyData.avgMacronutrients?.fat

    data.push({
      name: currentLang === 'th' ? 'โปรตีน' : 'Protein',
      consumed: proteinData?.consumed || 0,
      goal: proteinData?.goal || effectiveGoals.protein,
      remaining:
        (proteinData?.goal || effectiveGoals.protein) -
        (proteinData?.consumed || 0),
      percentOfGoal: Math.round(
        ((proteinData?.consumed || 0) /
          (proteinData?.goal || effectiveGoals.protein || 1)) *
          100,
      ),
      fill: '#3498db',
    })

    data.push({
      name: currentLang === 'th' ? 'คาร์โบไฮเดรต' : 'Carbs',
      consumed: carbsData?.consumed || 0,
      goal: carbsData?.goal || effectiveGoals.carbs,
      remaining:
        (carbsData?.goal || effectiveGoals.carbs) - (carbsData?.consumed || 0),
      percentOfGoal: Math.round(
        ((carbsData?.consumed || 0) /
          (carbsData?.goal || effectiveGoals.carbs || 1)) *
          100,
      ),
      fill: '#2ecc71',
    })

    data.push({
      name: currentLang === 'th' ? 'ไขมัน' : 'Fat',
      consumed: fatData?.consumed || 0,
      goal: fatData?.goal || effectiveGoals.fat,
      remaining:
        (fatData?.goal || effectiveGoals.fat) - (fatData?.consumed || 0),
      percentOfGoal: Math.round(
        ((fatData?.consumed || 0) /
          (fatData?.goal || effectiveGoals.fat || 1)) *
          100,
      ),
      fill: '#f1c40f',
    })

    return data
  }, [monthlyData, currentLang, effectiveGoals])

  if (renderError || liffError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {renderError || liffError}
      </Alert>
    )
  }

  if (!liffReady || isMonthlyLoading) {
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
              ? 'กำลังโหลดข้อมูลรายเดือน...'
              : 'Loading monthly data...'}
        </Typography>
      </Box>
    )
  }

  if (monthlyError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {currentLang === 'th'
          ? 'เกิดข้อผิดพลาดในการโหลดข้อมูลรายเดือน:'
          : 'Error loading monthly data:'}{' '}
        {monthlyError}
      </Alert>
    )
  }

  if (!monthlyData || !selectedMonth) {
    return (
      <Box sx={{ p: 2 }}>
        <MonthSelector
          selectedMonth={selectedMonth || format(new Date(), 'yyyy-MM')}
          onMonthChange={handleMonthChange}
          currentLang={currentLang}
        />
        <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="subtitle1">
            {currentLang === 'th'
              ? 'ไม่พบข้อมูลสำหรับเดือนนี้'
              : 'No data found for this month'}
          </Typography>
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <MonthSelector
        selectedMonth={selectedMonth}
        onMonthChange={handleMonthChange}
        currentLang={currentLang}
      />

      {/* Section 0: Monthly Summary Card (ย้ายสรุปมาไว้ด้านบนสุด) */}
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
            {currentLang === 'th' ? 'สรุปประจำเดือน' : 'Monthly Summary'}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              mb: { xs: 1.5, sm: 2 },
              fontSize: { xs: '0.875rem', sm: '1rem' },
              lineHeight: { xs: 1.4, sm: 1.6 },
            }}
          >
            {(() => {
              // สร้างสรุปแบบไดนามิกโดยใช้ effectiveGoals แทน backend summary
              const avgCalories = monthlyData.avgCaloriesPerDay || 0
              const totalCalories = monthlyData.totalCaloriesMonth || 0
              const proteinConsumed =
                monthlyData.avgMacronutrients?.protein?.consumed || 0

              // Determine locale for date-fns based on currentLang once

              const selectedLocale = currentLang === 'th' ? th : enUS

              if (avgCalories > 0) {
                return currentLang === 'th'
                  ? `ในเดือน ${format(parseISO(`${selectedMonth}-01`), 'LLLL yyyy', { locale: selectedLocale })} คุณบริโภคแคลอรี่เฉลี่ย ${avgCalories} kcal ต่อวัน (เป้าหมาย: ${effectiveGoals.calories} kcal/วัน) รวมทั้งเดือน ${totalCalories} kcal${effectiveGoals.protein > 0 ? ` และได้รับโปรตีนเฉลี่ย ${proteinConsumed}g จากเป้าหมาย ${effectiveGoals.protein}g` : ''}`
                  : `In ${format(parseISO(`${selectedMonth}-01`), 'LLLL yyyy', { locale: selectedLocale })} you consumed an average of ${avgCalories} kcal per day (goal: ${effectiveGoals.calories} kcal/day), totaling ${totalCalories} kcal${effectiveGoals.protein > 0 ? ` with ${proteinConsumed}g protein (goal: ${effectiveGoals.protein}g)` : ''}`
              }

              return currentLang === 'th'
                ? 'เดือนนี้ยังไม่มีข้อมูลการบริโภคอาหาร'
                : 'No food consumption data for this month yet'
            })()}
          </Typography>
          {monthlyData.insights && monthlyData.insights.length > 0 ? (
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
                {monthlyData.insights.map((insight: string, index: number) => (
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
                  const avgCalories = monthlyData.avgCaloriesPerDay || 0
                  const avgProtein =
                    monthlyData.avgMacronutrients?.protein?.consumed || 0
                  const avgCarbs =
                    monthlyData.avgMacronutrients?.carbs?.consumed || 0
                  const avgFat =
                    monthlyData.avgMacronutrients?.fat?.consumed || 0

                  // คำนวณ progress โดยใช้ effectiveGoals
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

                  // Calorie analysis (monthly context)
                  if (
                    avgCalories > 0 &&
                    effectiveGoals.calories > 0 &&
                    avgCalories < effectiveGoals.calories * 0.7
                  ) {
                    insights.push(
                      currentLang === 'th'
                        ? `แคลอรี่เฉลี่ยต่อวัน (${avgCalories.toFixed(0)} kcal) ต่ำกว่าเป้าหมาย (${effectiveGoals.calories} kcal) ในเดือนนี้ ลองเพิ่มปริมาณอาหารที่มีประโยชน์`
                        : `Average daily calories (${avgCalories.toFixed(0)} kcal) were below your goal (${effectiveGoals.calories} kcal) this month. Consider increasing healthy food portions.`,
                    )
                  } else if (
                    avgCalories > 0 &&
                    effectiveGoals.calories > 0 &&
                    avgCalories > effectiveGoals.calories * 1.3
                  ) {
                    insights.push(
                      currentLang === 'th'
                        ? `แคลอรี่เฉลี่ยต่อวัน (${avgCalories.toFixed(0)} kcal) สูงกว่าเป้าหมาย (${effectiveGoals.calories} kcal) ในเดือนนี้ ลองปรับขนาดอาหารและลดขนมหวาน`
                        : `Average daily calories (${avgCalories.toFixed(0)} kcal) exceeded your goal (${effectiveGoals.calories} kcal) this month. Consider adjusting portion sizes and reducing sweets.`,
                    )
                  }

                  // Protein analysis
                  if (avgProtein > 0 && proteinProgress < 70) {
                    insights.push(
                      currentLang === 'th'
                        ? `โปรตีนเฉลี่ย (${avgProtein.toFixed(1)}g) ยังต่ำกว่าเป้าหมาย (${effectiveGoals.protein}g) ในเดือนนี้ ลองเพิ่มแหล่งโปรตีนคุณภาพดี`
                        : `Average protein (${avgProtein.toFixed(1)}g) was below your goal (${effectiveGoals.protein}g) this month. Try adding more quality protein sources.`,
                    )
                  } else if (proteinProgress > 130) {
                    insights.push(
                      currentLang === 'th'
                        ? `โปรตีนเฉลี่ย (${avgProtein.toFixed(1)}g) ค่อนข้างสูงเมื่อเทียบกับเป้าหมาย (${effectiveGoals.protein}g) ในเดือนนี้`
                        : `Average protein (${avgProtein.toFixed(1)}g) was quite high compared to your goal (${effectiveGoals.protein}g) this month.`,
                    )
                  }

                  // Carbohydrate analysis
                  if (avgCarbs > 0 && carbsProgress > 130) {
                    insights.push(
                      currentLang === 'th'
                        ? `คาร์โบไฮเดรตเฉลี่ย (${avgCarbs.toFixed(1)}g) สูงกว่าที่แนะนำ (${effectiveGoals.carbs}g) ในเดือนนี้ ลองเลือกคาร์โบไฮเดรตเชิงซ้อน`
                        : `Average carbohydrate (${avgCarbs.toFixed(1)}g) was higher than recommended (${effectiveGoals.carbs}g) this month. Try choosing complex carbs.`,
                    )
                  } else if (avgCarbs > 0 && carbsProgress < 70) {
                    insights.push(
                      currentLang === 'th'
                        ? `คาร์โบไฮเดรตเฉลี่ย (${avgCarbs.toFixed(1)}g) อาจจะต่ำไปหน่อย (${effectiveGoals.carbs}g) ในเดือนนี้`
                        : `Average carbohydrate (${avgCarbs.toFixed(1)}g) might have been a bit low (${effectiveGoals.carbs}g) this month.`,
                    )
                  }

                  // Fat analysis
                  if (avgFat > 0 && fatProgress < 70) {
                    insights.push(
                      currentLang === 'th'
                        ? `ไขมันดีเฉลี่ย (${avgFat.toFixed(1)}g) ยังต้องการเพิ่มเพื่อสุขภาพที่ดี (${effectiveGoals.fat}g) ในเดือนนี้`
                        : `Average healthy fat (${avgFat.toFixed(1)}g) could be increased for better health (${effectiveGoals.fat}g) this month.`,
                    )
                  } else if (fatProgress > 130) {
                    insights.push(
                      currentLang === 'th'
                        ? `ไขมันเฉลี่ย (${avgFat.toFixed(1)}g) ค่อนข้างสูง (${effectiveGoals.fat}g) ในเดือนนี้`
                        : `Average fat intake (${avgFat.toFixed(1)}g) was quite high (${effectiveGoals.fat}g) this month.`,
                    )
                  }

                  // Positive reinforcement or general tip
                  if (
                    avgCalories > 0 &&
                    proteinProgress >= 80 &&
                    proteinProgress <= 120 &&
                    carbsProgress >= 80 &&
                    carbsProgress <= 120 &&
                    fatProgress >= 80 &&
                    fatProgress <= 120
                  ) {
                    insights.push(
                      currentLang === 'th'
                        ? '🌟 ยอดเยี่ยม! เดือนนี้คุณรักษาสมดุลของสารอาหารหลักได้ดีมาก'
                        : '🌟 Excellent! You maintained a great balance of macronutrients this month.',
                    )
                  }

                  if (insights.length === 0 && avgCalories > 0) {
                    insights.push(
                      currentLang === 'th'
                        ? 'คุณทำได้ดีในการบันทึกข้อมูลเดือนนี้ พยายามต่อไปเพื่อสุขภาพที่ดี!'
                        : 'Good job logging your data this month. Keep it up for better health!',
                    )
                  } else if (insights.length === 0 && avgCalories === 0) {
                    insights.push(
                      currentLang === 'th'
                        ? 'ยังไม่มีข้อมูลแคลอรี่สำหรับเดือนนี้ เริ่มบันทึกเพื่อดูคำแนะนำ'
                        : 'No calorie data for this month yet. Start logging to see insights.',
                    )
                  }

                  if (insights.length === 0) {
                    return (
                      <li>
                        <Typography
                          variant="body2"
                          sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                        >
                          {currentLang === 'th'
                            ? 'ไม่มีข้อสังเกตสำหรับเดือนนี้ เริ่มบันทึกอาหารเพื่อรับคำแนะนำ'
                            : 'No specific insights for this month. Start logging your meals to get personalized advice.'}
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
          )}
        </Paper>
      </Fade>

      {/* Section 1: Monthly Stats Card */}
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
            {currentLang === 'th' ? 'สถิติประจำเดือน' : 'Monthly Statistics'}
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
                {monthlyData.avgCaloriesPerDay &&
                monthlyData.avgCaloriesPerDay > 0
                  ? `${monthlyData.avgCaloriesPerDay} kcal`
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
                  ? 'แคลอรี่รวมทั้งเดือน:'
                  : 'Total Monthly Calories:'}
              </Typography>
              <Typography
                variant="h5"
                sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' } }}
              >
                {monthlyData.totalCaloriesMonth &&
                monthlyData.totalCaloriesMonth > 0
                  ? `${monthlyData.totalCaloriesMonth} kcal`
                  : currentLang === 'th'
                    ? 'ไม่มีข้อมูล'
                    : 'N/A'}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Fade>

      {/* Section 2: Daily Calorie Trend Line Chart */}
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
            {currentLang === 'th'
              ? 'แนวโน้มแคลอรี่รายวัน'
              : 'Daily Calorie Trend'}
          </Typography>
          <Box sx={{ height: { xs: 250, sm: 300 } }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyData.calorieTrend || []}
                margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
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
                {monthlyData.avgCaloriesGoal && (
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

      {/* Section 3: Avg. Daily Macronutrients (Numeric & BarChart) */}
      {monthlyData.avgMacronutrients && (
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
                  {monthlyData.avgMacronutrients.protein?.consumed?.toFixed(
                    1,
                  ) || 0}
                  g
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  {currentLang === 'th' ? 'จาก' : 'of'}{' '}
                  {monthlyData.avgMacronutrients.protein?.goal ||
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
                    (monthlyData.avgMacronutrients.protein?.consumed || 0) /
                      (monthlyData.avgMacronutrients.protein?.goal ||
                        effectiveGoals.protein) >=
                    0.8
                      ? 'success.main'
                      : 'warning.main'
                  }
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  {(
                    ((monthlyData.avgMacronutrients.protein?.consumed || 0) /
                      (monthlyData.avgMacronutrients.protein?.goal ||
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
                  {monthlyData.avgMacronutrients.carbs?.consumed?.toFixed(1) ||
                    0}
                  g
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  {currentLang === 'th' ? 'จาก' : 'of'}{' '}
                  {monthlyData.avgMacronutrients.carbs?.goal ||
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
                    (monthlyData.avgMacronutrients.carbs?.consumed || 0) /
                      (monthlyData.avgMacronutrients.carbs?.goal ||
                        effectiveGoals.carbs) >=
                    0.8
                      ? 'success.main'
                      : 'warning.main'
                  }
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  {(
                    ((monthlyData.avgMacronutrients.carbs?.consumed || 0) /
                      (monthlyData.avgMacronutrients.carbs?.goal ||
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
                  {monthlyData.avgMacronutrients.fat?.consumed?.toFixed(1) || 0}
                  g
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  {currentLang === 'th' ? 'จาก' : 'of'}{' '}
                  {monthlyData.avgMacronutrients.fat?.goal ||
                    effectiveGoals.fat}
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
                    (monthlyData.avgMacronutrients.fat?.consumed || 0) /
                      (monthlyData.avgMacronutrients.fat?.goal ||
                        effectiveGoals.fat) >=
                    0.8
                      ? 'success.main'
                      : 'warning.main'
                  }
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  {(
                    ((monthlyData.avgMacronutrients.fat?.consumed || 0) /
                      (monthlyData.avgMacronutrients.fat?.goal ||
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

export default MonthlyReportView
