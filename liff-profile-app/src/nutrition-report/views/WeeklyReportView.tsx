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
  // LinearProgress, // Remove unused import
} from '@mui/material'
import {
  format,
  parseISO,
  addDays,
  subDays,
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
} from 'recharts'
import {
  // WeeklyNutritionData, // Removed unused import
  useNutritionStore,
} from '../stores/nutritionStore'
import { useLiffAuth } from '../hooks/useLiffAuth'
import { LinearProgressWithLabel } from '../components/LinearProgressWithLabel'
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
    onWeekChange(format(subDays(startDate, 7), 'yyyy-MM-dd'))
  }

  const handleNextWeek = () => {
    onWeekChange(format(addDays(startDate, 7), 'yyyy-MM-dd'))
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
        mb: 2,
        p: 1,
        backgroundColor: 'grey.100',
        borderRadius: 1,
      }}
    >
      <Button onClick={handlePrevWeek} variant="outlined" size="small">
        {currentLang === 'th' ? 'สัปดาห์ก่อน' : 'Prev Week'}
      </Button>
      <Box textAlign="center">
        <Typography
          variant="h6"
          sx={{ fontSize: { xs: '0.9rem', sm: '1.1rem' } }}
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
            sx={{ textTransform: 'none', fontWeight: 'normal' }}
          >
            {currentLang === 'th' ? 'สัปดาห์นี้' : 'This Week'}
          </Button>
        )}
      </Box>
      <Button onClick={handleNextWeek} variant="outlined" size="small">
        {currentLang === 'th' ? 'สัปดาห์หน้า' : 'Next Week'}
      </Button>
    </Box>
  )
}

const WeeklyReportView: React.FC = () => {
  const currentLang = 'th' // Hardcoding for now

  // ใช้ store จากการเชื่อมต่อกับ backend
  const {
    selectedWeek,
    weeklyData,
    isWeeklyLoading,
    weeklyError,
    setSelectedWeek,
    fetchWeeklyReport,
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
    // Priority 1: Backend data (most accurate) - ใช้ข้อมูลจาก weeklyData ถ้ามี
    console.log('[WeeklyReport] Checking weeklyData for goals...', weeklyData)

    if (weeklyData && weeklyData.avgMacronutrients) {
      const backendGoals = {
        calories: weeklyData.avgCaloriesGoal || 2000, // ใช้ calories goal จาก Backend
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

      // ถ้ามีค่าเป้าหมายจาก Backend
      if (
        weeklyData.avgCaloriesGoal ||
        weeklyData.avgMacronutrients.protein?.goal ||
        weeklyData.avgMacronutrients.carbs?.goal ||
        weeklyData.avgMacronutrients.fat?.goal
      ) {
        console.log('[WeeklyReport] Using goals from Backend:', backendGoals)
        return backendGoals
      }
    }

    // Priority 2: Frontend calculated from user profile
    let calculatedGoals: NutritionGoals | null = null

    // เพิ่ม logging เพื่อ debug
    console.log(
      '[WeeklyReport] No Backend goals found, attempting to calculate nutrition goals...',
    )

    try {
      // ลองดึงข้อมูลจาก localStorage หลายรูปแบบ
      let storedProfile = null

      // ลองดึงจาก key ที่มี userId (เหมือน DailyReportView)
      if (userId) {
        storedProfile = localStorage.getItem(`userProfile_${userId}`)
        console.log(
          `[WeeklyReport] Trying userProfile_${userId}:`,
          !!storedProfile,
        )
      }

      // ถ้าไม่มี ลองดึงจาก key ธรรมดา
      if (!storedProfile) {
        storedProfile = localStorage.getItem('userProfile')
        console.log('[WeeklyReport] Trying userProfile:', !!storedProfile)
      }

      if (storedProfile) {
        let profile: StoredUserProfile | undefined
        try {
          profile = JSON.parse(storedProfile) as StoredUserProfile
          console.log('[WeeklyReport] Parsed profile:', profile)
        } catch (parseError) {
          console.error(
            '[WeeklyReport] Error parsing stored profile:',
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
            '[WeeklyReport] User profile for calculation:',
            userProfile,
          )

          // ตรวจสอบข้อมูลและคำนวณ
          if (validateUserProfileForCalculation(userProfile)) {
            calculatedGoals = calculateNutritionGoals(userProfile)
            console.log('[WeeklyReport] Calculated goals:', calculatedGoals)
          } else {
            console.warn('[WeeklyReport] User profile validation failed')
          }
        }
      } else {
        console.warn('[WeeklyReport] No user profile found in localStorage')
      }
    } catch (error) {
      console.error('[WeeklyReport] Error calculating nutrition goals:', error)
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
      '[WeeklyReport] Using goals (calculated or default):',
      finalGoals,
    )
    return finalGoals
  }, [weeklyData, userId])

  // Memoized effective goals
  const effectiveGoals = useMemo(() => {
    const goals = getEffectiveGoals()
    console.log('[WeeklyReport] Final effective goals:', goals)
    return goals
  }, [getEffectiveGoals])

  // เพิ่ม effect เพื่อเตรียมข้อมูลเริ่มต้นสำหรับรายงานรายสัปดาห์
  useEffect(() => {
    if (liffReady && userId && idToken && selectedWeek?.start) {
      void fetchWeeklyReport(selectedWeek.start, userId, idToken)
    }
  }, [liffReady, userId, idToken, selectedWeek?.start, fetchWeeklyReport])

  // เพิ่ม effect สำหรับตั้งค่าสัปดาห์เริ่มต้น (แยกออกมาจาก useEffect ด้านบน)
  useEffect(() => {
    if (
      liffReady &&
      userId &&
      idToken &&
      (!selectedWeek || !selectedWeek.start)
    ) {
      const today = new Date()
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay()) // วันอาทิตย์
      const weekStart = format(startOfWeek, 'yyyy-MM-dd')
      setSelectedWeek(weekStart)
    }
  }, [liffReady, userId, idToken, selectedWeek, setSelectedWeek])

  // เพิ่ม effect สำหรับตรวจสอบวันที่ทุกครั้งที่ component ถูกโหลด
  useEffect(() => {
    try {
      if (selectedWeek?.start) {
        // ตรวจสอบว่าวันที่ถูกต้องหรือไม่
        const selectedDate = new Date(selectedWeek.start)
        if (isNaN(selectedDate.getTime())) {
          console.error('Invalid week start date:', selectedWeek.start)
          setRenderError('วันที่เริ่มต้นสัปดาห์ไม่ถูกต้อง')

          // รีเซ็ตสัปดาห์เป็นสัปดาห์ปัจจุบัน
          const today = new Date()
          const startOfWeek = new Date(today)
          startOfWeek.setDate(today.getDate() - today.getDay())
          setSelectedWeek(format(startOfWeek, 'yyyy-MM-dd'))
          return
        }

        // ตรวจสอบว่าสัปดาห์ไม่ได้อยู่ในอนาคต
        const today = new Date()
        if (selectedDate > today) {
          console.error('Week is in the future:', selectedWeek.start)

          // รีเซ็ตสัปดาห์เป็นสัปดาห์ปัจจุบัน
          const startOfWeek = new Date(today)
          startOfWeek.setDate(today.getDate() - today.getDay())
          setSelectedWeek(format(startOfWeek, 'yyyy-MM-dd'))
          return
        }
      }
    } catch (err) {
      console.error('Error in WeeklyReportView useEffect:', err)
      setRenderError('เกิดข้อผิดพลาดขณะแสดงรายงานสัปดาห์')
    }
  }, [selectedWeek, setSelectedWeek])

  // Handler สำหรับการเปลี่ยนแปลงสัปดาห์
  const handleWeekChange = (weekStart: string) => {
    setSelectedWeek(weekStart)
    if (userId && idToken) {
      void fetchWeeklyReport(weekStart, userId, idToken)
    }
  }

  if (renderError || liffError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {renderError || liffError}
      </Alert>
    )
  }

  if (!liffReady || isWeeklyLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          p: 3,
          height: '50vh',
        }}
      >
        <CircularProgress size={40} thickness={4} />
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
        {currentLang === 'th'
          ? 'เกิดข้อผิดพลาดในการโหลดข้อมูลรายสัปดาห์:'
          : 'Error loading weekly data:'}{' '}
        {weeklyError}
      </Alert>
    )
  }

  if (!weeklyData || !selectedWeek?.start) {
    return (
      <Box sx={{ p: 2 }}>
        <WeekSelector
          selectedWeekStart={
            selectedWeek?.start || format(new Date(), 'yyyy-MM-dd')
          }
          onWeekChange={handleWeekChange}
          currentLang={currentLang}
        />
        <Fade in timeout={800}>
          <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="subtitle1">
              {currentLang === 'th'
                ? 'ไม่พบข้อมูลสำหรับสัปดาห์นี้'
                : 'No data found for this week'}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              {currentLang === 'th'
                ? 'ลองเลือกสัปดาห์อื่น หรือเพิ่มบันทึกอาหารสำหรับสัปดาห์นี้'
                : 'Try selecting another week, or add food logs for this week.'}
            </Typography>
          </Paper>
        </Fade>
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <WeekSelector
        selectedWeekStart={selectedWeek.start}
        onWeekChange={handleWeekChange}
        currentLang={currentLang}
      />

      {/* Section 0: Weekly Summary (ย้ายมาไว้ด้านบน) */}
      <Fade in={true} timeout={800}>
        <Paper
          elevation={2}
          sx={{ p: 2, mb: 2, borderLeft: '4px solid #4caf50' }}
        >
          <Typography variant="h6" gutterBottom>
            {currentLang === 'th' ? 'สรุปสัปดาห์นี้' : 'Weekly Summary'}
          </Typography>

          {/* เพิ่มข้อมูลแคลอรี่โดยรวม */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {currentLang === 'th'
                ? '📊 สถิติแคลอรี่สัปดาห์นี้:'
                : '📊 Weekly Calorie Statistics:'}
            </Typography>
            <Typography variant="body2">
              {currentLang === 'th'
                ? `เฉลี่ย: ${weeklyData.avgCalories || 0} kcal/วัน | เป้าหมาย: ${effectiveGoals.calories} kcal/วัน`
                : `Average: ${weeklyData.avgCalories || 0} kcal/day | Goal: ${effectiveGoals.calories} kcal/day`}
            </Typography>
          </Box>

          {/* เพิ่มข้อมูลโปรตีน คาร์บ ไขมัน */}
          {weeklyData.avgMacronutrients && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 'bold', mb: 1 }}
              >
                {currentLang === 'th'
                  ? '🥗 สารอาหารหลักเฉลี่ย:'
                  : '🥗 Average Macronutrients:'}
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                  <Typography variant="caption" color="textSecondary">
                    {currentLang === 'th' ? 'โปรตีน' : 'Protein'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {Math.round(
                      weeklyData.avgMacronutrients.protein?.consumed || 0,
                    )}
                    g
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    /{effectiveGoals.protein}g
                  </Typography>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Typography variant="caption" color="textSecondary">
                    {currentLang === 'th' ? 'คาร์บ' : 'Carbs'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {Math.round(
                      weeklyData.avgMacronutrients.carbs?.consumed || 0,
                    )}
                    g
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    /{effectiveGoals.carbs}g
                  </Typography>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Typography variant="caption" color="textSecondary">
                    {currentLang === 'th' ? 'ไขมัน' : 'Fat'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {Math.round(
                      weeklyData.avgMacronutrients.fat?.consumed || 0,
                    )}
                    g
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    /{effectiveGoals.fat}g
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          <Typography variant="body1" sx={{ mb: 1 }}>
            {(() => {
              // สร้างสรุปแบบไดนามิกโดยใช้ effectiveGoals แทน backend summary
              const avgCalories = weeklyData.avgCalories || 0
              const proteinConsumed =
                weeklyData.avgMacronutrients?.protein?.consumed || 0

              if (avgCalories > 0) {
                return currentLang === 'th'
                  ? `สัปดาห์นี้คุณบริโภคแคลอรี่เฉลี่ย ${avgCalories} kcal ต่อวัน (เป้าหมาย: ${effectiveGoals.calories} kcal/วัน)${effectiveGoals.protein > 0 ? ` และได้รับโปรตีนเฉลี่ย ${Math.round(proteinConsumed)}g จากเป้าหมาย ${effectiveGoals.protein}g` : ''}`
                  : `This week you consumed an average of ${avgCalories} kcal per day (goal: ${effectiveGoals.calories} kcal/day)${effectiveGoals.protein > 0 ? ` with ${Math.round(proteinConsumed)}g protein (goal: ${effectiveGoals.protein}g)` : ''}`
              }
              return currentLang === 'th'
                ? 'สัปดาห์นี้ยังไม่มีข้อมูลการบริโภคอาหาร'
                : 'No food consumption data for this week yet'
            })()}
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 'bold', mt: 2, mb: 0.5 }}
          >
            {currentLang === 'th' ? '💡 คำแนะนำประจำสัปดาห์' : '💡 Weekly Tip'}
          </Typography>
          <Typography variant="body2">
            {(() => {
              // สร้างคำแนะนำแบบไดนามิกโดยใช้ effectiveGoals แทน backend tip
              const avgProtein =
                weeklyData.avgMacronutrients?.protein?.consumed || 0
              const avgCarbs =
                weeklyData.avgMacronutrients?.carbs?.consumed || 0
              const avgCalories = weeklyData.avgCalories || 0

              // คำนวณ progress โดยใช้ effectiveGoals
              const proteinProgress =
                effectiveGoals.protein > 0
                  ? (avgProtein / effectiveGoals.protein) * 100
                  : 0
              const carbsProgress =
                effectiveGoals.carbs > 0
                  ? (avgCarbs / effectiveGoals.carbs) * 100
                  : 0

              // คำแนะนำตาม progress
              if (proteinProgress < 70) {
                return currentLang === 'th'
                  ? `โปรตีนเฉลี่ยยังขาดอีก ${Math.round(effectiveGoals.protein - avgProtein)}g ต่อวัน ลองเพิ่มไข่ เนื้อ ปลา หรือถั่วในอาหารประจำวันของคุณ`
                  : `Average protein is ${Math.round(effectiveGoals.protein - avgProtein)}g below target. Try adding more eggs, meat, fish, or beans to your daily meals`
              }

              if (carbsProgress > 130) {
                return currentLang === 'th'
                  ? `คาร์โบไฮเดรตเฉลี่ยเกินเป้าหมาย ${Math.round(avgCarbs - effectiveGoals.carbs)}g ต่อวัน ลองลดข้าวและขนมหวาน เพิ่มผักใบเขียว`
                  : `Average carbs are ${Math.round(avgCarbs - effectiveGoals.carbs)}g above target. Try reducing rice and sweets, add more leafy greens`
              }

              if (avgCalories < 1200) {
                return currentLang === 'th'
                  ? 'แคลอรี่เฉลี่ยต่ำเกินไป อาจทำให้ร่างกายขาดพลังงาน ควรเพิ่มอาหารที่มีคุณค่าทางโภชนาการ'
                  : 'Average calories are too low. This may cause fatigue. Consider adding more nutrient-dense foods'
              }

              if (avgCalories > 3000) {
                return currentLang === 'th'
                  ? 'แคลอรี่เฉลี่ยสูงไป ลองลดปริมาณอาหารและเพิ่มผัก ผลไม้ เพื่อรักษาน้ำหนัก'
                  : 'Average calories are quite high. Try reducing portions and adding more vegetables and fruits'
              }

              // คำแนะนำเชิงบวก
              if (
                proteinProgress >= 80 &&
                proteinProgress <= 120 &&
                carbsProgress >= 80 &&
                carbsProgress <= 120
              ) {
                return currentLang === 'th'
                  ? '🌟 ยอดเยี่ยม! คุณได้รับสารอาหารอย่างสมดุลตลอดสัปดาห์ รักษาความสม่ำเสมอแบบนี้ต่อไป'
                  : '🌟 Excellent! You have a well-balanced nutrient intake this week. Keep maintaining this consistency'
              }

              return currentLang === 'th'
                ? '✨ ดีมาก! การบันทึกอาหารสม่ำเสมอจะช่วยให้คุณมีสุขภาพที่ดีขึ้น'
                : '✨ Great job! Consistent food logging will help improve your health'
            })()}
          </Typography>
        </Paper>
      </Fade>

      {/* Section 1: Calorie Trend */}
      <Fade in={true} timeout={900}>
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {currentLang === 'th'
              ? 'แนวโน้มแคลอรี่รายวัน'
              : 'Daily Calorie Trend'}
          </Typography>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={weeklyData.dailyCalories}
                margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="calories"
                  stroke="#8884d8"
                  name={currentLang === 'th' ? 'แคลอรี่' : 'Calories'}
                  activeDot={{ r: 8 }}
                  animationDuration={1000}
                />
                {/* Optional: Goal Line */}
                {/* <Line type="monotone" dataKey="goal" stroke="#82ca9d" name="เป้าหมาย" strokeDasharray="5 5" /> */}
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{ mt: 1, textAlign: 'center' }}
          >
            {currentLang === 'th'
              ? 'แคลอรี่เฉลี่ยต่อวัน:'
              : 'Avg. Daily Calories:'}{' '}
            {weeklyData.avgCalories} kcal
          </Typography>
        </Paper>
      </Fade>

      {/* Section 2: Average Macronutrients */}
      <Fade in={true} timeout={1000}>
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {currentLang === 'th'
              ? 'สารอาหารหลักเฉลี่ยต่อวัน'
              : 'Avg. Daily Macronutrients'}
          </Typography>

          {/* ส่วนแสดงผลแบบตัวเลข */}
          <Grid container spacing={2} sx={{ textAlign: 'center', mb: 2 }}>
            <Grid size={{ xs: 4, md: 4 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'โปรตีน' : 'Protein'}
              </Typography>
              <LinearProgressWithLabel
                value={
                  ((weeklyData.avgMacronutrients.protein?.consumed || 0) /
                    effectiveGoals.protein) *
                  100
                }
                consumed={weeklyData.avgMacronutrients.protein?.consumed || 0}
                goal={effectiveGoals.protein}
                unit="g"
              />
            </Grid>
            <Grid size={{ xs: 4, md: 4 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'คาร์โบไฮเดรต' : 'Carbohydrates'}
              </Typography>
              <LinearProgressWithLabel
                value={
                  ((weeklyData.avgMacronutrients.carbs?.consumed || 0) /
                    effectiveGoals.carbs) *
                  100
                }
                consumed={weeklyData.avgMacronutrients.carbs?.consumed || 0}
                goal={effectiveGoals.carbs}
                unit="g"
              />
            </Grid>
            <Grid size={{ xs: 4, md: 4 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'ไขมัน' : 'Fat'}
              </Typography>
              <LinearProgressWithLabel
                value={
                  ((weeklyData.avgMacronutrients.fat?.consumed || 0) /
                    effectiveGoals.fat) *
                  100
                }
                consumed={weeklyData.avgMacronutrients.fat?.consumed || 0}
                goal={effectiveGoals.fat}
                unit="g"
              />
            </Grid>
          </Grid>

          {/* เพิ่มกราฟแท่งสำหรับสารอาหารหลัก */}
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {
                    name: currentLang === 'th' ? 'โปรตีน' : 'Protein',
                    consumed:
                      weeklyData.avgMacronutrients.protein?.consumed || 0,
                    goal: effectiveGoals.protein,
                    percentOfGoal: Math.round(
                      ((weeklyData.avgMacronutrients.protein?.consumed || 0) /
                        effectiveGoals.protein) *
                        100,
                    ),
                    fill: '#3498db',
                  },
                  {
                    name: currentLang === 'th' ? 'คาร์โบไฮเดรต' : 'Carbs',
                    consumed: weeklyData.avgMacronutrients.carbs?.consumed || 0,
                    goal: effectiveGoals.carbs,
                    percentOfGoal: Math.round(
                      ((weeklyData.avgMacronutrients.carbs?.consumed || 0) /
                        effectiveGoals.carbs) *
                        100,
                    ),
                    fill: '#2ecc71',
                  },
                  {
                    name: currentLang === 'th' ? 'ไขมัน' : 'Fat',
                    consumed: weeklyData.avgMacronutrients.fat?.consumed || 0,
                    goal: effectiveGoals.fat,
                    percentOfGoal: Math.round(
                      ((weeklyData.avgMacronutrients.fat?.consumed || 0) /
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
    </Box>
  )
}

export default WeeklyReportView
