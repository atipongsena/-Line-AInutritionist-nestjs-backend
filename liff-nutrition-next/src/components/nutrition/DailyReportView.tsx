'use client'

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
  Suspense,
  lazy,
} from 'react'
import Image from 'next/image'
import {
  Box,
  Typography,
  Alert,
  Paper,
  Button,
  LinearProgress,
  IconButton,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Modal,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Fade,
  Grow,
  CircularProgress,
  InputAdornment, // Added InputAdornment
  Tabs, // Added Tabs
  Tab, // Added Tab
} from '@mui/material'
import Grid from '@mui/material/Grid' // Reverted to Grid from @mui/material/Grid
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { useNutritionStore } from 'src/stores/nutritionStore'
import { format, parseISO, addDays, subDays } from 'date-fns'
import { th, enUS } from 'date-fns/locale' // For localization
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LocalizationProvider, StaticDatePicker } from '@mui/x-date-pickers'
import { useLiff } from '@/components/providers/LiffProvider' // Assuming this is the correct path and export
import { useUrlParameters } from '@/hooks/useUrlParameters' // Corrected path assuming hooks are directly under src/hooks
import type {
  FoodItem as SharedFoodItem,
  NutritionData,
  ServingInfo,
  FoodName,
  MicronutrientsMap,
  FoodLog,
  FoodLogEntry,
  MealData,
  DailyNutritionData,
  NutrientGoalData,
} from '@/types/food' // Assuming equivalent types are here or copied
import type {
  UpdateFoodLogPayload,
  LiffFoodLogData, // Added for currentLiffFoodLog type
} from 'src/stores/nutritionStore'
import { LinearProgressWithLabel } from 'src/components/LinearProgressWithLabel'

// Import optimized chart components
import {
  ChartWrapper,
  NutritionPieChart,
  NutritionBarChart,
  MealCaloriesChart,
  CHART_COLORS,
} from './charts'

// Import frontend calculation utilities for Smart Hybrid Architecture
import {
  calculateNutritionGoals,
  validateUserProfileForCalculation,
  type UserProfile,
  type NutritionGoals,
} from 'src/utils/nutritionCalculator'

// Placeholder for a Date Selector component (can be created as a separate component later)
const DateSelector: React.FC<{
  selectedDate: string
  onDateChange: (date: string) => void
  currentLang: 'th' | 'en'
}> = memo(({ selectedDate, onDateChange, currentLang }) => {
  const displayDate = useMemo(
    () =>
      format(parseISO(selectedDate), 'PPPP', {
        locale: currentLang === 'th' ? th : enUS,
      }),
    [selectedDate, currentLang],
  )

  const [calendarOpen, setCalendarOpen] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  const handlePrevDay = useCallback(() => {
    onDateChange(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))
  }, [selectedDate, onDateChange])

  const handleNextDay = useCallback(() => {
    onDateChange(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))
  }, [selectedDate, onDateChange])

  const handleToday = useCallback(() => {
    onDateChange(format(new Date(), 'yyyy-MM-dd'))
  }, [onDateChange])

  const handleDateClick = useCallback(() => {
    setCalendarOpen(!calendarOpen)
  }, [calendarOpen])

  const handleDateChange = useCallback(
    (date: Date) => {
      onDateChange(format(date, 'yyyy-MM-dd'))
      setCalendarOpen(false)
    },
    [onDateChange],
  )

  // คลิกภายนอกปฏิทินเพื่อปิด
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(event.target as Node)
      ) {
        setCalendarOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const isToday = useMemo(
    () =>
      format(parseISO(selectedDate), 'yyyy-MM-dd') ===
      format(new Date(), 'yyyy-MM-dd'),
    [selectedDate],
  )

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
        position: 'relative',
      }}
    >
      <Button
        onClick={handlePrevDay}
        variant="outlined"
        size="small"
        sx={{
          minWidth: { xs: 36, sm: 40 },
          fontSize: { xs: '0.875rem', sm: '1rem' },
        }}
      >
        {'<'}
      </Button>
      <Box
        textAlign="center"
        sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        onClick={handleDateClick}
      >
        <Typography
          variant="h6"
          sx={{ fontSize: { xs: '0.9rem', sm: '1rem', md: '1.25rem' } }}
        >
          {displayDate}
        </Typography>
        <CalendarTodayIcon
          sx={{ ml: 1, fontSize: { xs: '0.875rem', sm: '1rem' } }}
        />
        {!isToday && (
          <Button
            onClick={(e) => {
              e.stopPropagation()
              handleToday()
            }}
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 'normal',
              ml: 1,
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              display: { xs: 'none', sm: 'inline-flex' },
            }}
          >
            {currentLang === 'th' ? 'กลับไปวันนี้' : 'Go to Today'}
          </Button>
        )}

        {calendarOpen && (
          <Paper
            ref={calendarRef}
            sx={{
              position: 'absolute',
              top: '100%',
              left: { xs: '0', sm: '50%' },
              transform: { xs: 'none', sm: 'translateX(-50%)' },
              width: { xs: '100vw', sm: 'auto' },
              maxWidth: { xs: '100vw', sm: 400 },
              zIndex: 1000,
              p: { xs: 1, sm: 2 },
              mt: 1,
              boxShadow: 3,
            }}
          >
            <LocalizationProvider
              dateAdapter={AdapterDateFns}
              adapterLocale={currentLang === 'th' ? th : enUS}
            >
              <StaticDatePicker
                displayStaticWrapperAs="desktop"
                value={parseISO(selectedDate)}
                onChange={(newValue: Date | null) => {
                  if (newValue) {
                    handleDateChange(newValue)
                  }
                }}
                slots={{
                  actionBar: () => null, // ไม่แสดง action bar
                }}
                slotProps={{
                  toolbar: { hidden: true },
                }}
              />
            </LocalizationProvider>
          </Paper>
        )}
      </Box>
      <Button
        onClick={handleNextDay}
        variant="outlined"
        size="small"
        sx={{
          minWidth: { xs: 36, sm: 40 },
          fontSize: { xs: '0.875rem', sm: '1rem' },
        }}
      >
        {'>'}
      </Button>
    </Box>
  )
})

DateSelector.displayName = 'DateSelector'

// Helper TabPanel component
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
      id={`edit-food-tabpanel-${index}`}
      aria-labelledby={`edit-food-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2, maxHeight: 'calc(70vh - 180px)', overflowY: 'auto' }}>
          {' '}
          {/* Added maxHeight and overflowY */}
          {children}
        </Box>
      )}
    </div>
  )
}

// Helper function to create TextField for nutrients
const NutrientTextField: React.FC<{
  label: string
  name: string // e.g., "nutrition.calories" or "micronutrients.vitamin_c.value"
  value: number | undefined | string // Allow string for initial empty display
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  unit?: string
  disabled?: boolean
  error?: boolean
  helperText?: string
}> = ({ label, name, value, onChange, unit, disabled, error, helperText }) => (
  <TextField
    label={label}
    name={name}
    type="number"
    value={value === undefined || value === null ? '' : String(value)}
    onChange={onChange}
    fullWidth
    variant="outlined"
    size="small"
    margin="normal"
    disabled={disabled}
    error={error}
    helperText={helperText}
    InputProps={{
      endAdornment: unit ? (
        <InputAdornment position="end">{unit}</InputAdornment>
      ) : null,
      inputProps: { step: 'any' }, // Allow decimal inputs
    }}
    sx={{
      '& .MuiInputLabel-root': {
        fontSize: { xs: '0.875rem', sm: '1rem' },
      },
      '& .MuiInputBase-input': {
        fontSize: { xs: '0.875rem', sm: '1rem' },
      },
      '& .MuiInputAdornment-root': {
        '& .MuiTypography-root': {
          fontSize: { xs: '0.75rem', sm: '0.875rem' },
        },
      },
      '& .MuiFormHelperText-root': {
        fontSize: { xs: '0.7rem', sm: '0.75rem' },
      },
    }}
  />
)

const DailyReportView: React.FC = memo(() => {
  // ✅ MOVE ALL HOOKS TO THE TOP - ย้าย Hook ทั้งหมดมาไว้ด้านบนสุด
  const {
    selectedDate,
    dailyData,
    isDailyLoading,
    dailyError,
    setSelectedDate,
    updateFoodItem,
    deleteFoodItem,
    currentLiffFoodLog,
    fetchDailyReport,
    updateLiffFoodLog,
    setCurrentLiffFoodLog,
    fetchLiffFoodLog,
    setDailyLoading,
  } = useNutritionStore()

  // ใช้ custom hook แทนการ duplicate code
  const { userId, idToken, isReady: liffReady, error: liffError } = useLiff()

  // เพิ่มการรองรับภาษาตามโปรไฟล์ผู้ใช้
  const [currentLang, setCurrentLang] = useState<'th' | 'en'>('th')

  // เพิ่ม safe check สำหรับ dailyData - แก้ไข ESLint warning ด้วย useMemo
  const safeDailyData = useMemo(() => {
    return (
      dailyData || {
        calories: { consumed: 0, goal: 2000 },
        macronutrients: {
          protein: { consumed: 0, goal: 150 },
          carbs: { consumed: 0, goal: 250 },
          fat: { consumed: 0, goal: 67 },
        },
        otherNutrients: {
          fiber: { consumed: 0, goal: 25 },
          sugar: { consumed: 0, goal: 50 },
          sodium: { consumed: 0, goal: 2300 },
          water: { consumed: 0, goal: 2000 },
          cholesterol: { consumed: 0, goal: 300 },
          saturated_fat: { consumed: 0, goal: 20 },
          trans_fat: { consumed: 0, goal: 0 },
          polyunsaturated_fat: { consumed: 0, goal: 22 },
          monounsaturated_fat: { consumed: 0, goal: 33 },
          omega3: { consumed: 0, goal: 1.6 },
          potassium_nutrient: { consumed: 0, goal: 3500 },
        },
        micronutrients: {},
        meals: [],
      }
    )
  }, [dailyData])

  // Effect สำหรับดึงภาษาจาก LIFF
  useEffect(() => {
    const getLiffLanguage = () => {
      if (liffReady) {
        try {
          const win = window as { liff?: { getLanguage?: () => string } }
          if (win.liff && typeof win.liff.getLanguage === 'function') {
            const liffLang = win.liff.getLanguage()
            // LIFF language codes: 'ja', 'ko', 'en', 'zh_TW', 'zh'
            const supportedLang = liffLang === 'en' ? 'en' : 'th'
            setCurrentLang(supportedLang)
            if (process.env.NODE_ENV === 'development') {
              console.log(
                '[DEBUG] LIFF language:',
                liffLang,
                'Setting to:',
                supportedLang,
              )
            }
          }
        } catch (error) {
          console.warn(
            '[WARN] Failed to get LIFF language, using default:',
            error,
          )
          setCurrentLang('th') // fallback to Thai
        }
      }
    }

    getLiffLanguage()
  }, [liffReady])

  // Memoized values for chart data
  const macroPieData = useMemo(() => {
    const protein = safeDailyData.macronutrients.protein.consumed || 0
    const carbs = safeDailyData.macronutrients.carbs.consumed || 0
    const fat = safeDailyData.macronutrients.fat.consumed || 0

    return [
      {
        name: currentLang === 'th' ? 'โปรตีน' : 'Protein',
        value: protein * 4, // Convert to calories
        color: '#3498db',
      },
      {
        name: currentLang === 'th' ? 'คาร์โบไฮเดรต' : 'Carbs',
        value: carbs * 4,
        color: '#2ecc71',
      },
      {
        name: currentLang === 'th' ? 'ไขมัน' : 'Fat',
        value: fat * 9,
        color: '#f1c40f',
      },
    ]
  }, [safeDailyData.macronutrients, currentLang])

  const caloriesConsumed = safeDailyData.calories?.consumed || 0
  const caloriesGoal = safeDailyData.calories?.goal || 2000

  const mealCaloriesData = useMemo(() => {
    return safeDailyData.meals.map((meal) => ({
      name: meal.name || 'Unknown',
      calories: meal.totalCalories || 0,
    }))
  }, [safeDailyData.meals])

  const micronutrientsSummary = useMemo((): _UIMicronutrients => {
    const currentOtherNutrients = safeDailyData.otherNutrients || {}
    const micro = safeDailyData.micronutrients

    let potassiumValueFromMicro: number | undefined = undefined
    let potassiumGoalFromMicro: number | undefined = undefined

    if (micro && typeof micro === 'object' && 'potassium' in micro) {
      const microMap = micro as MicronutrientsMap
      if (microMap.potassium) {
        potassiumValueFromMicro = microMap.potassium.value
        potassiumGoalFromMicro = microMap.potassium.goal
      }
    }

    const potassiumConsumedFromOther =
      currentOtherNutrients.potassium_nutrient?.consumed
    const potassiumGoalFromOther =
      currentOtherNutrients.potassium_nutrient?.goal

    // Correctly type otherNutrients for safe access to caffeine and alcohol
    const typedOtherNutrients =
      (currentOtherNutrients as Partial<
        DailyNutritionData['otherNutrients']
      >) ?? {}

    const summary: _UIMicronutrients = {
      fiber: {
        consumed: currentOtherNutrients.fiber?.consumed || 0,
        goal: currentOtherNutrients.fiber?.goal || 25,
        unit: (currentOtherNutrients.fiber as NutrientGoalData)?.unit || 'g',
      },
      sugar: {
        consumed: currentOtherNutrients.sugar?.consumed || 0,
        goal: currentOtherNutrients.sugar?.goal || 50, // Adjusted default goal for sugar
        unit: (currentOtherNutrients.sugar as NutrientGoalData)?.unit || 'g',
      },
      sodium: {
        consumed: currentOtherNutrients.sodium?.consumed || 0,
        goal: currentOtherNutrients.sodium?.goal || 2300,
        unit: (currentOtherNutrients.sodium as NutrientGoalData)?.unit || 'mg',
      },
      cholesterol: {
        consumed: currentOtherNutrients.cholesterol?.consumed || 0,
        goal: currentOtherNutrients.cholesterol?.goal || 300,
        unit:
          (currentOtherNutrients.cholesterol as NutrientGoalData)?.unit || 'mg',
      },
      saturated_fat: {
        consumed: currentOtherNutrients.saturated_fat?.consumed || 0,
        goal: currentOtherNutrients.saturated_fat?.goal || 20,
        unit:
          (currentOtherNutrients.saturated_fat as NutrientGoalData)?.unit ||
          'g',
      },
      trans_fat: {
        consumed: currentOtherNutrients.trans_fat?.consumed || 0,
        goal: currentOtherNutrients.trans_fat?.goal || 0,
        unit:
          (currentOtherNutrients.trans_fat as NutrientGoalData)?.unit || 'g',
      },
      polyunsaturated_fat: {
        consumed: currentOtherNutrients.polyunsaturated_fat?.consumed || 0,
        goal: currentOtherNutrients.polyunsaturated_fat?.goal || 22,
        unit:
          (currentOtherNutrients.polyunsaturated_fat as NutrientGoalData)
            ?.unit || 'g',
      },
      monounsaturated_fat: {
        consumed: currentOtherNutrients.monounsaturated_fat?.consumed || 0,
        goal: currentOtherNutrients.monounsaturated_fat?.goal || 33, // Adjusted default goal
        unit:
          (currentOtherNutrients.monounsaturated_fat as NutrientGoalData)
            ?.unit || 'g',
      },
      omega3: {
        consumed: currentOtherNutrients.omega3?.consumed || 0,
        goal: currentOtherNutrients.omega3?.goal || 1.6, // Adjusted default goal
        unit: (currentOtherNutrients.omega3 as NutrientGoalData)?.unit || 'g',
      },
      water: {
        consumed: currentOtherNutrients.water?.consumed || 0,
        goal: currentOtherNutrients.water?.goal || 2000,
        unit: (currentOtherNutrients.water as NutrientGoalData)?.unit || 'ml',
      },
      potassium_nutrient: {
        consumed: potassiumValueFromMicro ?? potassiumConsumedFromOther ?? 0,
        goal:
          potassiumGoalFromMicro && potassiumGoalFromMicro > 0
            ? potassiumGoalFromMicro
            : potassiumGoalFromOther && potassiumGoalFromOther > 0
              ? potassiumGoalFromOther
              : 3500,
        unit:
          (currentOtherNutrients.potassium_nutrient as NutrientGoalData)
            ?.unit || 'mg',
      },
      caffeine: {
        consumed: typedOtherNutrients.caffeine?.consumed || 0,
        goal: typedOtherNutrients.caffeine?.goal || 400,
        unit: typedOtherNutrients.caffeine?.unit || 'mg',
      },
      alcohol: {
        consumed: typedOtherNutrients.alcohol?.consumed || 0,
        goal: typedOtherNutrients.alcohol?.goal, // Goal for alcohol can be undefined or 0
        unit: typedOtherNutrients.alcohol?.unit || 'g',
      },
    }
    return summary
  }, [safeDailyData])

  // Tooltip formatters
  const tooltipFormatter = (value: number, name: string) => {
    return [`${value} kcal`, name]
  }

  const barTooltipFormatter = (value: number, name: string) => {
    return [`${value} kcal`, name]
  }

  // MEAL_EMOJIS constant - แก้ไข ESLint warning ด้วย useMemo
  const MEAL_EMOJIS: Record<string, string> = useMemo(
    () => ({
      breakfast: '🌅',
      lunch: '🌞',
      dinner: '🌙',
      snack: '🍪',
      other: '🍽️',
    }),
    [],
  )

  const [expandedMicronutrients, setExpandedMicronutrients] =
    useState<boolean>(false)
  const [expandedOtherNutrients, setExpandedOtherNutrients] =
    useState<boolean>(false)

  // States for Modals
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false)
  const [editingFoodItem, setEditingFoodItem] = useState<SharedFoodItem | null>(
    null,
  )
  const [currentEditingMealId, setCurrentEditingMealId] = useState<
    string | null
  >(null)
  const [deletingFoodItemInfo, setDeletingFoodItemInfo] = useState<{
    mealId: string
    foodItem: SharedFoodItem
  } | null>(null)
  const [editedFields, setEditedFields] = useState<Partial<SharedFoodItem>>({})
  const [activeTab, setActiveTab] = useState(0)

  // Define the list of all relevant micronutrients with their default units
  const ALL_MICRONUTRIENTS_SCHEMA: Record<
    string,
    { unit: string; name: string }
  > = useMemo(
    () => ({
      vitamin_a: { unit: 'IU', name: 'Vitamin A' },
      vitamin_c: { unit: 'mg', name: 'Vitamin C' },
      vitamin_d: { unit: 'µg', name: 'Vitamin D' },
      vitamin_e: { unit: 'mg', name: 'Vitamin E' },
      vitamin_k: { unit: 'µg', name: 'Vitamin K' },
      vitamin_b1: { unit: 'mg', name: 'Vitamin B1 (Thiamin)' },
      vitamin_b2: { unit: 'mg', name: 'Vitamin B2 (Riboflavin)' },
      vitamin_b3: { unit: 'mg', name: 'Vitamin B3 (Niacin)' },
      vitamin_b5: { unit: 'mg', name: 'Vitamin B5 (Pantothenic Acid)' },
      vitamin_b6: { unit: 'mg', name: 'Vitamin B6 (Pyridoxine)' },
      vitamin_b9: { unit: 'µg', name: 'Vitamin B9 (Folate)' },
      vitamin_b12: { unit: 'µg', name: 'Vitamin B12 (Cobalamin)' },
      calcium: { unit: 'mg', name: 'Calcium' },
      iron: { unit: 'mg', name: 'Iron' },
      magnesium: { unit: 'mg', name: 'Magnesium' },
      potassium: { unit: 'mg', name: 'Potassium' },
      zinc: { unit: 'mg', name: 'Zinc' },
      phosphorus: { unit: 'mg', name: 'Phosphorus' },
      selenium: { unit: 'µg', name: 'Selenium' },
      copper: { unit: 'mg', name: 'Copper' },
      manganese: { unit: 'mg', name: 'Manganese' },
      iodine: { unit: 'µg', name: 'Iodine' },
      // Other nutrients that might be edited here if not in the main nutrition object
      // These are often in `otherNutrients` or directly in `nutrition` DTO for backend.
      // For simplicity, if they are primary edit targets, they can be added here.
      // fiber: { unit: 'g', name: 'Fiber' }, (already in general tab)
      // sugar: { unit: 'g', name: 'Sugar' }, (already in general tab)
      // sodium: { unit: 'mg', name: 'Sodium' }, (already in general tab)
      // cholesterol: { unit: 'mg', name: 'Cholesterol' }, (already in general tab)
      // saturated_fat: { unit: 'g', name: 'Saturated Fat' }, (already in general tab)
    }),
    [], // Removed currentLang dependency as names are now for internal mapping
  )

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  // New state for animation/fade-in effects
  const [contentLoaded, setContentLoaded] = useState(false)

  // เพิ่ม state เพื่อจัดการกับ error ที่อาจเกิดขึ้นในระหว่าง render
  const [_renderError, setRenderError] = useState<string | null>(null)

  // State for the LIFF food log editing form
  const [editingLiffItemData, setEditingLiffItemData] =
    useState<UpdateFoodLogPayload | null>(null)

  // 🚀 Smart Hybrid Architecture States
  const [fallbackGoals, setFallbackGoals] = useState<NutritionGoals | null>(
    null,
  )
  const [isUsingFallback, setIsUsingFallback] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  const [_isLiffFormLoading, setIsLiffFormLoading] = useState(false)
  const [_liffFormError, setLiffFormError] = useState<string | null>(null)

  // ✅ เพิ่ม state สำหรับ delete feedback
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ✅ Auto-hide success/error messages หลัง 3 วินาที
  useEffect(() => {
    if (deleteSuccess) {
      const timer = setTimeout(() => {
        setDeleteSuccess(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [deleteSuccess])

  useEffect(() => {
    if (deleteError) {
      const timer = setTimeout(() => {
        setDeleteError(null)
      }, 5000) // error message ให้แสดงนานกว่าเล็กน้อย
      return () => clearTimeout(timer)
    }
  }, [deleteError])

  const urlParams = useUrlParameters()

  const fetchLiffData = useCallback(
    async (logId: string, currentUserId: string, currentIdToken: string) => {
      if (!logId || !currentUserId || !currentIdToken) {
        setLiffFormError(
          currentLang === 'th'
            ? 'ข้อมูลผู้ใช้หรือ Log ID ไม่ถูกต้อง'
            : 'Invalid user data or Log ID',
        )
        return
      }
      setIsLiffFormLoading(true)
      setLiffFormError(null)
      try {
        console.log(
          `[LiffForm] Fetching data for logId: ${logId}, userId: ${currentUserId}`,
        )
        await fetchLiffFoodLog(logId, currentUserId, currentIdToken)
        console.log('[LiffForm] Data fetched successfully:', currentLiffFoodLog)
      } catch (err: unknown) {
        console.error('[LiffForm] Error fetching data:', err)
        const errorMessage = err instanceof Error ? err.message : String(err)
        setLiffFormError(
          currentLang === 'th'
            ? `เกิดข้อผิดพลาดในการบันทึก: ${errorMessage}`
            : `Error loading data: ${errorMessage}`,
        )
      } finally {
        setIsLiffFormLoading(false)
      }
    },
    [fetchLiffFoodLog, currentLiffFoodLog, currentLang],
  )

  // ✅ ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // 🧮 Smart Hybrid Calculation Functions
  const calculateFallbackGoals = useCallback(
    (profile: UserProfile): NutritionGoals | null => {
      try {
        if (!validateUserProfileForCalculation(profile)) {
          return null
        }

        const goals = calculateNutritionGoals(profile)
        return goals
      } catch (error) {
        console.error('[Hybrid] Error calculating fallback goals:', error)
        return null
      }
    },
    [],
  )

  // 🔄 Hybrid Goals Provider - Backend first, Profile stored, Frontend fallback
  const getEffectiveGoals = useCallback(() => {
    // Priority 1: Backend data (most accurate)
    if (dailyData?.calories?.goal && dailyData?.macronutrients) {
      return {
        calories: dailyData.calories.goal,
        protein: dailyData.macronutrients.protein.goal || 0,
        carbs: dailyData.macronutrients.carbs.goal || 0,
        fat: dailyData.macronutrients.fat.goal || 0,
        // Add other nutrients from backend if available
        fiber: dailyData.otherNutrients?.fiber?.goal || 25,
        sugar: dailyData.otherNutrients?.sugar?.goal || 50,
        sodium: dailyData.otherNutrients?.sodium?.goal || 2300,
        water: dailyData.otherNutrients?.water?.goal || 2000,
        cholesterol: dailyData.otherNutrients?.cholesterol?.goal || 300,
        saturated_fat: dailyData.otherNutrients?.saturated_fat?.goal || 20,
        omega3: dailyData.otherNutrients?.omega3?.goal || 1.6,
      }
    }

    // Priority 1.5: User profile stored nutrition goals (from database)
    if (userProfile) {
      // Cast userProfile to access SharedUserProfileDto fields
      const profileWithGoals = userProfile as any
      const storedGoals = {
        calories: profileWithGoals.dailyCaloriesGoal || 0,
        protein: profileWithGoals.dailyProteinGoal || 0,
        carbs: profileWithGoals.dailyCarbsGoal || 0,
        fat: profileWithGoals.dailyFatGoal || 0,
        fiber: profileWithGoals.dailyFiberGoal || 25,
        sugar: profileWithGoals.dailySugarGoal || 50,
        sodium: profileWithGoals.dailySodiumGoal || 2300,
        water: profileWithGoals.dailyWaterGoal || 2000,
        cholesterol: profileWithGoals.dailyCholesterolGoal || 300,
        saturated_fat: profileWithGoals.dailySaturatedFatGoal || 20,
        omega3: profileWithGoals.dailyOmega3Goal || 1.6,
      }

      // Use stored goals if they have valid values (greater than 0 for main nutrients)
      if (storedGoals.calories > 0 && storedGoals.protein > 0) {
        console.log('[Hybrid] Using stored nutrition goals from user profile')
        return storedGoals
      }
    }

    // Priority 2: Frontend calculated fallback
    if (fallbackGoals && isUsingFallback) {
      console.log('[Hybrid] Using frontend calculated fallback goals')
      return fallbackGoals
    }

    // Priority 3: Default values (last resort)
    console.log('[Hybrid] Using default nutrition goals (last resort)')
    return {
      calories: 2000,
      protein: 150,
      carbs: 250,
      fat: 67,
      fiber: 25,
      sugar: 50,
      sodium: 2300,
      water: 2000,
      cholesterol: 300,
      saturated_fat: 20,
      omega3: 1.6,
    }
  }, [dailyData, userProfile, fallbackGoals, isUsingFallback])

  // Memoized functions to prevent unnecessary re-renders
  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date)
    },
    [setSelectedDate],
  )

  const handleFetchDailyReportHandler = useCallback(
    (date: string, userIdParam: string, tokenParam: string | null) => {
      if (tokenParam === null) {
        console.warn(
          '[DailyReportView] Attempted to fetch daily report with null token.',
        )
        return Promise.resolve()
      }
      return fetchDailyReport(date, userIdParam, tokenParam)
    },
    [fetchDailyReport],
  )

  const handleFetchFoodLogByIdForLiffHandler = useCallback(
    (logId: string, userIdParam: string, tokenParam: string | null) => {
      if (tokenParam === null) {
        console.warn(
          '[DailyReportView] Attempted to fetch food log with null token.',
        )
        return Promise.resolve()
      }
      return fetchLiffFoodLog(logId, userIdParam, tokenParam)
    },
    [fetchLiffFoodLog],
  )

  const handleLogIdFoundHandler = useCallback(
    (logId: string) => {
      if (userId && idToken) {
        handleFetchFoodLogByIdForLiffHandler(logId, userId, idToken).catch(
          (err: any) => {
            console.error('Error fetching specific food log for LIFF:', err)
            const errorMessage =
              err instanceof Error
                ? err.message
                : 'เกิดข้อผิดพลาดในการดึงข้อมูลบันทึกสำหรับ LIFF'
            setRenderError(errorMessage)
          },
        )
      }
    },
    [userId, idToken, handleFetchFoodLogByIdForLiffHandler],
  )

  useEffect(() => {
    if (urlParams) {
      if (urlParams.dateFromUrl) {
        handleDateChange(urlParams.dateFromUrl)
      }
      if (urlParams.logId) {
        handleLogIdFoundHandler(urlParams.logId)
      }
    }
  }, [urlParams, handleDateChange, handleLogIdFoundHandler])

  // 🚀 Smart Hybrid Architecture Effects

  // Effect 1: Initialize user profile for fallback calculations
  useEffect(() => {
    const initializeUserProfile = () => {
      if (liffReady && userId && idToken) {
        try {
          // Try to get user profile from API or localStorage
          const cachedProfile = localStorage.getItem(`userProfile_${userId}`)
          if (cachedProfile) {
            const profile = JSON.parse(cachedProfile) as UserProfile
            setUserProfile(profile)

            // Calculate fallback goals
            const goals = calculateFallbackGoals(profile)
            if (goals) {
              setFallbackGoals(goals)
            }
          }
        } catch (error) {
          console.error('[Hybrid] Error initializing user profile:', error)
        }
      }
    }

    initializeUserProfile()
  }, [liffReady, userId, idToken, calculateFallbackGoals])

  // Effect 2: Monitor backend data availability and switch to fallback if needed
  useEffect(() => {
    if (dailyError && !dailyData && userProfile && fallbackGoals) {
      setIsUsingFallback(true) // Restored setIsUsingFallback
    } else if (dailyData && isUsingFallback) {
      setIsUsingFallback(false) // Restored setIsUsingFallback
    }
  }, [dailyError, dailyData, userProfile, fallbackGoals, isUsingFallback])

  // ดึงข้อมูลเมื่อ LIFF พร้อม และมี userId, idToken
  useEffect(() => {
    if (liffReady && userId && idToken) {
      console.log(`[DailyReportView] Fetching data for date: ${selectedDate}`)
      handleFetchDailyReportHandler(selectedDate, userId, idToken).catch(
        (err) => {
          console.error('[DailyReportView] Error fetching daily report:', err)
        },
      )
    }
  }, [
    liffReady,
    userId,
    idToken,
    selectedDate,
    // ✅ ลบ currentLiffFoodLog ออกเพื่อป้องกัน infinite calls
    handleFetchDailyReportHandler,
  ])

  // useEffect to update editingLiffItemData when currentLiffFoodLog changes
  useEffect(() => {
    if (currentLiffFoodLog) {
      const currentLog = currentLiffFoodLog // currentLog is LiffFoodLogData
      const foodDetailFromLog = currentLog.food // foodDetailFromLog is FoodLog | undefined

      let foodPayloadForStore: FoodLog | undefined = undefined

      if (foodDetailFromLog) {
        // Construct a valid FoodLog object from foodDetailFromLog
        foodPayloadForStore = {
          foodName: foodDetailFromLog.foodName || { th: '', en: '' },
          amount: foodDetailFromLog.amount || 0,
          unit: foodDetailFromLog.unit || '',
          portion: foodDetailFromLog.portion, // portion is optional in FoodLog
          nutrition: foodDetailFromLog.nutrition
            ? { ...foodDetailFromLog.nutrition }
            : { calories: 0, protein: 0, carbs: 0, fat: 0 },
          micronutrients: foodDetailFromLog.micronutrients, // micronutrients is optional
        }
      }

      // Construct the payload for the state, ensuring it matches UpdateFoodLogPayload from nutritionStore
      const payloadForState: UpdateFoodLogPayload = {
        mealType: currentLog.mealType,
        imageUrl: currentLog.imageUrl,
        imageAlt: currentLog.imageAlt || '',
        food: foodPayloadForStore, // This should be FoodLog | undefined
      }
      setEditingLiffItemData(payloadForState)
    } else {
      setEditingLiffItemData(null)
    }
  }, [currentLiffFoodLog])

  // useEffect for automatic calorie calculation in LIFF form - แก้ไข missing dependency
  useEffect(() => {
    if (
      editingLiffItemData?.food?.nutrition &&
      (typeof editingLiffItemData.food.nutrition.protein === 'number' ||
        typeof editingLiffItemData.food.nutrition.carbs === 'number' ||
        typeof editingLiffItemData.food.nutrition.fat === 'number')
    ) {
      const { protein, carbs, fat } = editingLiffItemData.food.nutrition
      const proteinGrams = typeof protein === 'number' ? protein : 0
      const carbsGrams = typeof carbs === 'number' ? carbs : 0
      const fatGrams = typeof fat === 'number' ? fat : 0

      const calculatedCalories =
        proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9

      if (calculatedCalories !== editingLiffItemData.food.nutrition.calories) {
        setEditingLiffItemData((prevData) => {
          if (!prevData?.food?.nutrition) return prevData

          const newData: UpdateFoodLogPayload = JSON.parse(
            JSON.stringify(prevData),
          ) as UpdateFoodLogPayload

          if (newData.food && newData.food.nutrition) {
            newData.food.nutrition.calories = calculatedCalories
          }
          return newData
        })
      }
    }
  }, [editingLiffItemData?.food?.nutrition])

  // Use effect for animation when data loads
  useEffect(() => {
    if (dailyData && !isDailyLoading) {
      // Small timeout to allow component to render first
      const timer = setTimeout(() => {
        setContentLoaded(true)
      }, 100)
      return () => clearTimeout(timer)
    }
    return () => {}
  }, [dailyData, isDailyLoading])

  // เพิ่ม effect สำหรับตรวจสอบวันที่ทุกครั้งที่ component ถูกโหลด
  useEffect(() => {
    // ตรวจสอบว่าวันที่ถูกต้องหรือไม่
    const selectedDateObj = new Date(selectedDate)
    const now = new Date()

    if (isNaN(selectedDateObj.getTime())) {
      console.error('[ERROR] Invalid date in DailyReportView:', selectedDate)
      setRenderError('วันที่ไม่ถูกต้อง กำลังรีเซ็ตเป็นวันปัจจุบัน...')

      // รีเซ็ตวันที่เป็นวันปัจจุบัน
      setTimeout(() => {
        const todayStr = now.toISOString().split('T')[0]
        setSelectedDate(todayStr)
      }, 500)
      return
    }

    if (selectedDateObj > now) {
      console.warn('[WARNING] Selected date is in the future:', selectedDate)
      setRenderError(
        'ไม่สามารถดูข้อมูลในอนาคตได้ กำลังรีเซ็ตเป็นวันปัจจุบัน...',
      )

      // รีเซ็ตวันที่เป็นวันปัจจุบัน
      setTimeout(() => {
        const todayStr = now.toISOString().split('T')[0]
        setSelectedDate(todayStr)
      }, 500)
      return
    }
  }, [selectedDate, setSelectedDate])

  // ✅ ALL EVENT HANDLERS - ย้าย event handlers มาไว้หลัง useEffect
  const handleAccordionChangeHandler = useCallback(
    (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      if (panel === 'macronutrients') {
        setExpandedMicronutrients(false)
        setExpandedOtherNutrients(false)
      } else if (panel === 'micronutrients') {
        setExpandedMicronutrients(isExpanded)
      } else if (panel === 'otherNutrients') {
        setExpandedOtherNutrients(isExpanded)
      }
    },
    [],
  )

  const handleOpenEditModalHandler = useCallback(
    (mealId: string, foodItem: SharedFoodItem) => {
      setCurrentEditingMealId(mealId)
      setEditingFoodItem(foodItem)

      // Pre-populate edited fields with current values using correct FoodItem structure
      // Initialize with all fields from foodItem, then specifically populate micronutrients
      const initialEditedFields: Partial<SharedFoodItem> & {
        micronutrients?: MicronutrientsMap
      } = {
        ...JSON.parse(JSON.stringify(foodItem)), // Deep clone to avoid mutating original
        micronutrients: {}, // Initialize micronutrients as an empty object
      }

      // Populate micronutrients from schema and existing data
      if (initialEditedFields.micronutrients) {
        for (const key in ALL_MICRONUTRIENTS_SCHEMA) {
          const schemaInfo = ALL_MICRONUTRIENTS_SCHEMA[key]
          const existingMicroData =
            foodItem.micronutrients?.[key as keyof MicronutrientsMap]
          initialEditedFields.micronutrients[key as keyof MicronutrientsMap] = {
            value: existingMicroData?.value ?? 0, // Default to 0 if not present
            unit: existingMicroData?.unit || schemaInfo.unit,
            // dv and goal are optional and will be preserved if they exist on existingMicroData
            ...(existingMicroData?.dv !== undefined && {
              dv: existingMicroData.dv,
            }),
            ...(existingMicroData?.goal !== undefined && {
              goal: existingMicroData.goal,
            }),
          }
        }
      }

      // Ensure nutrition object and its primary fields exist if not on foodItem for some reason
      if (!initialEditedFields.nutrition) {
        initialEditedFields.nutrition = {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        }
      } else {
        initialEditedFields.nutrition.calories =
          initialEditedFields.nutrition.calories ?? 0
        initialEditedFields.nutrition.protein =
          initialEditedFields.nutrition.protein ?? 0
        initialEditedFields.nutrition.carbs =
          initialEditedFields.nutrition.carbs ?? 0
        initialEditedFields.nutrition.fat =
          initialEditedFields.nutrition.fat ?? 0
      }

      // Ensure serving object exists
      if (!initialEditedFields.serving) {
        initialEditedFields.serving = { size: 0, unit: '' }
      }

      setEditedFields(initialEditedFields)
      setActiveTab(0) // Reset to the first tab
      setEditModalOpen(true)
    },
    [ALL_MICRONUTRIENTS_SCHEMA],
  )

  const handleCloseEditModalHandler = useCallback(() => {
    setEditModalOpen(false)
    setEditingFoodItem(null)
    setCurrentEditingMealId(null)
    setEditedFields({})
    setActiveTab(0) // Reset tab to first
  }, [])

  const handleEditFieldChangeHandler = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target

      const isNotStrictlyNumericField =
        name.startsWith('name.') || name.endsWith('.unit')

      let processedValue: string | number | undefined = value

      if (!isNotStrictlyNumericField) {
        if (value === '') {
          processedValue = undefined
        } else {
          const numValue = parseFloat(value)
          if (isNaN(numValue)) {
            processedValue = value
          } else {
            processedValue = numValue
          }
        }
      }

      setEditedFields((prev) => {
        const newEditedFields = JSON.parse(JSON.stringify(prev || {})) // Deep clone

        const keys = name.split('.')
        let current = newEditedFields

        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i]
          if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {}
          }
          current = current[key]
        }

        const finalKey = keys[keys.length - 1]

        if (!isNotStrictlyNumericField) {
          if (typeof processedValue === 'string' && processedValue !== '') {
            const numVal = parseFloat(processedValue)
            current[finalKey] = isNaN(numVal) ? undefined : numVal
          } else if (typeof processedValue === 'number') {
            current[finalKey] = processedValue
          } else {
            current[finalKey] = undefined
          }
        } else {
          current[finalKey] = processedValue // For string fields
        }

        // Ensure parent objects for nutrition and serving are initialized if they become defined
        if (
          keys[0] === 'nutrition' &&
          !newEditedFields.nutrition &&
          typeof current === 'object' &&
          current !== null
        ) {
          newEditedFields.nutrition = { ...current } as NutritionData
        }
        if (
          keys[0] === 'serving' &&
          !newEditedFields.serving &&
          typeof current === 'object' &&
          current !== null
        ) {
          newEditedFields.serving = { ...current } as ServingInfo
        }

        if (
          keys.length === 3 &&
          keys[0] === 'micronutrients' &&
          keys[2] === 'value'
        ) {
          const micronutrientKey = keys[1] as keyof MicronutrientsMap
          const originalMicronutrient =
            editingFoodItem?.micronutrients?.[micronutrientKey]
          const schemaInfo = ALL_MICRONUTRIENTS_SCHEMA[micronutrientKey]

          if (
            current[micronutrientKey] &&
            typeof current[micronutrientKey] === 'object'
          ) {
            current[micronutrientKey].unit =
              current[micronutrientKey].unit ||
              originalMicronutrient?.unit ||
              schemaInfo?.unit
            if (originalMicronutrient?.dv !== undefined)
              current[micronutrientKey].dv = originalMicronutrient.dv
            if (originalMicronutrient?.goal !== undefined)
              current[micronutrientKey].goal = originalMicronutrient.goal
          } else if (originalMicronutrient || schemaInfo) {
            current[micronutrientKey] = {
              value: !isNotStrictlyNumericField
                ? typeof processedValue === 'number'
                  ? processedValue
                  : undefined
                : undefined,
              unit: originalMicronutrient?.unit || schemaInfo?.unit,
              ...(originalMicronutrient?.dv !== undefined && {
                dv: originalMicronutrient.dv,
              }),
              ...(originalMicronutrient?.goal !== undefined && {
                goal: originalMicronutrient.goal,
              }),
            }
          }
        }

        return newEditedFields
      })
    },
    [editingFoodItem, ALL_MICRONUTRIENTS_SCHEMA],
  )

  // Updated save handler - เพิ่ม loading state และ feedback
  const handleSaveFoodItemHandler = useCallback(() => {
    if (!editingFoodItem || !currentEditingMealId || !userId || !idToken) {
      console.error('[Edit] Missing required data for updating food item:', {
        editingFoodItem: !!editingFoodItem,
        currentEditingMealId: !!currentEditingMealId,
        userId: !!userId,
        idToken: !!idToken,
      })
      return
    }

    // Create a deep copy of the original item to modify
    const updatedFoodItemData: SharedFoodItem = JSON.parse(
      JSON.stringify(editingFoodItem),
    )

    // Deep merge changes from editedFields into updatedFoodItemData
    // This custom merge handles undefined values in editedFields correctly (they mean "clear the field")
    const deepMergeWithUndefinedClearing = (target: any, source: any) => {
      for (const key of Object.keys(source)) {
        if (source[key] === undefined && key in target) {
          // If source value is undefined, delete the key from target
          // This is how we clear optional fields
          // However, for micronutrients, we might want to keep the object structure
          // and just set value to undefined/0.
          // For now, a simple undefined check might be too aggressive for nested objects.
          // Let's refine this: only delete if it's not a nested object structure we want to preserve.
          if (typeof target[key] !== 'object' || target[key] === null) {
            delete target[key]
          } else if (
            Object.keys(source[key]).length === 0 &&
            key !== 'micronutrients' &&
            key !== 'nutrition' &&
            key !== 'name' &&
            key !== 'serving'
          ) {
            // If it's an empty object from source (e.g. cleared out micronutrient details)
            // and not a main structural object, consider removing.
            // This part is tricky and needs careful testing.
            // For now, let's assume undefined means clear for primitive values.
          }
        } else if (
          source[key] instanceof Object &&
          !Array.isArray(source[key]) &&
          source[key] !== null
        ) {
          if (
            !target[key] ||
            typeof target[key] !== 'object' ||
            Array.isArray(target[key]) ||
            target[key] === null
          ) {
            target[key] = {} // Ensure target path exists and is an object
          }
          deepMergeWithUndefinedClearing(target[key], source[key])
        } else if (source[key] !== undefined) {
          // Assign primitives, arrays, or new keys
          target[key] = source[key]
        }
      }
    }

    deepMergeWithUndefinedClearing(updatedFoodItemData, editedFields)

    // Recalculate calories if macronutrients were changed, only if nutrition object exists
    if (updatedFoodItemData.nutrition) {
      const { protein, carbs, fat } = updatedFoodItemData.nutrition
      const p = typeof protein === 'number' ? protein : 0
      const c = typeof carbs === 'number' ? carbs : 0
      const f = typeof fat === 'number' ? fat : 0
      // Only update calories if it's not explicitly set to something else in editedFields
      if (
        editedFields.nutrition?.calories === undefined ||
        editedFields.nutrition?.calories === null ||
        protein !== editingFoodItem.nutrition?.protein ||
        carbs !== editingFoodItem.nutrition?.carbs ||
        fat !== editingFoodItem.nutrition?.fat
      ) {
        updatedFoodItemData.nutrition.calories = p * 4 + c * 4 + f * 9
      }
    }

    // ✅ เพิ่ม loading state
    setDailyLoading(true)

    updateFoodItem(currentEditingMealId, updatedFoodItemData, userId, idToken)
      .then(() => {
        console.log('[Edit] Food item updated successfully')
        handleCloseEditModalHandler()
        // ✅ เพิ่ม success feedback
        console.log('✅ อาหารถูกอัพเดทเรียบร้อยแล้ว!')
      })
      .catch((error) => {
        console.error('[Edit] Error updating food item:', error)
      })
      .finally(() => {
        setDailyLoading(false)
      })
  }, [
    editingFoodItem,
    currentEditingMealId,
    editedFields,
    updateFoodItem,
    userId,
    idToken,
    handleCloseEditModalHandler,
    setDailyLoading, // ✅ เพิ่ม dependency
  ])

  const handleOpenConfirmDeleteModalHandler = useCallback(
    (mealId: string, foodItem: SharedFoodItem) => {
      setDeletingFoodItemInfo({ mealId, foodItem })
      setConfirmDeleteModalOpen(true)
    },
    [],
  )

  const handleCloseConfirmDeleteModalHandler = useCallback(() => {
    setConfirmDeleteModalOpen(false)
    setDeletingFoodItemInfo(null)
  }, [])

  const handleDeleteFoodItemHandler = useCallback(() => {
    if (!deletingFoodItemInfo || !userId || !idToken) {
      console.error('[Delete] Missing required data for deleting food item:', {
        deletingFoodItemInfo: !!deletingFoodItemInfo,
        userId: !!userId,
        idToken: !!idToken,
      })
      setDeleteError(
        currentLang === 'th'
          ? 'ข้อมูลไม่ครบถ้วนสำหรับการลบอาหาร'
          : 'Incomplete data for deleting food item',
      )
      return
    }

    // ✅ เคลียร์ feedback เก่าและเริ่ม loading
    setDeleteSuccess(null)
    setDeleteError(null)
    setDailyLoading(true)

    const foodName =
      deletingFoodItemInfo.foodItem.name?.th ||
      deletingFoodItemInfo.foodItem.name?.en ||
      'รายการอาหาร'

    const itemId = deletingFoodItemInfo.foodItem._id
    if (!itemId) {
      setDeleteError(
        currentLang === 'th'
          ? 'ไม่พบ ID ของรายการอาหาร'
          : 'Food item ID not found',
      )
      setDailyLoading(false)
      return
    }

    deleteFoodItem(deletingFoodItemInfo.mealId, itemId, userId, idToken)
      .then(async (success) => {
        console.log('[Delete] Food item deleted successfully')
        handleCloseConfirmDeleteModalHandler()

        if (success) {
          // ✅ เพิ่มการ refresh ข้อมูลใหม่อีกครั้งเพื่อให้แน่ใจว่า UI จะอัพเดท
          console.log(
            '[Delete] Refreshing daily data after successful deletion...',
          )
          try {
            await handleFetchDailyReportHandler(selectedDate, userId, idToken)
            console.log('[Delete] ✅ Daily data refreshed successfully')

            // ✅ แสดง success message
            setDeleteSuccess(
              currentLang === 'th'
                ? `ลบ "${foodName}" เรียบร้อยแล้ว`
                : `"${foodName}" deleted successfully`,
            )

            // ✅ ซ่อน success message หลัง 3 วินาที
            setTimeout(() => setDeleteSuccess(null), 3000)
          } catch (refreshError) {
            console.error(
              '[Delete] Error refreshing data after deletion:',
              refreshError,
            )
            // แม้ refresh ไม่สำเร็จ แต่การลบสำเร็จแล้ว ดังนั้นยังแสดง success
            setDeleteSuccess(
              currentLang === 'th'
                ? `ลบ "${foodName}" เรียบร้อยแล้ว (กรุณารีเฟรชหน้าเพื่อดูผลล่าสุด)`
                : `"${foodName}" deleted successfully (please refresh to see updates)`,
            )
            setTimeout(() => setDeleteSuccess(null), 5000)
          }

          // ✅ เพิ่ม success feedback
          console.log(`✅ อาหาร "${foodName}" ถูกลบเรียบร้อยแล้ว!`)
        } else {
          // ✅ แสดง error หากการลบไม่สำเร็จ
          setDeleteError(
            currentLang === 'th'
              ? `ไม่สามารถลบ "${foodName}" ได้ กรุณาลองใหม่อีกครั้ง`
              : `Failed to delete "${foodName}". Please try again.`,
          )
          setTimeout(() => setDeleteError(null), 5000)
        }
      })
      .catch((error) => {
        console.error('[Delete] Error deleting food item:', error)
        // ✅ แสดง error message ให้ user เห็น
        const errorMessage = error?.message || error || 'Unknown error'
        setDeleteError(
          currentLang === 'th'
            ? `เกิดข้อผิดพลาดในการลบ "${foodName}": ${errorMessage}`
            : `Error deleting "${foodName}": ${errorMessage}`,
        )
        setTimeout(() => setDeleteError(null), 5000)
        console.error(
          `❌ เกิดข้อผิดพลาดในการลบอาหาร "${foodName}":`,
          errorMessage,
        )
      })
      .finally(() => {
        setDailyLoading(false)
      })
  }, [
    deletingFoodItemInfo,
    deleteFoodItem,
    userId,
    idToken,
    currentLang,
    handleCloseConfirmDeleteModalHandler,
    setDailyLoading,
    handleFetchDailyReportHandler,
    selectedDate,
  ])

  // Handler for input changes in the LIFF form - fix the path issue
  const _handleLiffItemInputChange = useCallback((field: string) => {
    return (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      const value = event.target.value
      setEditingLiffItemData((prevData) => {
        if (!prevData?.food) return prevData

        const parsedValue = field === 'amount' ? parseFloat(value) || 0 : value

        // Simplified structure without nested data.food
        return {
          ...prevData,
          food: {
            ...prevData.food,
            [field]: parsedValue,
          },
        }
      })
    }
  }, [])

  const _handleSaveLiffDataHandler = useCallback(async () => {
    if (!editingLiffItemData || !currentLiffFoodLog || !userId || !idToken) {
      console.error('[LiffForm] Missing required data for saving LIFF data:', {
        editingLiffItemData: !!editingLiffItemData,
        currentLiffFoodLog: !!currentLiffFoodLog,
        userId: !!userId,
        idToken: !!idToken,
      })
      setLiffFormError(
        currentLang === 'th'
          ? 'ข้อมูลไม่ครบถ้วนสำหรับการบันทึก'
          : 'Incomplete data for saving',
      )
      return
    }

    setIsLiffFormLoading(true)
    setLiffFormError(null)

    try {
      console.log('[LiffForm] Saving LIFF data:', editingLiffItemData)
      await updateLiffFoodLog(
        currentLiffFoodLog.id,
        editingLiffItemData,
        userId,
        idToken,
      )
      console.log('[LiffForm] LIFF data saved successfully')
    } catch (err: unknown) {
      console.error('[LiffForm] Error saving LIFF data:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setLiffFormError(
        currentLang === 'th'
          ? `เกิดข้อผิดพลาดในการบันทึก: ${errorMessage}`
          : `Error saving data: ${errorMessage}`,
      )
    } finally {
      setIsLiffFormLoading(false)
    }
  }, [
    editingLiffItemData,
    currentLiffFoodLog,
    updateLiffFoodLog,
    userId,
    idToken,
    currentLang,
  ])

  // ✅ MEMOIZED VALUES - คำนวณค่าที่ใช้ใน render
  const _currentFoodItemForEdit = editingLiffItemData?.food

  const getNestedValue = (
    obj: any,
    path: string,
    defaultValue: any = undefined,
  ) => {
    const keys = path.split('.')
    let current = obj
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        return defaultValue
      }
    }
    return current === null ? defaultValue : current // Treat null as not found for value fields
  }

  // 📊 Smart Hybrid Data Providers
  const effectiveGoals = getEffectiveGoals()

  const dailyInsights = useMemo(() => {
    // Smart hybrid insights generation
    const insights: string[] = []

    // Use effective goals that work in both online and offline modes
    const effectiveGoals = getEffectiveGoals()

    // Calories insights - works in both modes with safe check
    const caloriesConsumed = safeDailyData.calories?.consumed || 0

    const caloriesProgress = effectiveGoals.calories
      ? (caloriesConsumed / effectiveGoals.calories) * 100
      : 0

    if (caloriesProgress < 80) {
      insights.push(
        currentLang === 'th'
          ? `💡 คุณยังทานแคลอรี่ได้อีก ${Math.round(effectiveGoals.calories - caloriesConsumed)} แคลอรี่ เพื่อให้ครบตามเป้าหมาย`
          : `💡 You can still eat ${Math.round(effectiveGoals.calories - caloriesConsumed)} more calories to reach your goal`,
      )
    } else if (caloriesProgress > 110) {
      insights.push(
        currentLang === 'th'
          ? '🚨 คุณทานแคลอรี่เกินเป้าหมายแล้ว ลองเลือกอาหารที่มีแคลอรี่ต่ำกว่า'
          : '🚨 You have exceeded your calorie goal. Try choosing lower-calorie foods',
      )
    }

    // Protein insights with safe check
    const proteinConsumed = safeDailyData.macronutrients?.protein?.consumed || 0
    const proteinProgress = effectiveGoals.protein
      ? (proteinConsumed / effectiveGoals.protein) * 100
      : 0

    if (proteinProgress < 70) {
      insights.push(
        currentLang === 'th'
          ? '🥩 ลองเพิ่มโปรตีนจากไข่ ปลา เนื้อ หรือถั่ว'
          : '🥩 Try adding more protein from eggs, fish, meat, or beans',
      )
    }

    // Carbs insights with safe check
    const carbsConsumed = safeDailyData.macronutrients?.carbs?.consumed || 0
    const carbsProgress = effectiveGoals.carbs
      ? (carbsConsumed / effectiveGoals.carbs) * 100
      : 0

    if (carbsProgress > 120) {
      insights.push(
        currentLang === 'th'
          ? '🍞 คุณทานคาร์โบไฮเดรตเยอะแล้ว ลองเลือกผักและผลไม้แทน'
          : '🍞 You have eaten a lot of carbs. Try choosing vegetables and fruits instead',
      )
    }

    // Water insights (if available) with safe check
    const waterConsumed = safeDailyData.otherNutrients?.water?.consumed || 0
    const waterGoal = effectiveGoals.water || 2000

    if (waterConsumed < waterGoal * 0.6) {
      insights.push(
        currentLang === 'th'
          ? '💧 อย่าลืมดื่มน้ำให้เพียงพอ เป้าหมาย 8-10 แก้วต่อวัน'
          : '💧 Remember to drink enough water. Goal: 8-10 glasses per day',
      )
    }

    // Micronutrient insights with safe checks and proper typing
    const micronutrients: MicronutrientsMap =
      safeDailyData.micronutrients || ({} as MicronutrientsMap)
    const vitaminC = micronutrients['vitamin_c'] // Use bracket notation for safe access

    if (vitaminC && (vitaminC.consumed || 0) < (vitaminC.goal || 90) * 0.5) {
      insights.push(
        currentLang === 'th'
          ? '🍊 ลองเพิ่มวิตามินซีจากส้ม มะนาว หรือผักใบเขียว'
          : '🍊 Try adding vitamin C from oranges, lemons, or leafy greens',
      )
    }

    const calcium = micronutrients['calcium'] // Use bracket notation for safe access
    if (calcium && (calcium.consumed || 0) < (calcium.goal || 1000) * 0.5) {
      insights.push(
        currentLang === 'th'
          ? '🥛 คุณควรเพิ่มแคลเซียมจากนม โยเกิร์ต หรือผักใบเขียวเข้ม'
          : '🥛 You should add calcium from milk, yogurt, or dark leafy greens',
      )
    }

    // Fiber insights with safe check
    const fiber = safeDailyData.otherNutrients?.fiber
    if (fiber && fiber.consumed < (fiber.goal || 25) * 0.6) {
      insights.push(
        currentLang === 'th'
          ? '🌾 ลองเพิ่มไฟเบอร์จากผัก ผลไม้ และธัญพืชเต็มเมล็ด'
          : '🌾 Try adding fiber from vegetables, fruits, and whole grains',
      )
    }

    // General encouragement based on overall progress
    const overallProgress = (caloriesProgress + proteinProgress) / 2
    if (overallProgress > 80 && overallProgress < 110) {
      insights.push(
        currentLang === 'th'
          ? '✨ คุณกำลังทำได้ดีมาก! รักษาจังหวะนี้ต่อไป'
          : '✨ You are doing great! Keep up this pace',
      )
    }

    // Add a motivational insight
    insights.push(
      currentLang === 'th'
        ? '🎯 การติดตามอาหารเป็นขั้นตอนสำคัญในการดูแลสุขภาพ'
        : '🎯 Food tracking is an important step in health management',
    )

    return insights
  }, [safeDailyData, getEffectiveGoals, currentLang])

  const randomInsight = useMemo(
    () => dailyInsights[Math.floor(Math.random() * dailyInsights.length)],
    [dailyInsights],
  )

  // Move initializeLiffForm and its related useEffect HERE (before interface definitions)
  const initializeLiffForm = useCallback(async () => {
    if (liffReady && userId && idToken) {
      if (urlParams.logId && typeof urlParams.logId === 'string') {
        // Ensure logId is a string
        console.log(
          `[LiffForm] Initializing with logId: ${urlParams.logId}, userId: ${userId}`,
        )
        await fetchLiffData(urlParams.logId, userId, idToken)
      } else if (!urlParams.logId) {
        console.log('[LiffForm] No logId found, preparing for new entry.')
        const newLiffLog: LiffFoodLogData = {
          id: `temp-${Date.now()}`, // Changed _id to id
          userId: userId,
          date: format(new Date(), 'yyyy-MM-dd'),
          logDate: format(new Date(), 'yyyy-MM-dd'),
          mealType: 'snack',
          meals: [],
          totalNutrition: {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          },
          food: {
            foodName: { th: '', en: '' },
            amount: 0,
            unit: '',
            nutrition: {
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
            },
          },
          imageUrl: undefined,
          source: undefined, // Initialize source
          metadata: { notes: undefined }, // Initialize metadata with notes
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        setCurrentLiffFoodLog(newLiffLog)
      } else if (liffError) {
        setLiffFormError(
          currentLang === 'th'
            ? `LIFF Error: ${liffError}`
            : `LIFF Error: ${liffError}`,
        )
      }
    }
  }, [
    liffReady,
    userId,
    idToken,
    urlParams.logId,
    fetchLiffData,
    setCurrentLiffFoodLog,
    liffError,
    currentLang,
  ])

  useEffect(() => {
    const initialize = async () => {
      if (urlParams.isDailyReportView && liffReady && userId && idToken) {
        await handleFetchDailyReportHandler(selectedDate, userId, idToken)
      } else if (urlParams.isLiffFormView) {
        await initializeLiffForm()
      }
    }
    initialize().catch((err: unknown) => {
      console.error('Error during initialization:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (urlParams.isDailyReportView) {
        // No additional error handling needed for daily report view
      } else if (urlParams.isLiffFormView) {
        setLiffFormError(
          currentLang === 'th'
            ? `ข้อผิดพลาดในการเริ่มต้น: ${errorMessage}`
            : `Initialization error: ${errorMessage}`,
        )
      }
    })
  }, [
    urlParams.isDailyReportView,
    liffReady,
    userId,
    idToken,
    selectedDate,
    handleFetchDailyReportHandler,
    initializeLiffForm,
    urlParams.isLiffFormView,
    currentLang,
  ])

  // Type definitions for nutrition data (can be moved to a types file)
  interface _NutrientDetail {
    consumed: number // Changed from value to consumed for clarity
    unit: string
    goal?: number // Goal is optional
    dv?: number // DV is also optional and might not apply to all nutrients here
  }

  interface _UIMacronutrients {
    calories: _NutrientDetail
    protein: _NutrientDetail
    carbohydrates: _NutrientDetail
    fat: _NutrientDetail
  }

  interface _UIMicronutrients {
    [key: string]: _NutrientDetail | undefined
    // Ensure all keys from micronutrientsSummary are listed here for type safety if needed,
    // or rely on [key: string] for flexibility if new nutrients are added dynamically.
    // For now, explicitly adding to ensure they are picked up by intellisense/type checking.
    fiber?: _NutrientDetail
    sugar?: _NutrientDetail
    sodium?: _NutrientDetail
    cholesterol?: _NutrientDetail
    saturated_fat?: _NutrientDetail
    trans_fat?: _NutrientDetail
    polyunsaturated_fat?: _NutrientDetail
    monounsaturated_fat?: _NutrientDetail
    omega3?: _NutrientDetail
    water?: _NutrientDetail
    potassium_nutrient?: _NutrientDetail
    caffeine?: _NutrientDetail // Added caffeine
    alcohol?: _NutrientDetail // Added alcohol
  }

  // Function to handle adding a new item in the LIFF form
  const _handleAddLiffItem = () => {
    console.log('handleAddLiffItem: Resetting/Preparing for new LIFF entry.')
    if (userId) {
      const newLiffLog: LiffFoodLogData = {
        id: `temp-${Date.now()}`, // Changed _id to id
        userId: userId,
        date: format(new Date(), 'yyyy-MM-dd'),
        logDate: format(new Date(), 'yyyy-MM-dd'),
        mealType: 'snack',
        meals: [],
        totalNutrition: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
        food: {
          foodName: { th: '', en: '' },
          amount: 0,
          unit: '',
          nutrition: {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          },
        },
        imageUrl: undefined,
        source: undefined, // Initialize source
        metadata: { notes: undefined }, // Initialize metadata with notes
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setCurrentLiffFoodLog(newLiffLog)
    } else {
      console.error('handleAddLiffItem: userId is not available.')
    }
  }

  // Optimize meal calculations with memoization
  const optimizedMealsData = useMemo(() => {
    return safeDailyData.meals.map((meal, mealIndex) => {
      const mealProtein = meal.foodItems.reduce(
        (sum, item) => sum + (item.nutrition?.protein || 0),
        0,
      )
      const mealCarbs = meal.foodItems.reduce(
        (sum, item) => sum + (item.nutrition?.carbs || 0),
        0,
      )
      const mealFat = meal.foodItems.reduce(
        (sum, item) => sum + (item.nutrition?.fat || 0),
        0,
      )
      const mealEmoji = MEAL_EMOJIS[meal.name || 'other'] || '🍽️'

      return {
        ...meal,
        mealIndex,
        mealProtein,
        mealCarbs,
        mealFat,
        mealEmoji,
      }
    })
  }, [safeDailyData.meals, MEAL_EMOJIS])

  // Optimized Chart Components with Suspense wrapper
  const ChartWrapper: React.FC<{
    children: React.ReactNode
    fallback?: React.ReactNode
  }> = ({
    children,
    fallback = (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height={280}
      >
        <CircularProgress />
      </Box>
    ),
  }) => <Suspense fallback={fallback}>{children}</Suspense>

  // Next.js Performance Monitoring
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Monitor performance metrics
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          // Log critical rendering metrics
          if (entry.entryType === 'navigation') {
            console.log('[Performance] Page Load Time:', entry.duration)
          }
          if (entry.entryType === 'largest-contentful-paint') {
            console.log('[Performance] LCP:', entry.startTime)
          }
        })
      })

      try {
        observer.observe({
          entryTypes: ['navigation', 'largest-contentful-paint'],
        })
      } catch (e) {
        // Performance monitoring not supported
      }

      return () => {
        observer.disconnect()
      }
    }
  }, [])

  // Prefetch critical data using Next.js patterns
  useEffect(() => {
    if (liffReady && userId && idToken) {
      // Prefetch tomorrow's data for better UX
      const tomorrow = format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd')
      if (tomorrow <= format(new Date(), 'yyyy-MM-dd')) {
        // Only prefetch if tomorrow is not in the future
        setTimeout(() => {
          handleFetchDailyReportHandler(tomorrow, userId, idToken).catch(() => {
            // Silent fail for prefetch
          })
        }, 2000) // Prefetch after 2 seconds
      }
    }
  }, [selectedDate, liffReady, userId, idToken, handleFetchDailyReportHandler])

  // ✅ Effect to fetch data when date, userId, or idToken changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const fetchData = async () => {
      if (!selectedDate || !userId || !idToken) {
        console.log('[DailyReportView] Missing required data:', {
          selectedDate,
          userId,
          idToken: !!idToken,
        })
        return
      }

      // ✅ เพิ่ม debounce เพื่อป้องกัน rapid calls
      timeoutId = setTimeout(async () => {
        console.log(`[DailyReportView] Fetching data for date: ${selectedDate}`)

        try {
          await handleFetchDailyReportHandler(selectedDate, userId, idToken)
        } catch (error) {
          console.error('[DailyReportView] Error fetching daily report:', error)
        }
      }, 300) // 300ms debounce
    }

    fetchData()

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [selectedDate, userId, idToken, handleFetchDailyReportHandler])

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      {/* 🚀 Smart Hybrid Status Indicator */}
      {isUsingFallback && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            🧮 กำลังใช้การคำนวณแบบออฟไลน์
            เนื่องจากไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
            เป้าหมายแคลอรี่: {effectiveGoals.calories} kcal
          </Typography>
        </Alert>
      )}

      {/* Error state with fallback suggestion */}
      {dailyError && !isUsingFallback && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">ไม่สามารถโหลดข้อมูลได้</Typography>
          <Typography>{dailyError}</Typography>
          {userProfile && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              💡 เคล็ดลับ: ระบบจะพยายามใช้การคำนวณแบบออฟไลน์หากมีข้อมูลโปรไฟล์
              <br />
              เป้าหมายแคลอรี่จากการคำนวณ: {effectiveGoals.calories} kcal
            </Typography>
          )}
        </Alert>
      )}

      <DateSelector
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        currentLang={currentLang}
      />

      {/* ✅ Delete Success/Error Messages */}
      {deleteSuccess && (
        <Fade in={!!deleteSuccess} timeout={500}>
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">{deleteSuccess}</Typography>
          </Alert>
        </Fade>
      )}

      {deleteError && (
        <Fade in={!!deleteError} timeout={500}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">{deleteError}</Typography>
          </Alert>
        </Fade>
      )}

      <Fade in={contentLoaded} timeout={500}>
        <Paper elevation={1} sx={{ p: 2, mb: 2, backgroundColor: '#e3f2fd' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            {currentLang === 'th' ? '💡 คำแนะนำสำหรับคุณ' : '💡 Tip for You'}
          </Typography>
          <Typography variant="body2">{randomInsight}</Typography>
        </Paper>
      </Fade>

      <Fade in={contentLoaded} timeout={800}>
        <Paper
          elevation={2}
          sx={{ p: 2, mb: 2, boxShadow: '0px 2px 8px rgba(0,0,0,0.08)' }}
        >
          <Typography variant="h6" gutterBottom textAlign="center">
            {currentLang === 'th'
              ? 'สัดส่วนสารอาหารของวันนี้'
              : "Today's Macronutrient Ratio"}
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <ChartWrapper>
                <NutritionPieChart
                  data={macroPieData}
                  centerLabel={`${caloriesConsumed} / ${caloriesGoal}\nKCAL`}
                />
              </ChartWrapper>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {currentLang === 'th' ? 'โปรตีน' : 'Protein'}
                </Typography>
                <LinearProgressWithLabel
                  _value={
                    safeDailyData.macronutrients.protein.goal && // Check goal exists
                    safeDailyData.macronutrients.protein.goal > 0
                      ? (safeDailyData.macronutrients.protein.consumed /
                          (safeDailyData.macronutrients.protein.goal || 1)) *
                        100
                      : 0
                  }
                  consumed={safeDailyData.macronutrients.protein.consumed}
                  goal={safeDailyData.macronutrients.protein.goal || 0} // Fallback to 0 if undefined
                  unit="g"
                />
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                  {currentLang === 'th' ? 'คาร์โบไฮเดรต' : 'Carbohydrates'}
                </Typography>
                <LinearProgressWithLabel
                  _value={
                    safeDailyData.macronutrients.carbs.goal && // Check goal exists
                    safeDailyData.macronutrients.carbs.goal > 0
                      ? (safeDailyData.macronutrients.carbs.consumed /
                          (safeDailyData.macronutrients.carbs.goal || 1)) *
                        100
                      : 0
                  }
                  consumed={safeDailyData.macronutrients.carbs.consumed}
                  goal={safeDailyData.macronutrients.carbs.goal || 0} // Fallback to 0 if undefined
                  unit="g"
                />
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                  {currentLang === 'th' ? 'ไขมัน' : 'Fat'}
                </Typography>
                <LinearProgressWithLabel
                  _value={
                    safeDailyData.macronutrients.fat.goal && // Check goal exists
                    safeDailyData.macronutrients.fat.goal > 0
                      ? (safeDailyData.macronutrients.fat.consumed /
                          (safeDailyData.macronutrients.fat.goal || 1)) *
                        100
                      : 0
                  }
                  consumed={safeDailyData.macronutrients.fat.consumed}
                  goal={safeDailyData.macronutrients.fat.goal || 0} // Fallback to 0 if undefined
                  unit="g"
                />
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Fade>

      <Fade in={contentLoaded} timeout={1000}>
        <Paper
          elevation={2}
          sx={{
            p: 2,
            mb: 2,
            boxShadow: '0px 2px 8px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            '& .recharts-wrapper': {
              // Make chart responsive on mobile
              maxWidth: '100%',
              margin: '0 auto',
            },
          }}
        >
          <Typography variant="h6" gutterBottom>
            {currentLang === 'th' ? 'แคลอรี่ตามมื้ออาหาร' : 'Calories by Meal'}
          </Typography>
          <Box sx={{ height: 300 }}>
            <ChartWrapper>
              <MealCaloriesChart data={mealCaloriesData} />
            </ChartWrapper>
          </Box>
        </Paper>
      </Fade>

      <Fade in={contentLoaded} timeout={1100}>
        <Accordion
          expanded={expandedOtherNutrients}
          onChange={handleAccordionChangeHandler('otherNutrients')}
          sx={{
            mb: 2,
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
            borderRadius: 1,
            '&.Mui-expanded': {
              boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
            },
            '&:before': {
              display: 'none', // Remove default divider
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="other-nutrients-content"
            id="other-nutrients-header"
          >
            <Typography variant="h6">
              {currentLang === 'th' ? 'สารอาหารอื่นๆ' : 'Other Nutrients'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              {/* Fiber */}
              <Typography variant="subtitle2" gutterBottom>
                {currentLang === 'th' ? 'ใยอาหาร (Fiber)' : 'Fiber'}
              </Typography>
              <LinearProgressWithLabel
                _value={
                  micronutrientsSummary.fiber?.goal
                    ? (micronutrientsSummary.fiber.consumed /
                        micronutrientsSummary.fiber.goal) *
                      100
                    : 0
                }
                consumed={micronutrientsSummary.fiber?.consumed ?? 0}
                goal={micronutrientsSummary.fiber?.goal ?? 0}
                unit={micronutrientsSummary.fiber?.unit || 'g'}
              />
              {/* End Fiber */}

              {/* Sugar */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'น้ำตาล (Sugar)' : 'Sugar'}
              </Typography>
              <LinearProgressWithLabel
                _value={
                  micronutrientsSummary.sugar?.goal
                    ? (micronutrientsSummary.sugar.consumed /
                        micronutrientsSummary.sugar.goal) *
                      100
                    : 0
                }
                consumed={micronutrientsSummary.sugar?.consumed ?? 0}
                goal={micronutrientsSummary.sugar?.goal ?? 0}
                unit={micronutrientsSummary.sugar?.unit || 'g'}
              />
              {/* End Sugar */}

              {/* Sodium */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'โซเดียม (Sodium)' : 'Sodium'}
              </Typography>
              <LinearProgressWithLabel
                _value={
                  micronutrientsSummary.sodium?.goal
                    ? (micronutrientsSummary.sodium.consumed /
                        micronutrientsSummary.sodium.goal) *
                      100
                    : 0
                }
                consumed={micronutrientsSummary.sodium?.consumed ?? 0}
                goal={micronutrientsSummary.sodium?.goal ?? 0}
                unit={micronutrientsSummary.sodium?.unit || 'mg'}
              />
              {/* End Sodium */}

              {/* Cholesterol */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'คอเลสเตอรอล' : 'Cholesterol'}
              </Typography>
              <LinearProgressWithLabel
                _value={
                  micronutrientsSummary.cholesterol?.goal
                    ? (micronutrientsSummary.cholesterol.consumed /
                        micronutrientsSummary.cholesterol.goal) *
                      100
                    : 0
                }
                consumed={micronutrientsSummary.cholesterol?.consumed ?? 0}
                goal={micronutrientsSummary.cholesterol?.goal ?? 0}
                unit={micronutrientsSummary.cholesterol?.unit || 'mg'}
              />
              {/* End Cholesterol */}

              {/* Saturated Fat */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'ไขมันอิ่มตัว' : 'Saturated Fat'}
              </Typography>
              <LinearProgressWithLabel
                _value={
                  micronutrientsSummary.saturated_fat?.goal
                    ? (micronutrientsSummary.saturated_fat.consumed /
                        micronutrientsSummary.saturated_fat.goal) *
                      100
                    : 0
                }
                consumed={micronutrientsSummary.saturated_fat?.consumed ?? 0}
                goal={micronutrientsSummary.saturated_fat?.goal ?? 0}
                unit={micronutrientsSummary.saturated_fat?.unit || 'g'}
              />
              {/* End Saturated Fat */}

              {/* Trans Fat */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'ไขมันทรานส์' : 'Trans Fat'}
              </Typography>
              <LinearProgressWithLabel
                _value={
                  micronutrientsSummary.trans_fat?.goal !== undefined &&
                  micronutrientsSummary.trans_fat.goal > 0
                    ? (micronutrientsSummary.trans_fat.consumed /
                        micronutrientsSummary.trans_fat.goal) *
                      100
                    : (micronutrientsSummary.trans_fat?.consumed ?? 0 > 0) // use ?? 0 to avoid undefined error
                      ? 100
                      : 0 // Show 100% if any trans fat consumed (goal is 0)
                }
                consumed={micronutrientsSummary.trans_fat?.consumed ?? 0}
                goal={micronutrientsSummary.trans_fat?.goal ?? 0}
                unit={micronutrientsSummary.trans_fat?.unit || 'g'}
              />
              {/* End Trans Fat */}

              {/* Polyunsaturated Fat */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th'
                  ? 'ไขมันไม่อิ่มตัวหลายพันธะ'
                  : 'Polyunsaturated Fat'}
              </Typography>
              <LinearProgressWithLabel
                _value={
                  micronutrientsSummary.polyunsaturated_fat?.goal
                    ? (micronutrientsSummary.polyunsaturated_fat.consumed /
                        micronutrientsSummary.polyunsaturated_fat.goal) *
                      100
                    : 0
                }
                consumed={
                  micronutrientsSummary.polyunsaturated_fat?.consumed ?? 0
                }
                goal={micronutrientsSummary.polyunsaturated_fat?.goal ?? 0}
                unit={micronutrientsSummary.polyunsaturated_fat?.unit || 'g'}
              />
              {/* End Polyunsaturated Fat */}

              {/* Monounsaturated Fat */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th'
                  ? 'ไขมันไม่อิ่มตัวเดี่ยว'
                  : 'Monounsaturated Fat'}
              </Typography>
              <LinearProgressWithLabel
                _value={
                  micronutrientsSummary.monounsaturated_fat?.goal
                    ? (micronutrientsSummary.monounsaturated_fat.consumed /
                        micronutrientsSummary.monounsaturated_fat.goal) *
                      100
                    : 0
                }
                consumed={
                  micronutrientsSummary.monounsaturated_fat?.consumed ?? 0
                }
                goal={micronutrientsSummary.monounsaturated_fat?.goal ?? 0}
                unit={micronutrientsSummary.monounsaturated_fat?.unit || 'g'}
              />
              {/* End Monounsaturated Fat */}

              {/* Omega-3 */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'โอเมก้า 3' : 'Omega-3'}
              </Typography>
              <LinearProgressWithLabel
                _value={
                  micronutrientsSummary.omega3?.goal
                    ? (micronutrientsSummary.omega3.consumed /
                        micronutrientsSummary.omega3.goal) *
                      100
                    : 0
                }
                consumed={micronutrientsSummary.omega3?.consumed ?? 0}
                goal={micronutrientsSummary.omega3?.goal ?? 0}
                unit={micronutrientsSummary.omega3?.unit || 'g'}
              />
              {/* End Omega-3 */}

              {/* Water */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'น้ำ' : 'Water'}
              </Typography>
              <LinearProgressWithLabel
                _value={
                  micronutrientsSummary.water?.goal
                    ? (micronutrientsSummary.water.consumed /
                        micronutrientsSummary.water.goal) *
                      100
                    : 0
                }
                consumed={micronutrientsSummary.water?.consumed ?? 0}
                goal={micronutrientsSummary.water?.goal ?? 0}
                unit={micronutrientsSummary.water?.unit || 'ml'}
              />
              {/* End Water */}

              {/* Potassium from otherNutrients */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'โพแทสเซียม' : 'Potassium'}
              </Typography>
              <LinearProgressWithLabel
                _value={
                  micronutrientsSummary.potassium_nutrient && // Check if object exists
                  micronutrientsSummary.potassium_nutrient.goal &&
                  micronutrientsSummary.potassium_nutrient.goal > 0
                    ? (micronutrientsSummary.potassium_nutrient.consumed / // Now safe to access
                        micronutrientsSummary.potassium_nutrient.goal) *
                      100
                    : micronutrientsSummary.potassium_nutrient && // Check again for the else-if part
                        micronutrientsSummary.potassium_nutrient.consumed > 0
                      ? 100
                      : 0
                }
                consumed={
                  micronutrientsSummary.potassium_nutrient?.consumed ?? 0
                }
                goal={micronutrientsSummary.potassium_nutrient?.goal ?? 0}
                unit={micronutrientsSummary.potassium_nutrient?.unit || 'mg'}
              />
              {/* End Potassium */}

              {/* Caffeine */}
              {micronutrientsSummary.caffeine && ( // Conditionally render if caffeine data exists
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                    {currentLang === 'th' ? 'คาเฟอีน' : 'Caffeine'}
                  </Typography>
                  <LinearProgressWithLabel
                    _value={
                      micronutrientsSummary.caffeine?.goal &&
                      micronutrientsSummary.caffeine.goal > 0
                        ? (micronutrientsSummary.caffeine.consumed /
                            micronutrientsSummary.caffeine.goal) *
                          100
                        : micronutrientsSummary.caffeine?.consumed > 0
                          ? 100 // If consumed > 0 and no goal or goal is 0, show as 100% of a "limit"
                          : 0
                    }
                    consumed={micronutrientsSummary.caffeine.consumed}
                    goal={micronutrientsSummary.caffeine.goal ?? 0}
                    unit={micronutrientsSummary.caffeine.unit || 'mg'}
                  />
                </>
              )}
              {/* End Caffeine */}

              {/* Alcohol */}
              {micronutrientsSummary.alcohol &&
                micronutrientsSummary.alcohol.consumed > 0 && ( // Conditionally render if alcohol consumed > 0
                  <>
                    <Typography
                      variant="subtitle2"
                      gutterBottom
                      sx={{ mt: 1.5 }}
                    >
                      {currentLang === 'th' ? 'แอลกอฮอล์' : 'Alcohol'}
                    </Typography>
                    <LinearProgressWithLabel
                      _value={
                        micronutrientsSummary.alcohol?.goal &&
                        micronutrientsSummary.alcohol.goal > 0
                          ? (micronutrientsSummary.alcohol.consumed / // Should generally be 0 or low
                              micronutrientsSummary.alcohol.goal) *
                            100
                          : micronutrientsSummary.alcohol.consumed > 0 // If consumed > 0, show as 100% (implies over limit if goal is 0)
                            ? 100
                            : 0
                      }
                      consumed={micronutrientsSummary.alcohol.consumed}
                      goal={micronutrientsSummary.alcohol.goal ?? 0} // Goal for alcohol is often 0 or not set
                      unit={micronutrientsSummary.alcohol.unit || 'g'}
                    />
                  </>
                )}
              {/* End Alcohol */}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Fade>

      <Fade in={contentLoaded} timeout={1200}>
        <Accordion
          expanded={expandedMicronutrients}
          onChange={handleAccordionChangeHandler('micronutrients')}
          sx={{
            mb: 3,
            boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
            borderRadius: 1,
            '&.Mui-expanded': {
              boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
            },
            '&:before': {
              display: 'none', // Remove default divider
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="micronutrients-content"
            id="micronutrients-header"
          >
            <Typography variant="h6">
              {currentLang === 'th'
                ? 'วิตามินและแร่ธาตุ'
                : 'Vitamins & Minerals'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={1}>
              {safeDailyData.micronutrients &&
              Object.keys(safeDailyData.micronutrients).length > 0 ? (
                Object.entries(safeDailyData.micronutrients)
                  .filter(([key]) => {
                    // Filter out keys that are already displayed in "Other Nutrients" or are primary macros
                    const otherNutrientKeys = [
                      'fiber',
                      'sugar',
                      'sodium',
                      'cholesterol',
                      'saturated_fat',
                      'omega3',
                      'water',
                    ]
                    const macroKeys = ['calories', 'protein', 'carbs', 'fat']
                    return (
                      !otherNutrientKeys.includes(key.toLowerCase()) &&
                      !macroKeys.includes(key.toLowerCase())
                    )
                  })
                  .map(
                    ([key, nutrientData]: [
                      string,
                      {
                        value: number
                        unit: string
                        dv?: number
                        goal?: number
                      }, // Adjusted type to include optional goal
                    ]) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={key}>
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="body2">
                            {key.charAt(0).toUpperCase() +
                              key.slice(1).replace(/_/g, ' ')}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={
                              nutrientData.dv
                                ? nutrientData.dv // Use DV if available
                                : nutrientData.goal && nutrientData.goal > 0
                                  ? (nutrientData.value / nutrientData.goal) *
                                    100 // Use goal if DV not available
                                  : nutrientData.value > 0
                                    ? 50
                                    : 0 // Fallback if no DV or goal
                            }
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              mt: 0.5,
                              '& .MuiLinearProgress-bar': {
                                transition: 'transform 1.2s ease-in-out',
                              },
                            }}
                            color={
                              (nutrientData.dv && nutrientData.dv >= 100) ||
                              (nutrientData.goal &&
                                nutrientData.goal > 0 &&
                                nutrientData.value >= nutrientData.goal)
                                ? 'success'
                                : (nutrientData.dv && nutrientData.dv >= 70) ||
                                    (nutrientData.goal &&
                                      nutrientData.value >=
                                        nutrientData.goal * 0.7)
                                  ? 'warning'
                                  : 'error'
                            }
                          />
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Typography variant="caption">
                              {`${nutrientData.value}${nutrientData.unit}`}
                            </Typography>
                            {nutrientData.dv !== undefined ? (
                              <Typography variant="caption">
                                {`${nutrientData.dv}% DV`}
                              </Typography>
                            ) : nutrientData.goal !== undefined ? (
                              <Typography variant="caption">
                                {`${currentLang === 'th' ? 'เป้าหมาย' : 'Goal'}: ${nutrientData.goal}${nutrientData.unit}`}
                              </Typography>
                            ) : null}
                          </Box>
                        </Box>
                      </Grid>
                    ),
                  )
              ) : (
                <Grid size={{ xs: 12 }} sx={{ textAlign: 'center', p: 2 }}>
                  <Typography>
                    {currentLang === 'th'
                      ? 'ไม่พบข้อมูลวิตามินและแร่ธาตุ'
                      : 'No vitamin and mineral data found.'}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Fade>

      <Fade in={contentLoaded} timeout={1300}>
        <div>
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            {currentLang === 'th' ? 'รายละเอียดมื้ออาหาร' : 'Meal Details'}
          </Typography>
          {safeDailyData.meals.length === 0 ? (
            <Grow in timeout={500}>
              <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                <Typography>
                  {currentLang === 'th'
                    ? 'ไม่พบรายการอาหารสำหรับวันนี้'
                    : 'No food items logged for today.'}
                </Typography>
              </Paper>
            </Grow>
          ) : (
            optimizedMealsData.map((mealData) => {
              return (
                <Grow
                  in={contentLoaded}
                  timeout={(mealData.mealIndex + 1) * 200}
                  key={mealData.id || `meal-${mealData.mealIndex}`}
                >
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      mb: 2,
                      borderRadius: '8px',
                      transition: 'all 0.3s ease-in-out',
                      '&:hover': {
                        boxShadow: '0px 4px 12px rgba(0,0,0,0.12)',
                      },
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      {`${mealData.mealEmoji} ${mealData.name} - ${mealData.totalCalories} kcal`}
                    </Typography>
                    {mealData.foodItems.map((item, itemIndex) => (
                      <div key={item._id || `item-${itemIndex}`}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            py: 1,
                            borderBottom: '1px solid #eee',
                            gap: 2,
                          }}
                        >
                          {/* เพิ่มส่วนแสดงภาพอาหาร - ใช้ Next.js Image สำหรับ optimization */}
                          <Box sx={{ flexShrink: 0, position: 'relative' }}>
                            {'imageUrl' in item && item.imageUrl ? (
                              <Image
                                src={item.imageUrl as string}
                                alt={item.name.th || 'อาหาร'}
                                width={60}
                                height={60}
                                style={{
                                  borderRadius: '8px',
                                  objectFit: 'cover',
                                  border: '2px solid #e0e0e0',
                                }}
                                onError={(e) => {
                                  // ถ้าโหลดภาพไม่ได้ให้แสดง placeholder
                                  console.warn(
                                    'Failed to load image:',
                                    item.imageUrl,
                                  )
                                  e.currentTarget.style.display = 'none'
                                  const placeholder = e.currentTarget
                                    .nextElementSibling as HTMLElement
                                  if (placeholder) {
                                    placeholder.style.display = 'flex'
                                  }
                                }}
                                onLoadingComplete={() => {
                                  // ซ่อน placeholder เมื่อโหลดภาพสำเร็จ
                                  const target = document.querySelector(
                                    `[data-food-placeholder="${item.name.th}"]`,
                                  ) as HTMLElement
                                  if (target) {
                                    target.style.display = 'none'
                                  }
                                }}
                                placeholder="blur"
                                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                                priority={false}
                                loading="lazy"
                                sizes="60px"
                                unoptimized={
                                  process.env.NODE_ENV === 'development'
                                }
                              />
                            ) : null}
                            {/* Placeholder สำหรับกรณีไม่มีภาพ */}
                            <Box
                              data-food-placeholder={item.name.th}
                              sx={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '8px',
                                border: '2px dashed #ccc',
                                display:
                                  'imageUrl' in item && item.imageUrl
                                    ? 'none'
                                    : 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'grey.100',
                                fontSize: '24px',
                              }}
                            >
                              🍽️
                            </Box>
                          </Box>

                          <Box sx={{ flex: 1 }}>
                            <Typography
                              variant="body1"
                              sx={{ fontWeight: '500' }}
                            >
                              {item.name.th}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {item.serving?.size || ''}{' '}
                              {item.serving?.unit || ''} -
                              {item.nutrition?.calories || 0} kcal
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {currentLang === 'th'
                                ? `โปรตีน: ${item.nutrition?.protein || 0}g, คาร์โบไฮเดรต: ${item.nutrition?.carbs || 0}g, ไขมัน: ${item.nutrition?.fat || 0}g`
                                : `Protein: ${item.nutrition?.protein || 0}g, Carbs: ${item.nutrition?.carbs || 0}g, Fat: ${item.nutrition?.fat || 0}g`}
                            </Typography>
                          </Box>
                          <Box sx={{ flexShrink: 0 }}>
                            <IconButton
                              size="small"
                              onClick={() =>
                                handleOpenEditModalHandler(
                                  mealData.id || '',
                                  item,
                                )
                              }
                              sx={{
                                mr: 0.5,
                                '&:hover': {
                                  backgroundColor: 'primary.light',
                                  color: 'white',
                                },
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() =>
                                handleOpenConfirmDeleteModalHandler(
                                  mealData.id || '',
                                  item,
                                )
                              }
                              sx={{
                                '&:hover': {
                                  backgroundColor: 'error.light',
                                  color: 'white',
                                },
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        {itemIndex < mealData.foodItems.length - 1 && (
                          <Divider light />
                        )}
                      </div>
                    ))}
                    {mealData.foodItems.length > 0 && (
                      <Divider sx={{ my: 1.5 }} />
                    )}
                    <Box
                      sx={{
                        mt: mealData.foodItems.length > 0 ? 1.5 : 0,
                        textAlign: 'right',
                      }}
                    >
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontWeight: 'medium' }}
                      >
                        {currentLang === 'th'
                          ? 'รวมสารอาหารมื้อนี้:'
                          : 'Meal Totals:'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {currentLang === 'th'
                          ? `โปรตีน: ${mealData.mealProtein}g, คาร์โบไฮเดรต: ${mealData.mealCarbs}g, ไขมัน: ${mealData.mealFat}g`
                          : `Protein: ${mealData.mealProtein}g, Carbs: ${mealData.mealCarbs}g, Fat: ${mealData.mealFat}g`}
                      </Typography>
                    </Box>
                  </Paper>
                </Grow>
              )
            })
          )}
        </div>
      </Fade>

      {/* ส่วนของ Modal ต่างๆ */}
      {/* Edit Food Item Modal */}
      <Modal
        open={editModalOpen}
        onClose={handleCloseEditModalHandler}
        aria-labelledby="edit-food-item-title"
      >
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '95%', sm: 500, md: 700 }, // Adjusted width for more content
            maxHeight: '90vh', // Added maxHeight
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: { xs: 2, sm: 3 },
            borderRadius: 2,
            display: 'flex', // Added for flex layout
            flexDirection: 'column', // Added for flex layout
          }}
        >
          <DialogTitle sx={{ p: 0, mb: 2 }}>
            {' '}
            {/* Adjusted padding */}
            {currentLang === 'th' ? 'แก้ไขรายการอาหาร' : 'Edit Food Item'}
          </DialogTitle>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              aria-label="edit food item tabs"
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab
                label={
                  currentLang === 'th' ? 'ทั่วไป & มาโคร' : 'General & Macros'
                }
                id="edit-food-tab-0"
                aria-controls="edit-food-tabpanel-0"
              />
              <Tab
                label={
                  currentLang === 'th'
                    ? 'วิตามิน & แร่ธาตุ'
                    : 'Vitamins & Minerals'
                }
                id="edit-food-tab-1"
                aria-controls="edit-food-tabpanel-1"
              />
              {/* Add more tabs here if needed, e.g., "Other Nutrients" */}
            </Tabs>
          </Box>

          {editingFoodItem && (
            <>
              <TabPanel value={activeTab} index={0}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={
                        currentLang === 'th'
                          ? 'ชื่ออาหาร (ไทย)'
                          : 'Food Name (Thai)'
                      }
                      name="name.th"
                      fullWidth
                      variant="outlined"
                      value={getNestedValue(
                        editedFields,
                        'name.th',
                        editingFoodItem.name?.th || '',
                      )}
                      onChange={handleEditFieldChangeHandler}
                      size="small"
                      margin="normal"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={
                        currentLang === 'th'
                          ? 'ชื่ออาหาร (อังกฤษ)'
                          : 'Food Name (English)'
                      }
                      name="name.en"
                      fullWidth
                      variant="outlined"
                      value={getNestedValue(
                        editedFields,
                        'name.en',
                        editingFoodItem.name?.en || '',
                      )}
                      onChange={handleEditFieldChangeHandler}
                      size="small"
                      margin="normal"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <NutrientTextField
                      label={
                        currentLang === 'th' ? 'ขนาดรับประทาน' : 'Serving Size'
                      }
                      name="serving.size"
                      value={getNestedValue(
                        editedFields,
                        'serving.size',
                        editingFoodItem.serving?.size,
                      )}
                      onChange={handleEditFieldChangeHandler}
                      // unit={getNestedValue(editedFields, 'serving.unit', editingFoodItem.serving?.unit || '')} // Unit is a separate field
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={
                        currentLang === 'th'
                          ? 'หน่วย (เช่น จาน, กรัม)'
                          : 'Unit (e.g., plate, g)'
                      }
                      name="serving.unit"
                      value={getNestedValue(
                        editedFields,
                        'serving.unit',
                        editingFoodItem.serving?.unit || '',
                      )}
                      onChange={handleEditFieldChangeHandler}
                      fullWidth
                      variant="outlined"
                      size="small"
                      margin="normal"
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    {' '}
                    <Divider sx={{ my: 1 }} />{' '}
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <NutrientTextField
                      label={currentLang === 'th' ? 'แคลอรี่' : 'Calories'}
                      name="nutrition.calories"
                      value={getNestedValue(
                        editedFields,
                        'nutrition.calories',
                        editingFoodItem.nutrition?.calories,
                      )}
                      onChange={handleEditFieldChangeHandler}
                      unit="kcal"
                      // Calories are usually calculated, so might be disabled or auto-updated
                      // disabled={true} // Example: if calories are auto-calculated
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <NutrientTextField
                      label={currentLang === 'th' ? 'โปรตีน' : 'Protein'}
                      name="nutrition.protein"
                      value={getNestedValue(
                        editedFields,
                        'nutrition.protein',
                        editingFoodItem.nutrition?.protein,
                      )}
                      onChange={handleEditFieldChangeHandler}
                      unit="g"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <NutrientTextField
                      label={currentLang === 'th' ? 'คาร์โบไฮเดรต' : 'Carbs'}
                      name="nutrition.carbs"
                      value={getNestedValue(
                        editedFields,
                        'nutrition.carbs',
                        editingFoodItem.nutrition?.carbs,
                      )}
                      onChange={handleEditFieldChangeHandler}
                      unit="g"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <NutrientTextField
                      label={currentLang === 'th' ? 'ไขมัน' : 'Fat'}
                      name="nutrition.fat"
                      value={getNestedValue(
                        editedFields,
                        'nutrition.fat',
                        editingFoodItem.nutrition?.fat,
                      )}
                      onChange={handleEditFieldChangeHandler}
                      unit="g"
                    />
                  </Grid>
                  {/* Other direct nutrition fields can be added here similarly if needed */}
                  {/* For example, if fiber, sugar etc. are edited on this tab */}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <NutrientTextField
                      label={currentLang === 'th' ? 'ใยอาหาร' : 'Fiber'}
                      name="nutrition.fiber"
                      value={getNestedValue(
                        editedFields,
                        'nutrition.fiber',
                        editingFoodItem.nutrition?.fiber,
                      )}
                      onChange={handleEditFieldChangeHandler}
                      unit="g"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <NutrientTextField
                      label={currentLang === 'th' ? 'น้ำตาล' : 'Sugar'}
                      name="nutrition.sugar"
                      value={getNestedValue(
                        editedFields,
                        'nutrition.sugar',
                        editingFoodItem.nutrition?.sugar,
                      )}
                      onChange={handleEditFieldChangeHandler}
                      unit="g"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <NutrientTextField
                      label={currentLang === 'th' ? 'โซเดียม' : 'Sodium'}
                      name="nutrition.sodium"
                      value={getNestedValue(
                        editedFields,
                        'nutrition.sodium',
                        editingFoodItem.nutrition?.sodium,
                      )}
                      onChange={handleEditFieldChangeHandler}
                      unit="mg"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <NutrientTextField
                      label={
                        currentLang === 'th' ? 'คอเลสเตอรอล' : 'Cholesterol'
                      }
                      name="nutrition.cholesterol"
                      value={getNestedValue(
                        editedFields,
                        'nutrition.cholesterol',
                        editingFoodItem.nutrition?.cholesterol,
                      )}
                      onChange={handleEditFieldChangeHandler}
                      unit="mg"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <NutrientTextField
                      label={
                        currentLang === 'th' ? 'ไขมันอิ่มตัว' : 'Saturated Fat'
                      }
                      name="nutrition.saturated_fat"
                      value={getNestedValue(
                        editedFields,
                        'nutrition.saturated_fat',
                        editingFoodItem.nutrition?.saturated_fat,
                      )}
                      onChange={handleEditFieldChangeHandler}
                      unit="g"
                    />
                  </Grid>
                  {/* Add other direct nutrition fields from FoodItem.nutrition if applicable */}
                </Grid>
              </TabPanel>

              <TabPanel value={activeTab} index={1}>
                <Grid container spacing={{ xs: 1, sm: 2 }}>
                  {Object.entries(ALL_MICRONUTRIENTS_SCHEMA).map(
                    ([key, schemaInfo]) => {
                      const microKey = key as keyof MicronutrientsMap // Type assertion
                      const currentValue = getNestedValue(
                        editedFields,
                        `micronutrients.${microKey}.value`,
                        // Fallback to original item's micronutrient value IF editingFoodItem.micronutrients exists
                        // AND editingFoodItem.micronutrients[microKey] exists. Otherwise, undefined (will show as empty).
                        editingFoodItem?.micronutrients?.[microKey]?.value,
                      )
                      const currentUnit = getNestedValue(
                        editedFields,
                        `micronutrients.${microKey}.unit`,
                        editingFoodItem?.micronutrients?.[microKey]?.unit ||
                          schemaInfo.unit,
                      )

                      return (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={microKey}>
                          {' '}
                          {/* Adjusted grid size for more items */}
                          <NutrientTextField
                            label={
                              currentLang === 'th'
                                ? schemaInfo.name
                                : schemaInfo.name.replace(/\s*\(.+\)$/, '')
                            } // Use defined name
                            name={`micronutrients.${microKey}.value`}
                            value={
                              currentValue === undefined ||
                              currentValue === null
                                ? ''
                                : String(currentValue)
                            }
                            onChange={handleEditFieldChangeHandler}
                            unit={currentUnit}
                            // Note: Unit editing for micronutrients is not directly supported here.
                            // Units are primarily taken from schema or existing data.
                          />
                        </Grid>
                      )
                    },
                  )}
                </Grid>
              </TabPanel>
              {/* Add more TabPanels if new categories are added */}
            </>
          )}
          <DialogActions sx={{ pt: 2, mt: 'auto', px: { xs: 1, sm: 2 } }}>
            {' '}
            {/* Added mt: 'auto' to push actions to bottom */}
            <Button
              onClick={handleCloseEditModalHandler}
              sx={{
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                minWidth: { xs: 60, sm: 80 },
              }}
            >
              {currentLang === 'th' ? 'ยกเลิก' : 'Cancel'}
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveFoodItemHandler}
              color="primary"
              disabled={isDailyLoading} // Disable button while loading
              sx={{
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                minWidth: { xs: 80, sm: 120 },
              }}
            >
              {isDailyLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : currentLang === 'th' ? (
                'บันทึกการเปลี่ยนแปลง'
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogActions>
        </Paper>
      </Modal>

      {/* Confirm Delete Modal */}
      <Dialog
        open={confirmDeleteModalOpen}
        onClose={handleCloseConfirmDeleteModalHandler}
        aria-labelledby="confirm-delete-dialog-title"
        aria-describedby="confirm-delete-dialog-description"
        PaperProps={{
          sx: {
            margin: { xs: 1, sm: 2 },
            width: { xs: 'calc(100% - 16px)', sm: 'auto' },
            maxWidth: { xs: 'none', sm: 500 },
          },
        }}
      >
        <DialogTitle
          id="confirm-delete-dialog-title"
          sx={{
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            px: { xs: 2, sm: 3 },
            py: { xs: 1.5, sm: 2 },
          }}
        >
          {currentLang === 'th' ? 'ยืนยันการลบ' : 'Confirm Deletion'}
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <DialogContentText
            id="confirm-delete-dialog-description"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            {currentLang === 'th'
              ? `คุณแน่ใจหรือไม่ว่าต้องการลบ '${deletingFoodItemInfo?.foodItem?.name?.th || 'รายการนี้'}' ออกจากบันทึก?`
              : `Are you sure you want to delete '${deletingFoodItemInfo?.foodItem?.name?.en || deletingFoodItemInfo?.foodItem?.name?.th || 'this item'}' from your log?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 } }}>
          <Button
            onClick={handleCloseConfirmDeleteModalHandler}
            sx={{
              fontSize: { xs: '0.8rem', sm: '0.875rem' },
              minWidth: { xs: 60, sm: 80 },
            }}
          >
            {currentLang === 'th' ? 'ยกเลิก' : 'Cancel'}
          </Button>
          <Button
            onClick={handleDeleteFoodItemHandler}
            color="error"
            autoFocus
            sx={{
              fontSize: { xs: '0.8rem', sm: '0.875rem' },
              minWidth: { xs: 60, sm: 80 },
            }}
          >
            {currentLang === 'th' ? 'ลบ' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
})

DailyReportView.displayName = 'DailyReportView'

export default DailyReportView
