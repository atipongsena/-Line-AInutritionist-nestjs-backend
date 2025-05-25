import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Fade,
} from '@mui/material'
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
import { useNutritionStore } from '../stores/nutritionStore'
import { useLiffAuth } from '../hooks/useLiffAuth'
import {
  calculateNutritionGoals,
  validateUserProfileForCalculation,
  type UserProfile,
  type NutritionGoals,
} from '../utils/nutritionCalculator'

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
        mb: 2,
        p: 1,
        backgroundColor: 'grey.100',
        borderRadius: 1,
      }}
    >
      <Button onClick={handlePrevMonth} variant="outlined" size="small">
        {currentLang === 'th' ? 'เดือนก่อน' : 'Prev Month'}
      </Button>
      <Box textAlign="center">
        <Typography
          variant="h6"
          sx={{ fontSize: { xs: '0.9rem', sm: '1.1rem' } }}
        >
          {displayMonth}
        </Typography>
        {selectedMonth !== format(new Date(), 'yyyy-MM') && (
          <Button
            onClick={handleThisMonth}
            size="small"
            sx={{ textTransform: 'none', fontWeight: 'normal' }}
          >
            {currentLang === 'th' ? 'เดือนนี้' : 'This Month'}
          </Button>
        )}
      </Box>
      <Button onClick={handleNextMonth} variant="outlined" size="small">
        {currentLang === 'th' ? 'เดือนหน้า' : 'Next Month'}
      </Button>
    </Box>
  )
}

const MonthlyReportView: React.FC = () => {
  const currentLang = 'th' // Hardcoding for now

  // ใช้ store จากการเชื่อมต่อกับ backend
  const {
    selectedMonth,
    monthlyData,
    isMonthlyLoading,
    monthlyError,
    setSelectedMonth,
    fetchMonthlyReport,
  } = useNutritionStore()

  // ใช้ useLiffAuth hook แทนการจัดการ LIFF เอง
  const {
    userId,
    idToken,
    isReady: liffReady,
    error: liffError,
  } = useLiffAuth()

  const [renderError, setRenderError] = useState<string | null>(null)

  // 📊 Smart Hybrid Data Provider - คำนวณเป้าหมายจากข้อมูลผู้ใช้จริง เหมือนกับ DailyReportView
  const getEffectiveGoals = useCallback(() => {
    // Priority 1: Backend data (most accurate) - ใช้ข้อมูลจาก monthlyData ถ้ามี
    console.log(
      '[MonthlyReport] Checking monthlyData for goals...',
      monthlyData,
    )

    if (monthlyData && monthlyData.avgMacronutrients) {
      const backendGoals = {
        calories: monthlyData.avgCaloriesGoal || 2000, // ใช้ calories goal จาก Backend
        protein: monthlyData.avgMacronutrients.protein?.goal || 75,
        carbs: monthlyData.avgMacronutrients.carbs?.goal || 250,
        fat: monthlyData.avgMacronutrients.fat?.goal || 65,
        fiber: 25,
        sugar: 50,
        sodium: 2300,
        water: 2000,
        cholesterol: 300,
        saturated_fat: 20,
        omega3: 1.3,
      }

      // ถ้ามีค่าเป้าหมายจาก Backend
      if (
        monthlyData.avgCaloriesGoal ||
        monthlyData.avgMacronutrients.protein?.goal ||
        monthlyData.avgMacronutrients.carbs?.goal ||
        monthlyData.avgMacronutrients.fat?.goal
      ) {
        console.log('[MonthlyReport] Using goals from Backend:', backendGoals)
        return backendGoals
      }
    }

    // Priority 2: Frontend calculated from user profile
    let calculatedGoals: NutritionGoals | null = null

    // เพิ่ม logging เพื่อ debug
    console.log(
      '[MonthlyReport] No Backend goals found, attempting to calculate nutrition goals...',
    )

    try {
      // ลองดึงข้อมูลจาก localStorage หลายรูปแบบ
      let storedProfile = null

      // ลองดึงจาก key ที่มี userId (เหมือน DailyReportView)
      if (userId) {
        storedProfile = localStorage.getItem(`userProfile_${userId}`)
        console.log(
          `[MonthlyReport] Trying userProfile_${userId}:`,
          !!storedProfile,
        )
      }

      // ถ้าไม่มี ลองดึงจาก key ธรรมดา
      if (!storedProfile) {
        storedProfile = localStorage.getItem('userProfile')
        console.log('[MonthlyReport] Trying userProfile:', !!storedProfile)
      }

      if (storedProfile) {
        let profile: StoredUserProfile | undefined
        try {
          profile = JSON.parse(storedProfile) as StoredUserProfile
          console.log('[MonthlyReport] Parsed profile:', profile)
        } catch (parseError) {
          console.error(
            '[MonthlyReport] Error parsing stored profile:',
            parseError,
          )
          profile = undefined
        }

        if (profile) {
          // แปลงข้อมูลให้เข้ากับ interface ของ calculator
          const userProfile: UserProfile = {
            gender: profile.gender || 'male',
            age: profile.age || 25,
            weightKg: profile.weightKg || 70,
            heightCm: profile.heightCm || 170,
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
          sx={{ p: 2, mb: 2, borderLeft: '4px solid #4caf50' }}
        >
          <Typography variant="h6" gutterBottom>
            {currentLang === 'th' ? 'สรุปประจำเดือน' : 'Monthly Summary'}
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {(() => {
              // สร้างสรุปแบบไดนามิกโดยใช้ effectiveGoals แทน backend summary
              const avgCalories = monthlyData.avgCaloriesPerDay || 0
              const totalCalories = monthlyData.totalCaloriesMonth || 0
              const proteinConsumed =
                monthlyData.avgMacronutrients?.protein?.consumed || 0

              if (avgCalories > 0) {
                return currentLang === 'th'
                  ? `ในเดือน ${format(parseISO(`${selectedMonth}-01`), 'LLLL yyyy', { locale: currentLang === 'th' ? th : enUS })} คุณบริโภคแคลอรี่เฉลี่ย ${avgCalories} kcal ต่อวัน (เป้าหมาย: ${effectiveGoals.calories} kcal/วัน) รวมทั้งเดือน ${totalCalories} kcal${effectiveGoals.protein > 0 ? ` และได้รับโปรตีนเฉลี่ย ${proteinConsumed}g จากเป้าหมาย ${effectiveGoals.protein}g` : ''}`
                  : `In ${format(parseISO(`${selectedMonth}-01`), 'LLLL yyyy', { locale: currentLang === 'th' ? th : enUS })} you consumed an average of ${avgCalories} kcal per day (goal: ${effectiveGoals.calories} kcal/day), totaling ${totalCalories} kcal${effectiveGoals.protein > 0 ? ` with ${proteinConsumed}g protein (goal: ${effectiveGoals.protein}g)` : ''}`
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
                sx={{ fontWeight: 'bold', mb: 1 }}
              >
                {currentLang === 'th' ? '💡 ข้อสังเกต:' : '💡 Insights:'}
              </Typography>
              <ul>
                {monthlyData.insights.map((insight: string, index: number) => (
                  <li key={index}>
                    <Typography variant="body2">{insight}</Typography>
                  </li>
                ))}
              </ul>
            </Box>
          ) : (
            <Box>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 'bold', mb: 1 }}
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

                  // วิเคราะห์แคลอรี่
                  if (avgCalories < 1500) {
                    insights.push(
                      currentLang === 'th'
                        ? 'ภาวะการบริโภคอาหารของคุณในเดือนนี้อาจจะต่ำเกินไป ควรปรึกษาผู้เชี่ยวชาญด้านโภชนาการ'
                        : 'Your caloric intake this month may be too low. Consider consulting a nutrition expert',
                    )
                  } else if (avgCalories > 3500) {
                    insights.push(
                      currentLang === 'th'
                        ? 'แคลอรี่เฉลี่ยสูงกว่าความต้องการของคนทั่วไป ควรปรับลดปริมาณอาหารและเพิ่มการออกกำลังกาย'
                        : 'Average calories are higher than typical needs. Consider reducing food portions and increasing exercise',
                    )
                  }

                  // วิเคราะห์โปรตีน
                  if (proteinProgress < 60) {
                    insights.push(
                      currentLang === 'th'
                        ? `โปรตีนขาดอย่างมากตลอดเดือน (เฉลี่ย ${avgProtein.toFixed(1)}g จากเป้าหมาย ${effectiveGoals.protein}g) ควรเพิ่มไข่ เนื้อ ปลา และถั่วต่างๆ`
                        : `Significant protein deficiency this month (avg ${avgProtein.toFixed(1)}g vs goal ${effectiveGoals.protein}g). Add more eggs, meat, fish, and legumes`,
                    )
                  } else if (proteinProgress > 150) {
                    insights.push(
                      currentLang === 'th'
                        ? 'โปรตีนเกินความต้องการ ลองเพิ่มผักและผลไม้ให้มากขึ้นเพื่อความสมดุล'
                        : 'Protein intake exceeds needs. Try adding more vegetables and fruits for balance',
                    )
                  }

                  // วิเคราะห์คาร์โบไฮเดรต
                  if (carbsProgress > 140) {
                    insights.push(
                      currentLang === 'th'
                        ? 'คาร์โบไฮเดรตสูงเกินไปตลอดเดือน ลองเปลี่ยนจากข้าวขาวเป็นข้าวกล้องและลดขนมหวาน'
                        : 'Carbohydrate intake has been too high this month. Try switching from white rice to brown rice and reducing sweets',
                    )
                  }

                  // วิเคราะห์ไขมัน
                  if (fatProgress < 50) {
                    insights.push(
                      currentLang === 'th'
                        ? 'ไขมันต่ำเกินไป ควรเพิ่มไขมันดีจากถั่วอัลมอนด์ อะโวคาโด และน้ำมันมะกอก'
                        : 'Fat intake is too low. Add healthy fats from almonds, avocado, and olive oil',
                    )
                  } else if (fatProgress > 150) {
                    insights.push(
                      currentLang === 'th'
                        ? 'ไขมันสูงเกินไป ควรลดอาหารทอดและเลือกวิธีการปรุงแบบต้ม นึ่ง ย่าง แทน'
                        : 'Fat intake is too high. Reduce fried foods and choose boiling, steaming, or grilling instead',
                    )
                  }

                  // คำแนะนำเชิงบวก
                  if (
                    proteinProgress >= 80 &&
                    proteinProgress <= 120 &&
                    carbsProgress >= 80 &&
                    carbsProgress <= 120 &&
                    fatProgress >= 80 &&
                    fatProgress <= 120
                  ) {
                    insights.push(
                      currentLang === 'th'
                        ? '🌟 ยอดเยี่ยม! คุณรักษาสมดุลของสารอาหารได้ดีมากตลอดเดือน'
                        : '🌟 Excellent! You maintained great nutritional balance throughout the month',
                    )
                  }

                  // ถ้าไม่มีข้อสังเกตเฉพาะ
                  if (insights.length === 0) {
                    insights.push(
                      currentLang === 'th'
                        ? '📊 การบันทึกอาหารของคุณในเดือนนี้แสดงให้เห็นถึงความมุ่งมั่นในการดูแลสุขภาพ'
                        : '📊 Your food logging this month shows dedication to health management',
                    )
                  }

                  return insights.map((insight, index) => (
                    <li key={index}>
                      <Typography variant="body2">{insight}</Typography>
                    </li>
                  ))
                })()}
              </ul>
            </Box>
          )}
        </Paper>
      </Fade>

      {/* Section 1: Calorie Trend Line Chart */}
      <Fade in={true} timeout={900}>
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {currentLang === 'th'
              ? 'แนวโน้มแคลอรี่ (รายวันเฉลี่ย)'
              : 'Calorie Trend (Daily Avg)'}
          </Typography>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyData.calorieTrend}
                margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  label={{
                    value:
                      currentLang === 'th' ? 'วันที่ในเดือน' : 'Day of Month',
                    position: 'insideBottom',
                    offset: -5,
                  }}
                />
                <YAxis
                  label={{
                    value: currentLang === 'th' ? 'แคลอรี่' : 'Calories',
                    angle: -90,
                    position: 'insideLeft',
                  }}
                />
                <Tooltip />
                <Legend verticalAlign="top" />
                <Line
                  type="monotone"
                  dataKey="calories"
                  stroke="#8884d8"
                  name={currentLang === 'th' ? 'แคลอรี่' : 'Calories'}
                  dot={false}
                  animationDuration={1000}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Fade>

      {/* Section 2: Monthly Stats Card */}
      <Fade in={true} timeout={1000}>
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {currentLang === 'th' ? 'สถิติประจำเดือน' : 'Monthly Statistics'}
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle1">
                {currentLang === 'th'
                  ? 'แคลอรี่เฉลี่ยต่อวัน:'
                  : 'Avg. Daily Calories:'}
              </Typography>
              <Typography variant="h5" color="primary">
                {monthlyData.avgCaloriesPerDay} kcal
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle1">
                {currentLang === 'th'
                  ? 'แคลอรี่รวมทั้งเดือน:'
                  : 'Total Monthly Calories:'}
              </Typography>
              <Typography variant="h5">
                {monthlyData.totalCaloriesMonth} kcal
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Fade>

      {/* Section 3: สารอาหารหลักเฉลี่ยต่อวัน (เพิ่มเข้ามาใหม่) */}
      {monthlyData.avgMacronutrients && (
        <Fade in={true} timeout={1100}>
          <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              {currentLang === 'th'
                ? 'สารอาหารหลักเฉลี่ยต่อวัน'
                : 'Avg. Daily Macronutrients'}
            </Typography>

            {/* ส่วนแสดงผลแบบตัวเลข */}
            <Grid container spacing={2} sx={{ textAlign: 'center', mb: 2 }}>
              <Grid size={{ xs: 4, md: 4 }}>
                <Typography variant="subtitle1">
                  {monthlyData.avgMacronutrients.protein.consumed}g /{' '}
                  {effectiveGoals.protein}g
                </Typography>
                <Typography variant="caption">
                  {currentLang === 'th' ? 'โปรตีน' : 'Protein'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 4, md: 4 }}>
                <Typography variant="subtitle1">
                  {monthlyData.avgMacronutrients.carbs.consumed}g /{' '}
                  {effectiveGoals.carbs}g
                </Typography>
                <Typography variant="caption">
                  {currentLang === 'th' ? 'คาร์โบไฮเดรต' : 'Carbs'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 4, md: 4 }}>
                <Typography variant="subtitle1">
                  {monthlyData.avgMacronutrients.fat.consumed}g /{' '}
                  {effectiveGoals.fat}g
                </Typography>
                <Typography variant="caption">
                  {currentLang === 'th' ? 'ไขมัน' : 'Fat'}
                </Typography>
              </Grid>
            </Grid>

            {/* เพิ่มกราฟแท่งสำหรับสารอาหารหลัก */}
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: currentLang === 'th' ? 'โปรตีน' : 'Protein',
                      consumed: monthlyData.avgMacronutrients.protein.consumed,
                      goal: effectiveGoals.protein,
                      percentOfGoal: Math.round(
                        (monthlyData.avgMacronutrients.protein.consumed /
                          effectiveGoals.protein) *
                          100,
                      ),
                      fill: '#3498db',
                    },
                    {
                      name: currentLang === 'th' ? 'คาร์โบไฮเดรต' : 'Carbs',
                      consumed: monthlyData.avgMacronutrients.carbs.consumed,
                      goal: effectiveGoals.carbs,
                      percentOfGoal: Math.round(
                        (monthlyData.avgMacronutrients.carbs.consumed /
                          effectiveGoals.carbs) *
                          100,
                      ),
                      fill: '#2ecc71',
                    },
                    {
                      name: currentLang === 'th' ? 'ไขมัน' : 'Fat',
                      consumed: monthlyData.avgMacronutrients.fat.consumed,
                      goal: effectiveGoals.fat,
                      percentOfGoal: Math.round(
                        (monthlyData.avgMacronutrients.fat.consumed /
                          effectiveGoals.fat) *
                          100,
                      ),
                      fill: '#f1c40f',
                    },
                  ]}
                  margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke="#8884d8"
                    label={{
                      value: 'กรัม (g)',
                      angle: -90,
                      position: 'insideLeft',
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#82ca9d"
                    label={{
                      value: 'เปอร์เซ็นต์ (%)',
                      angle: 90,
                      position: 'insideRight',
                    }}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      const unit = name === 'percentOfGoal' ? '%' : 'g'
                      const label =
                        name === 'consumed'
                          ? currentLang === 'th'
                            ? 'ที่บริโภค'
                            : 'Consumed'
                          : name === 'goal'
                            ? currentLang === 'th'
                              ? 'เป้าหมาย'
                              : 'Goal'
                            : currentLang === 'th'
                              ? 'เปอร์เซ็นต์ของเป้าหมาย'
                              : '% of Goal'
                      return [`${value}${unit}`, label]
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="consumed"
                    name={currentLang === 'th' ? 'ที่บริโภค' : 'Consumed'}
                    fill="#8884d8"
                    animationDuration={1200}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="goal"
                    name={currentLang === 'th' ? 'เป้าหมาย' : 'Goal'}
                    fill="#82ca9d"
                    animationDuration={1200}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="percentOfGoal"
                    name={
                      currentLang === 'th'
                        ? 'เปอร์เซ็นต์ของเป้าหมาย'
                        : '% of Goal'
                    }
                    stroke="#ff7300"
                    animationDuration={1500}
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
