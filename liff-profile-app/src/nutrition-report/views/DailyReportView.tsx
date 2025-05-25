import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Box,
  Typography,
  CircularProgress,
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
  Container,
  Tabs,
  Tab,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { useNutritionStore } from '../stores/nutritionStore'
import { format, parseISO, addDays, subDays } from 'date-fns'
import { th, enUS } from 'date-fns/locale' // For localization
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LocalizationProvider, StaticDatePicker } from '@mui/x-date-pickers'
import { useLiffAuth } from '../hooks/useLiffAuth'
import { useUrlParameters } from '../hooks/useUrlParameters'
import type { FoodItem as SharedFoodItem } from '@ai-nutritionist/shared-types'
import type { FoodLogResponseDto } from '../services/api.service'
import type {
  UpdateFoodLogPayload,
  UpdateVitaminMineralDetailPayload,
} from '../stores/nutritionStore'
import { LinearProgressWithLabel } from '../components/LinearProgressWithLabel'

// Import charting library (Recharts)
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  Label,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

// Import frontend calculation utilities for Smart Hybrid Architecture
import {
  calculateNutritionGoals,
  validateUserProfileForCalculation,
  type UserProfile,
  type NutritionGoals,
} from '../utils/nutritionCalculator'

// Placeholder for a Date Selector component (can be created as a separate component later)
const DateSelector: React.FC<{
  selectedDate: string
  onDateChange: (date: string) => void
  currentLang: 'th' | 'en'
}> = ({ selectedDate, onDateChange, currentLang }) => {
  const displayDate = format(parseISO(selectedDate), 'PPPP', {
    locale: currentLang === 'th' ? th : enUS,
  })

  const [calendarOpen, setCalendarOpen] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  const handlePrevDay = () => {
    onDateChange(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))
  }

  const handleNextDay = () => {
    onDateChange(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))
  }

  const handleToday = () => {
    onDateChange(format(new Date(), 'yyyy-MM-dd'))
  }

  const handleDateClick = () => {
    setCalendarOpen(!calendarOpen)
  }

  const handleDateChange = (date: Date) => {
    onDateChange(format(date, 'yyyy-MM-dd'))
    setCalendarOpen(false)
  }

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
        position: 'relative',
      }}
    >
      <Button onClick={handlePrevDay} variant="outlined" size="small">
        {'<'}
      </Button>
      <Box
        textAlign="center"
        sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        onClick={handleDateClick}
      >
        <Typography
          variant="h6"
          sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
        >
          {displayDate}
        </Typography>
        <CalendarTodayIcon sx={{ ml: 1, fontSize: '1rem' }} />
        {format(parseISO(selectedDate), 'yyyy-MM-dd') !==
          format(new Date(), 'yyyy-MM-dd') && (
          <Button
            onClick={(e) => {
              e.stopPropagation()
              handleToday()
            }}
            size="small"
            sx={{ textTransform: 'none', fontWeight: 'normal', ml: 1 }}
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
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              p: 2,
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
      <Button onClick={handleNextDay} variant="outlined" size="small">
        {'>'}
      </Button>
    </Box>
  )
}

// Colors for Macronutrient Donut Chart
const MACRO_COLORS = {
  protein: '#3498db', // ฟ้า
  carbs: '#2ecc71', // เขียว
  fat: '#f1c40f', // เหลือง/ส้ม
}

const DailyReportView: React.FC = () => {
  // ✅ MOVE ALL HOOKS TO THE TOP - ย้าย Hook ทั้งหมดมาไว้ด้านบนสุด
  const {
    selectedDate,
    dailyData,
    isDailyLoading,
    dailyError,
    setSelectedDate,
    updateFoodItem,
    deleteFoodItem,
    fetchFoodLogByIdForLiff,
    currentLiffFoodLog,
    fetchDailyReport,
    updateLiffFoodLog,
    setCurrentLiffFoodLog,
  } = useNutritionStore()

  // ใช้ custom hook แทนการ duplicate code
  const {
    userId,
    idToken,
    isReady: liffReady,
    error: liffError,
  } = useLiffAuth()

  // เพิ่มการรองรับภาษาตามโปรไฟล์ผู้ใช้
  const [currentLang, setCurrentLang] = useState<'th' | 'en'>('th')

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

  // New state for animation/fade-in effects
  const [contentLoaded, setContentLoaded] = useState(false)

  // เพิ่ม state เพื่อจัดการกับ error ที่อาจเกิดขึ้นในระหว่าง render
  const [renderError, setRenderError] = useState<string | null>(null)

  // State for the LIFF food log editing form
  const [editingLiffItemData, setEditingLiffItemData] =
    useState<UpdateFoodLogPayload | null>(null)
  const [activeLiffFormTab, setActiveLiffFormTab] = useState(0)

  // 🚀 Smart Hybrid Architecture States
  const [fallbackGoals, setFallbackGoals] = useState<NutritionGoals | null>(
    null,
  )
  const [isUsingFallback, setIsUsingFallback] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

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

  // 🔄 Hybrid Goals Provider - Backend first, Frontend fallback
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

    // Priority 2: Frontend calculated fallback
    if (fallbackGoals && isUsingFallback) {
      return fallbackGoals
    }

    // Priority 3: Default values (last resort)
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
  }, [dailyData, fallbackGoals, isUsingFallback])

  // Memoized functions to prevent unnecessary re-renders
  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date)
    },
    [setSelectedDate],
  )

  const handleFetchDailyReport = useCallback(
    (date: string, userIdParam: string, tokenParam: string | null) => {
      return fetchDailyReport(date, userIdParam, tokenParam)
    },
    [fetchDailyReport],
  )

  const handleFetchFoodLogById = useCallback(
    (logId: string, userIdParam: string, tokenParam: string | null) => {
      return fetchFoodLogByIdForLiff(logId, userIdParam, tokenParam)
    },
    [fetchFoodLogByIdForLiff],
  )

  // URL parameters handling using custom hook
  const handleLogIdFound = useCallback(
    (logId: string) => {
      if (userId && idToken) {
        handleFetchFoodLogById(logId, userId, idToken).catch((err) => {
          console.error('Error fetching specific food log for LIFF:', err)
          const errorMessage =
            err instanceof Error
              ? err.message
              : 'เกิดข้อผิดพลาดในการดึงข้อมูลบันทึกสำหรับ LIFF'
          setRenderError(errorMessage)
        })
      }
    },
    [userId, idToken, handleFetchFoodLogById],
  )

  // ใช้ useUrlParameters hook
  useUrlParameters({
    onDateChange: handleDateChange,
    onLogIdFound: handleLogIdFound,
    selectedDate,
  })

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
      setIsUsingFallback(true)
    } else if (dailyData && isUsingFallback) {
      setIsUsingFallback(false)
    }
  }, [dailyError, dailyData, userProfile, fallbackGoals, isUsingFallback])

  // ดึงข้อมูลเมื่อ LIFF พร้อม และมี userId, idToken
  useEffect(() => {
    if (liffReady && userId && idToken && !currentLiffFoodLog) {
      // Fetch daily report เมื่อไม่มี specific food log
      handleFetchDailyReport(selectedDate, userId, idToken).catch((err) => {
        console.error('[DailyReportView] Error fetching daily report:', err)
      })
    }
  }, [
    liffReady,
    userId,
    idToken,
    selectedDate,
    currentLiffFoodLog,
    handleFetchDailyReport,
  ])

  // useEffect to update editingLiffItemData when currentLiffFoodLog changes
  useEffect(() => {
    if (currentLiffFoodLog) {
      // Type annotation to ensure FoodLogResponseDto is recognized as used
      const foodLog: FoodLogResponseDto = currentLiffFoodLog
      const foodDetail = foodLog.food // New: accessing food (LiffFoodDetailDto)

      const payload: UpdateFoodLogPayload = {
        mealType: foodLog.mealType,
        imageUrl: foodLog.imageUrl,
        imageAlt: foodLog.imageAlt, // Use imageAlt from FoodLogResponseDto

        food: foodDetail
          ? {
              foodName: foodDetail.foodName
                ? {
                    th: foodDetail.foodName.th,
                    en: foodDetail.foodName.en,
                  }
                : undefined,
              amount: foodDetail.amount,
              unit: foodDetail.unit,
              portion: foodDetail.portion,
              nutrition: foodDetail.nutrition
                ? {
                    calories: foodDetail.nutrition.calories,
                    protein: foodDetail.nutrition.protein,
                    carbs: foodDetail.nutrition.carbs,
                    fat: foodDetail.nutrition.fat,
                    fiber: foodDetail.nutrition.fiber,
                    sugar: foodDetail.nutrition.sugar,
                    sodium: foodDetail.nutrition.sodium,
                    cholesterol: foodDetail.nutrition.cholesterol,
                    saturated_fat: foodDetail.nutrition.saturated_fat,
                    water: foodDetail.nutrition.water,
                    omega3: foodDetail.nutrition.omega3,
                  }
                : undefined,
              micronutrients: foodDetail.micronutrients
                ? Object.entries(foodDetail.micronutrients).reduce(
                    (acc, [key, micro]) => {
                      // Ensure micro is not undefined and has value and unit before assigning
                      if (
                        micro &&
                        typeof micro.value === 'number' &&
                        micro.unit
                      ) {
                        acc[key] = {
                          value: micro.value,
                          unit: micro.unit,
                          dv: micro.dv, // dv is optional
                        }
                      }
                      return acc
                    },
                    {} as Record<string, UpdateVitaminMineralDetailPayload>,
                  )
                : undefined,
            }
          : undefined,
      }
      setEditingLiffItemData(payload)
    } else {
      // If currentLiffFoodLog is null (e.g., navigating away or no logId), clear the editing form
      setEditingLiffItemData(null)
    }
  }, [currentLiffFoodLog])

  // useEffect for automatic calorie calculation in LIFF form
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
          if (!prevData || !prevData.food || !prevData.food.nutrition)
            return prevData

          // Create a deep copy to avoid direct mutation issues
          const newData: UpdateFoodLogPayload = JSON.parse(
            JSON.stringify(prevData),
          ) as UpdateFoodLogPayload // Explicitly cast to UpdateFoodLogPayload

          if (newData.food && newData.food.nutrition) {
            // Ensure path exists in the new copy
            newData.food.nutrition.calories = calculatedCalories
          }
          return newData
        })
      }
    }
  }, [
    editingLiffItemData?.food?.nutrition?.protein,
    editingLiffItemData?.food?.nutrition?.carbs,
    editingLiffItemData?.food?.nutrition?.fat,
  ])

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
  const handleAccordionChange =
    (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      if (panel === 'micronutrients') {
        setExpandedMicronutrients(isExpanded)
      } else if (panel === 'otherNutrients') {
        setExpandedOtherNutrients(isExpanded)
      }
    }

  const handleOpenEditModal = (mealId: string, item: SharedFoodItem) => {
    setEditingFoodItem({ ...item })

    setEditedFields({
      ...item,
      name: {
        th: typeof item.name === 'string' ? item.name : item.name?.th || '',
        en: typeof item.name === 'string' ? undefined : item.name?.en,
      }, // แก้ไข type ให้ตรงกับ SharedFoodItem
    })
    setCurrentEditingMealId(mealId)
    setEditModalOpen(true)
  }

  const handleCloseEditModal = () => {
    setEditModalOpen(false)
    setEditingFoodItem(null)
    setCurrentEditingMealId(null)
    setEditedFields({})
  }

  const handleEditFieldChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target

    setEditedFields((prev: Partial<SharedFoodItem>) => {
      // Deep copy to avoid modifying nested objects directly. Consider a library for more robust deep cloning if issues arise.
      const newEditedFields: Partial<SharedFoodItem> = JSON.parse(
        JSON.stringify(prev),
      ) as Partial<SharedFoodItem>

      const parts = name.split('.')
      let current: Record<string, any> = newEditedFields // Changed to Record<string, any>

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {} // Initialize if path does not exist or is not an object
        }
        current = current[part] as Record<string, any> // Added type assertion
      }

      const lastPart = parts[parts.length - 1]
      const numericFields = [
        'calories',
        'protein',
        'carbs',
        'fat',
        'fiber',
        'sugar',
        'sodium',
        'saturated_fat',
        'cholesterol',
        'water',
        'size',
        'weight',
        // Vitamin/Mineral values like 'value' if their path is something like 'nutrition.vitamins.vitamin_a.value'
      ]
      // Specific check for vitamin/mineral DV which might be numbers
      const dvFields = ['dv']

      if (
        numericFields.includes(lastPart) ||
        ((parts.includes('vitamins') || parts.includes('minerals')) &&
          dvFields.includes(lastPart))
      ) {
        current[lastPart] = value === '' ? undefined : Number(value)
      } else {
        current[lastPart] = value
      }
      return newEditedFields
    })
  }

  const handleSaveFoodItem = () => {
    if (
      editedFields &&
      currentEditingMealId &&
      userId &&
      idToken &&
      editingFoodItem
    ) {
      // สร้าง updatedFoodItem จาก editingFoodItem และ editedFields
      const updatedFoodItem: SharedFoodItem = {
        ...editingFoodItem,
        ...editedFields,
      }

      void updateFoodItem(
        currentEditingMealId,
        updatedFoodItem,
        userId,
        idToken,
      )
    }
    setEditModalOpen(false)
    setEditingFoodItem(null)
    setCurrentEditingMealId('')
  }

  // เพิ่ม delete modal handlers
  const handleOpenConfirmDeleteModal = (
    mealId: string,
    item: SharedFoodItem,
  ) => {
    setDeletingFoodItemInfo({ mealId, foodItem: item })
    setConfirmDeleteModalOpen(true)
  }

  const handleCloseConfirmDeleteModal = () => {
    setConfirmDeleteModalOpen(false)
    setDeletingFoodItemInfo(null)
  }

  const handleDeleteFoodItem = () => {
    if (deletingFoodItemInfo && userId && idToken) {
      // Call the actual deleteFoodItem from the store
      // mealId จริงๆ แล้วเป็น foodLogId
      void deleteFoodItem(
        deletingFoodItemInfo.mealId, // This is actually foodLogId
        deletingFoodItemInfo.foodItem._id!, // food item ID
        userId,
        idToken,
      )
    }
    handleCloseConfirmDeleteModal()
  }

  // Handler for changing tabs in the LIFF form
  const handleLiffFormTabChange = (
    event: React.SyntheticEvent,
    newValue: number,
  ) => {
    setActiveLiffFormTab(newValue)
  }

  // Handler for input changes in the LIFF form
  const handleLiffItemInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setEditingLiffItemData((prevData) => {
      if (!prevData) return null

      const newData: UpdateFoodLogPayload = JSON.parse(
        JSON.stringify(prevData),
      ) as UpdateFoodLogPayload

      if (!newData.food) {
        newData.food = {}
      }

      const parts = name.split('.')
      let currentRef: Record<string, any> = newData.food as Record<string, any>

      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i]
        if (typeof currentRef === 'object' && currentRef !== null) {
          if (
            !(key in currentRef) ||
            typeof currentRef[key] !== 'object' ||
            currentRef[key] === null
          ) {
            currentRef[key] = {} // Initialize as an object if not present or not an object
          }
          currentRef = currentRef[key] as Record<string, any> // Assert type after ensuring it's an object
        } else {
          console.error(
            `[handleLiffItemInputChange] Path creation error. currentRef became non-object at key '${key}'. Path: ${name}`,
          )
          return prevData // Cannot proceed further down the path
        }
      }

      const fieldName = parts[parts.length - 1]
      // Final assignment, ensure currentRef is an object.
      if (typeof currentRef === 'object' && currentRef !== null) {
        const numericFields = [
          'calories',
          'protein',
          'carbs',
          'fat',
          'fiber',
          'sugar',
          'sodium',
          'amount',
          'value',
          'cholesterol', // Added
          'saturated_fat', // Added
          'dv', // Added
          'omega3', // Added
        ]
        if (numericFields.includes(fieldName)) {
          currentRef[fieldName] = value === '' ? undefined : Number(value)
        } else {
          currentRef[fieldName] = value
        }
      } else {
        console.error(
          `[handleLiffItemInputChange] Final assignment error. currentRef is not an object for fieldName '${fieldName}'. Path: ${name}`,
        )
      }
      return newData
    })
  }

  const handleSaveLiffData = async () => {
    if (editingLiffItemData && currentLiffFoodLog && userId && idToken) {
      // Use currentLiffFoodLog.id (which was currentLiffFoodLog._id before DTO change)
      const result = await updateLiffFoodLog(
        currentLiffFoodLog.id, // Use .id
        editingLiffItemData,
        userId,
        idToken,
      )
      if (result) {
        alert(
          currentLang === 'th'
            ? 'บันทึกข้อมูลสำเร็จ'
            : 'Data saved successfully!',
        )
        setEditingLiffItemData(null)
        setCurrentLiffFoodLog(null) // Clear the current food log
      } else {
        alert(
          currentLang === 'th'
            ? 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'
            : 'Failed to save data.',
        )
      }
    }
  }

  // ✅ MEMOIZED VALUES - คำนวณค่าที่ใช้ใน render
  const currentFoodItemForEdit = editingLiffItemData?.food

  // 📊 Smart Hybrid Data Providers
  const effectiveGoals = getEffectiveGoals()

  // Placeholder for Insights/Tips
  const dailyInsights = useMemo(() => {
    const insights: string[] = []

    if (!dailyData) {
      // Fallback insights เมื่อไม่มีข้อมูล
      return currentLang === 'th'
        ? ['เริ่มต้นบันทึกอาหารเพื่อรับคำแนะนำที่เหมาะสำหรับคุณ!']
        : ['Start logging your food to get personalized insights!']
    }

    const { calories, macronutrients } = dailyData
    const goals = effectiveGoals // ใช้ effectiveGoals แทน hardcode

    // คำนวณเปอร์เซ็นต์ความคืบหน้าจากเป้าหมายที่แท้จริง
    const proteinProgress =
      goals.protein > 0
        ? (macronutrients.protein.consumed / goals.protein) * 100
        : 0
    const carbsProgress =
      goals.carbs > 0 ? (macronutrients.carbs.consumed / goals.carbs) * 100 : 0
    const calorieProgress =
      goals.calories > 0 ? (calories.consumed / goals.calories) * 100 : 0
    const fatProgress =
      goals.fat > 0 ? (macronutrients.fat.consumed / goals.fat) * 100 : 0

    // คำแนะนำเกี่ยวกับโปรตีน
    if (proteinProgress < 70) {
      const proteinNeeded = Math.round(
        goals.protein - macronutrients.protein.consumed,
      )
      insights.push(
        currentLang === 'th'
          ? `คุณยังขาดโปรตีนอีก ${proteinNeeded}g ลองเพิ่มไข่ เนื้อ ปลา หรือถั่วในมื้อต่อไปนะคะ`
          : `You need ${proteinNeeded}g more protein. Try adding eggs, meat, fish, or beans to your next meal!`,
      )
    } else if (proteinProgress > 130) {
      insights.push(
        currentLang === 'th'
          ? 'โปรตีนเกินความต้องการแล้ว ลองเพิ่มผักและผลไม้มากขึ้นค่ะ'
          : "You've had plenty of protein today. Consider adding more vegetables and fruits!",
      )
    }

    // คำแนะนำเกี่ยวกับแคลอรี่
    if (calorieProgress < 80) {
      const caloriesNeeded = Math.round(goals.calories - calories.consumed)
      insights.push(
        currentLang === 'th'
          ? `คุณยังต้องการแคลอรี่อีก ${caloriesNeeded} kcal ให้ครบตามเป้าหมาย`
          : `You need ${caloriesNeeded} more calories to reach your goal`,
      )
    } else if (calorieProgress > 110) {
      const excessCalories = Math.round(calories.consumed - goals.calories)
      insights.push(
        currentLang === 'th'
          ? `แคลอรี่เกินเป้าหมาย ${excessCalories} kcal แล้ว พยายามเลือกอาหารที่มีคุณค่าทางโภชนาการสูงในมื้อถัดไป`
          : `Calories are ${excessCalories} kcal above target. Try choosing more nutrient-dense foods for your next meals`,
      )
    }

    // คำแนะนำเกี่ยวกับคาร์โบไฮเดรต
    if (carbsProgress < 60) {
      const carbsNeeded = Math.round(
        goals.carbs - macronutrients.carbs.consumed,
      )
      insights.push(
        currentLang === 'th'
          ? `คาร์โบไฮเดรตยังไม่เพียงพอ ขาดอีก ${carbsNeeded}g ลองเพิ่มข้าว ขนมปัง หรือผลไม้`
          : `Carbohydrates are low. You need ${carbsNeeded}g more. Try adding rice, bread, or fruits`,
      )
    } else if (carbsProgress > 120) {
      insights.push(
        currentLang === 'th'
          ? 'คาร์โบไฮเดรตเกินเป้าหมายแล้ว ลองลดข้าวหรือแป้งในมื้อถัดไป'
          : 'Carbohydrates are above target. Consider reducing rice or starchy foods in your next meal',
      )
    }

    // คำแนะนำเกี่ยวกับไขมัน
    if (fatProgress < 50) {
      const fatNeeded = Math.round(goals.fat - macronutrients.fat.consumed)
      insights.push(
        currentLang === 'th'
          ? `ไขมันดียังไม่เพียงพอ ขาดอีก ${fatNeeded}g ลองเพิ่มถั่ว อะโวคาโด หรือน้ำมันมะกอก`
          : `Healthy fats are low. You need ${fatNeeded}g more. Try adding nuts, avocado, or olive oil`,
      )
    } else if (fatProgress > 130) {
      insights.push(
        currentLang === 'th'
          ? 'ไขมันเกินเป้าหมายแล้ว ระวังอาหารทอดและของหวานในมื้อถัดไป'
          : 'Fat intake is above target. Watch out for fried foods and sweets in your next meals',
      )
    }

    // ตรวจสอบสารอาหารรอง
    const fiber = dailyData.otherNutrients?.fiber?.consumed || 0
    const water = dailyData.otherNutrients?.water?.consumed || 0
    const sodium = dailyData.otherNutrients?.sodium?.consumed || 0

    if (fiber < goals.fiber * 0.6) {
      const fiberNeeded = Math.round(goals.fiber - fiber)
      insights.push(
        currentLang === 'th'
          ? `ใยอาหารยังไม่เพียงพอ ขาดอีก ${fiberNeeded}g ลองเพิ่มผัก ผลไม้ และธัญพืชเต็มเมล็ด`
          : `Fiber is low. You need ${fiberNeeded}g more. Add more vegetables, fruits, and whole grains`,
      )
    }

    if (water < goals.water * 0.7) {
      const waterNeeded = Math.round(goals.water - water)
      insights.push(
        currentLang === 'th'
          ? `อย่าลืมดื่มน้ำให้เพียงพอ ยังต้องดื่มอีก ${waterNeeded}ml`
          : `Don't forget to stay hydrated. You need ${waterNeeded}ml more water`,
      )
    }

    if (sodium > goals.sodium * 1.2) {
      const excessSodium = Math.round(sodium - goals.sodium)
      insights.push(
        currentLang === 'th'
          ? `โซเดียมเกินเป้าหมาย ${excessSodium}mg แล้ว ระวังอาหารเค็มและอาหารแปรรูป`
          : `Sodium is ${excessSodium}mg above target. Watch out for salty and processed foods`,
      )
    }

    // คำแนะนำเชิงบวกสำหรับการบรรลุเป้าหมาย
    if (
      proteinProgress >= 80 &&
      proteinProgress <= 120 &&
      carbsProgress >= 80 &&
      carbsProgress <= 120 &&
      fatProgress >= 80 &&
      fatProgress <= 120 &&
      calorieProgress >= 90 &&
      calorieProgress <= 110
    ) {
      insights.push(
        currentLang === 'th'
          ? 'ยอดเยี่ยม! คุณได้รับสารอาหารอย่างสมดุลและตรงตามเป้าหมายในวันนี้'
          : "Excellent! You're getting a balanced intake that matches your goals today",
      )
    }

    // คำแนะนำตามเป้าหมายการออกกำลังกาย (ถ้ามีข้อมูลจาก userProfile)
    if (userProfile?.goal === 'lose_weight' && calorieProgress > 100) {
      insights.push(
        currentLang === 'th'
          ? 'เนื่องจากเป้าหมายคือลดน้ำหนัก ลองเพิ่มผักและลดแป้งในมื้อถัดไป'
          : 'Since your goal is weight loss, try adding more vegetables and reducing starches in your next meal',
      )
    } else if (userProfile?.goal === 'build_muscle' && proteinProgress < 90) {
      insights.push(
        currentLang === 'th'
          ? 'เนื่องจากเป้าหมายคือเพิ่มกล้ามเนื้อ ควรเพิ่มโปรตีนให้มากขึ้น'
          : 'Since your goal is building muscle, you should increase your protein intake',
      )
    }

    // ถ้าไม่มีคำแนะนำเฉพาะ ให้คำแนะนำทั่วไป
    if (insights.length === 0) {
      insights.push(
        currentLang === 'th'
          ? 'ดีมาก! การบันทึกอาหารต่อเนื่องจะช่วยให้คุณเข้าใจรูปแบบการกินของตัวเองมากขึ้น'
          : 'Great job! Consistent food logging helps you understand your eating patterns better',
      )
    }

    return insights
  }, [dailyData, currentLang, effectiveGoals, userProfile])

  const randomInsight = useMemo(
    () => dailyInsights[Math.floor(Math.random() * dailyInsights.length)],
    [dailyInsights],
  )

  // ✅ NOW USE CONDITIONAL RENDERING INSTEAD OF EARLY RETURNS
  // แทนที่จะใช้ early returns ใช้ conditional rendering ใน JSX แทน

  // Loading state
  if ((isDailyLoading && !dailyData && !editingLiffItemData) || !liffReady) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          p: 3,
          height: '50vh',
        }}
      >
        <CircularProgress size={40} thickness={4} />
        <Typography sx={{ mt: 2 }}>
          {!liffReady
            ? currentLang === 'th'
              ? 'กำลังเตรียม LIFF...'
              : 'Preparing LIFF...'
            : currentLang === 'th'
              ? 'กำลังโหลดข้อมูล...'
              : 'Loading data...'}
        </Typography>
      </Box>
    )
  }

  // Error states
  if (renderError || liffError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {renderError || liffError}
      </Alert>
    )
  }

  // LIFF View for editing a specific food log
  if (editingLiffItemData && currentLiffFoodLog) {
    // Ensure currentLiffFoodLog is also available for logDate etc.
    return (
      <Container maxWidth="md" sx={{ mt: 2, mb: 4 }}>
        <Paper sx={{ p: 3, mb: 2 }}>
          <Typography variant="h5" gutterBottom>
            แก้ไขบันทึกโภชนาการ (LIFF)
          </Typography>
          <Typography variant="subtitle1" gutterBottom>
            วันที่:{' '}
            {currentLiffFoodLog.logDate // Use currentLiffFoodLog for non-editable display data
              ? format(parseISO(currentLiffFoodLog.logDate), 'PPP', {
                  locale: currentLang === 'th' ? th : enUS,
                })
              : 'N/A'}
          </Typography>
          <Typography variant="subtitle1" gutterBottom>
            มื้ออาหาร:{' '}
            {editingLiffItemData.mealType ||
              currentLiffFoodLog.mealType ||
              'N/A'}
          </Typography>

          {(editingLiffItemData.imageUrl || currentLiffFoodLog.imageUrl) && (
            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <img
                src={
                  editingLiffItemData.imageUrl || currentLiffFoodLog.imageUrl
                }
                alt={`Food for ${editingLiffItemData.mealType || currentLiffFoodLog.mealType}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  borderRadius: '8px',
                }}
              />
            </Box>
          )}

          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={activeLiffFormTab}
              onChange={handleLiffFormTabChange}
              aria-label="LIFF food edit tabs"
            >
              <Tab label="ข้อมูลหลัก" />
              <Tab label="สารอาหารรอง" />
              <Tab label="วิตามิน" />
              <Tab label="แร่ธาตุ" />
            </Tabs>
          </Box>

          {/* Tab Panel for "ข้อมูลหลัก" */}
          {activeLiffFormTab === 0 && (
            <Box p={0}>
              <Typography variant="h6" gutterBottom>
                แก้ไข:{' '}
                {currentFoodItemForEdit?.foodName?.th ||
                  currentFoodItemForEdit?.foodName?.en ||
                  // currentLiffFoodLog.foodItems?.[0]?.name?.th || // OLD, to be removed/replaced
                  currentLiffFoodLog?.food?.foodName?.th || // NEW access path
                  'รายการอาหาร'}
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="ชื่ออาหาร (ไทย)"
                    name="food.foodName.th"
                    value={currentFoodItemForEdit?.foodName?.th || ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="ชื่ออาหาร (อังกฤษ)"
                    name="food.foodName.en"
                    value={currentFoodItemForEdit?.foodName?.en || ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label="ปริมาณ"
                    name="food.amount"
                    type="number"
                    value={currentFoodItemForEdit?.amount ?? ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label="หน่วย"
                    name="food.unit"
                    value={currentFoodItemForEdit?.unit || ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="คำอธิบาย Portion (เช่น 1 จาน)"
                    name="food.portion"
                    value={currentFoodItemForEdit?.portion || ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="แคลอรี่ (kcal)"
                    name="food.nutrition.calories"
                    type="number"
                    value={currentFoodItemForEdit?.nutrition?.calories ?? ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="โปรตีน (g)"
                    name="food.nutrition.protein"
                    type="number"
                    value={currentFoodItemForEdit?.nutrition?.protein ?? ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="คาร์โบไฮเดรต (g)"
                    name="food.nutrition.carbs"
                    type="number"
                    value={currentFoodItemForEdit?.nutrition?.carbs ?? ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="ไขมัน (g)"
                    name="food.nutrition.fat"
                    type="number"
                    value={currentFoodItemForEdit?.nutrition?.fat ?? ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Tab Panel for "สารอาหารรอง" */}
          {activeLiffFormTab === 1 && (
            <Box p={0}>
              <Typography variant="h6" gutterBottom>
                แก้ไขสารอาหารรอง:{' '}
                {currentFoodItemForEdit?.foodName?.th || 'รายการอาหาร'}
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="ใยอาหาร (g)"
                    name="food.nutrition.fiber"
                    type="number"
                    value={currentFoodItemForEdit?.nutrition?.fiber ?? ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="น้ำตาล (g)"
                    name="food.nutrition.sugar"
                    type="number"
                    value={currentFoodItemForEdit?.nutrition?.sugar ?? ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="โซเดียม (mg)"
                    name="food.nutrition.sodium"
                    type="number"
                    value={currentFoodItemForEdit?.nutrition?.sodium ?? ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                {/* Add Cholesterol and Saturated fat if they are part of UpdateFoodNutritionPayload */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="คอเลสเตอรอล (mg)"
                    name="food.nutrition.cholesterol"
                    type="number"
                    value={currentFoodItemForEdit?.nutrition?.cholesterol ?? ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="ไขมันอิ่มตัว (g)"
                    name="food.nutrition.saturated_fat"
                    type="number"
                    value={
                      currentFoodItemForEdit?.nutrition?.saturated_fat ?? ''
                    }
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="โอเมก้า 3 (g)"
                    name="food.nutrition.omega3"
                    type="number"
                    value={currentFoodItemForEdit?.nutrition?.omega3 ?? ''}
                    onChange={handleLiffItemInputChange}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Tab Panel for "วิตามิน" and "แร่ธาตุ" (combined for simplicity or can be separate) */}
          {activeLiffFormTab === 2 && (
            <Box p={0}>
              <Typography variant="h6" gutterBottom>
                แก้ไขวิตามินและแร่ธาตุ:{' '}
                {currentFoodItemForEdit?.foodName?.th || 'รายการอาหาร'}
              </Typography>
              <Grid container spacing={2}>
                {currentFoodItemForEdit?.micronutrients &&
                  Object.entries(currentFoodItemForEdit.micronutrients).map(
                    ([key, microData]) => {
                      const nutrient: UpdateVitaminMineralDetailPayload =
                        microData
                      return (
                        <React.Fragment key={`micro-${key}`}>
                          <Grid size={{ xs: 12 }}>
                            <Typography variant="subtitle1" sx={{ mt: 1 }}>
                              {key
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 5 }}>
                            <TextField
                              label="ปริมาณ"
                              name={`food.micronutrients.${key}.value`}
                              type="number"
                              value={nutrient.value ?? ''}
                              onChange={handleLiffItemInputChange}
                              fullWidth
                              margin="normal"
                              size="small"
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 5 }}>
                            <TextField
                              label="หน่วย"
                              name={`food.micronutrients.${key}.unit`}
                              value={nutrient.unit || ''}
                              onChange={handleLiffItemInputChange}
                              fullWidth
                              margin="normal"
                              size="small"
                            />
                          </Grid>
                          {/* DV field can be added if needed in UpdateVitaminMineralDetailPayload */}
                          <Grid size={{ xs: 12, sm: 2 }}>
                            <TextField
                              label="DV (%)"
                              name={`food.micronutrients.${key}.dv`}
                              type="number"
                              value={nutrient.dv ?? ''}
                              onChange={handleLiffItemInputChange}
                              fullWidth
                              margin="normal"
                              size="small"
                            />
                          </Grid>
                        </React.Fragment>
                      )
                    },
                  )}
                {(!currentFoodItemForEdit?.micronutrients ||
                  Object.keys(currentFoodItemForEdit.micronutrients).length ===
                    0) && (
                  <Grid size={{ xs: 12 }}>
                    <Typography sx={{ p: 2, textAlign: 'center' }}>
                      ไม่พบข้อมูลวิตามิน/แร่ธาตุสำหรับรายการนี้
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}

          <Button
            variant="contained"
            sx={{ mt: 3 }}
            onClick={() => {
              void handleSaveLiffData()
            }}
          >
            บันทึกการแก้ไข LIFF
          </Button>
          <Button
            variant="outlined"
            sx={{ mt: 3, ml: 1 }}
            onClick={() => setEditingLiffItemData(null)}
          >
            ยกเลิก / กลับไปหน้าหลัก
          </Button>
        </Paper>
      </Container>
    )
  }

  // Daily Report Error state
  if (dailyError && !editingLiffItemData) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        เกิดข้อผิดพลาดในการโหลดข้อมูลรายวัน: {dailyError}
      </Alert>
    )
  }

  // No daily data state
  if (!dailyData && !editingLiffItemData) {
    return (
      <Box sx={{ p: 2 }}>
        <DateSelector
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          currentLang={currentLang}
        />
        <Fade in timeout={800}>
          <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="subtitle1">ไม่สามารถโหลดข้อมูลได้</Typography>
          </Paper>
        </Fade>
      </Box>
    )
  }

  // ✅ MAIN DAILY REPORT VIEW - ตอนนี้แน่ใจแล้วว่า dailyData มีค่า
  // เพิ่ม null check และ type assertion เพื่อให้ TypeScript แน่ใจ
  if (!dailyData) {
    return (
      <Box sx={{ p: 2 }}>
        <DateSelector
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          currentLang={currentLang}
        />
        <Fade in timeout={800}>
          <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="subtitle1">ไม่สามารถโหลดข้อมูลได้</Typography>
          </Paper>
        </Fade>
      </Box>
    )
  }

  const { protein, carbs, fat } = dailyData.macronutrients
  const caloriesConsumed = dailyData.calories.consumed
  const caloriesGoal = dailyData.calories.goal
  const totalMacrosConsumed = protein.consumed + carbs.consumed + fat.consumed

  const macroPieData = [
    {
      name: currentLang === 'th' ? 'โปรตีน' : 'Protein',
      value: protein.consumed,
      goal: protein.goal,
      color: MACRO_COLORS.protein,
    },
    {
      name: currentLang === 'th' ? 'คาร์โบไฮเดรต' : 'Carbs',
      value: carbs.consumed,
      goal: carbs.goal,
      color: MACRO_COLORS.carbs,
    },
    {
      name: currentLang === 'th' ? 'ไขมัน' : 'Fat',
      value: fat.consumed,
      goal: fat.goal,
      color: MACRO_COLORS.fat,
    },
  ].filter((m) => m.value > 0)

  interface NutrientSummaryItem {
    consumed: number
    goal: number
    unit: string
  }

  const micronutrientsSummary: {
    fiber: NutrientSummaryItem
    sugar: NutrientSummaryItem
    sodium: NutrientSummaryItem
    cholesterol?: NutrientSummaryItem
    saturated_fat?: NutrientSummaryItem
    omega3?: NutrientSummaryItem
    water?: NutrientSummaryItem
  } = {
    fiber: {
      consumed: dailyData.otherNutrients?.fiber?.consumed ?? 0,
      goal: dailyData.otherNutrients?.fiber?.goal ?? 25, // Use backend goal or default
      unit: dailyData.otherNutrients?.fiber?.unit || 'g',
    },
    sugar: {
      consumed: dailyData.otherNutrients?.sugar?.consumed ?? 0,
      goal: dailyData.otherNutrients?.sugar?.goal ?? 50, // Use backend goal or default
      unit: dailyData.otherNutrients?.sugar?.unit || 'g',
    },
    sodium: {
      consumed: dailyData.otherNutrients?.sodium?.consumed ?? 0,
      goal: dailyData.otherNutrients?.sodium?.goal ?? 2300, // Use backend goal or default
      unit: dailyData.otherNutrients?.sodium?.unit || 'mg',
    },
    cholesterol: {
      consumed: dailyData.otherNutrients?.cholesterol?.consumed ?? 0,
      goal: dailyData.otherNutrients?.cholesterol?.goal ?? 300, // Use backend goal or default
      unit: dailyData.otherNutrients?.cholesterol?.unit || 'mg',
    },
    saturated_fat: {
      consumed: dailyData.otherNutrients?.saturated_fat?.consumed ?? 0,
      goal: dailyData.otherNutrients?.saturated_fat?.goal ?? 20, // Use backend goal or default
      unit: dailyData.otherNutrients?.saturated_fat?.unit || 'g',
    },
    omega3: {
      consumed: dailyData.otherNutrients?.omega3?.consumed ?? 0,
      goal: dailyData.otherNutrients?.omega3?.goal ?? 1.6, // Use backend goal or default
      unit: dailyData.otherNutrients?.omega3?.unit || 'g',
    },
    water: {
      consumed: dailyData.otherNutrients?.water?.consumed ?? 0,
      goal: dailyData.otherNutrients?.water?.goal ?? 2000, // Use backend goal or default
      unit: dailyData.otherNutrients?.water?.unit || 'ml',
    },
  }

  const mealCaloriesData = dailyData.meals.map((meal) => ({
    name: meal.name,
    calories: meal.totalCalories,
    percentOfDaily:
      dailyData.calories.consumed > 0
        ? Math.round((meal.totalCalories / dailyData.calories.consumed) * 100)
        : 0,
  }))

  const MEAL_EMOJIS: { [key: string]: string } = {
    เช้า: '☀️',
    Morning: '☀️',
    กลางวัน: '🕛',
    Lunch: '🕚',
    เย็น: '🌙',
    Dinner: '🌚',
    ว่าง: '🍎',
    Snack: '🍎',
    มื้ออื่นๆ: '🍽️',
    Other: '🍽️',
  }

  const tooltipFormatter = (value: number, name: string) => {
    return [
      `${value}g (${Math.round((value / totalMacrosConsumed) * 100)}%)`,
      name,
    ]
  }

  const barTooltipFormatter = (
    value: number,
    name: string,
    props: { payload?: { percentOfDaily?: number } },
  ) => {
    const percentage = props.payload?.percentOfDaily || 0
    return [`${value} kcal (${percentage}%)`, name]
  }

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
            <Grid size={{ xs: 12, md: 7 }} sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={macroPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={2}
                    animationBegin={200}
                    animationDuration={1000}
                  >
                    {macroPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <Label
                      value={`${caloriesConsumed} / ${caloriesGoal}`}
                      position="center"
                      fill="#333"
                      fontSize={18}
                      fontWeight="bold"
                      dy={-10}
                    />
                    <Label
                      value={currentLang === 'th' ? 'KCAL' : 'KCAL'}
                      position="center"
                      fill="#666"
                      fontSize={12}
                      dy={15}
                    />
                  </Pie>
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {currentLang === 'th' ? 'โปรตีน' : 'Protein'}
                </Typography>
                <LinearProgressWithLabel
                  value={
                    dailyData.macronutrients.protein.goal && // Check goal exists
                    dailyData.macronutrients.protein.goal > 0
                      ? (dailyData.macronutrients.protein.consumed /
                          (dailyData.macronutrients.protein.goal || 1)) *
                        100
                      : 0
                  }
                  consumed={dailyData.macronutrients.protein.consumed}
                  goal={dailyData.macronutrients.protein.goal || 0} // Fallback to 0 if undefined
                  unit="g"
                />
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                  {currentLang === 'th' ? 'คาร์โบไฮเดรต' : 'Carbohydrates'}
                </Typography>
                <LinearProgressWithLabel
                  value={
                    dailyData.macronutrients.carbs.goal && // Check goal exists
                    dailyData.macronutrients.carbs.goal > 0
                      ? (dailyData.macronutrients.carbs.consumed /
                          (dailyData.macronutrients.carbs.goal || 1)) *
                        100
                      : 0
                  }
                  consumed={dailyData.macronutrients.carbs.consumed}
                  goal={dailyData.macronutrients.carbs.goal || 0} // Fallback to 0 if undefined
                  unit="g"
                />
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                  {currentLang === 'th' ? 'ไขมัน' : 'Fat'}
                </Typography>
                <LinearProgressWithLabel
                  value={
                    dailyData.macronutrients.fat.goal && // Check goal exists
                    dailyData.macronutrients.fat.goal > 0
                      ? (dailyData.macronutrients.fat.consumed /
                          (dailyData.macronutrients.fat.goal || 1)) *
                        100
                      : 0
                  }
                  consumed={dailyData.macronutrients.fat.consumed}
                  goal={dailyData.macronutrients.fat.goal || 0} // Fallback to 0 if undefined
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
            overflow: 'hidden', // Prevent overflow for mobile
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={mealCaloriesData}
                margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={barTooltipFormatter} />
                <Legend />
                <Bar
                  dataKey="calories"
                  fill="#8884d8"
                  name={currentLang === 'th' ? 'แคลอรี่' : 'Calories'}
                  animationBegin={300}
                  animationDuration={1200}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Fade>

      <Fade in={contentLoaded} timeout={1100}>
        <Accordion
          expanded={expandedOtherNutrients}
          onChange={handleAccordionChange('otherNutrients')}
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
              <Typography variant="subtitle2" gutterBottom>
                {currentLang === 'th' ? 'ใยอาหาร (Fiber)' : 'Fiber'}
              </Typography>
              <LinearProgressWithLabel
                value={
                  (micronutrientsSummary.fiber.consumed /
                    micronutrientsSummary.fiber.goal) *
                  100
                }
                consumed={micronutrientsSummary.fiber.consumed}
                goal={micronutrientsSummary.fiber.goal}
                unit="g"
              />
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'น้ำตาล (Sugar)' : 'Sugar'}
              </Typography>
              <LinearProgressWithLabel
                value={
                  (micronutrientsSummary.sugar.consumed /
                    micronutrientsSummary.sugar.goal) *
                  100
                }
                consumed={micronutrientsSummary.sugar.consumed}
                goal={micronutrientsSummary.sugar.goal}
                unit="g"
                isMaxGoal={true}
              />
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'โซเดียม (Sodium)' : 'Sodium'}
              </Typography>
              <LinearProgressWithLabel
                value={
                  (micronutrientsSummary.sodium.consumed /
                    micronutrientsSummary.sodium.goal) *
                  100
                }
                consumed={micronutrientsSummary.sodium.consumed}
                goal={micronutrientsSummary.sodium.goal}
                unit="mg"
              />
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'คอเลสเตอรอล' : 'Cholesterol'}
              </Typography>
              <LinearProgressWithLabel
                value={
                  micronutrientsSummary.cholesterol?.goal
                    ? (micronutrientsSummary.cholesterol.consumed /
                        micronutrientsSummary.cholesterol.goal) *
                      100
                    : 0
                }
                consumed={micronutrientsSummary.cholesterol?.consumed ?? 0}
                goal={micronutrientsSummary.cholesterol?.goal ?? 300} // Default goal 300mg
                unit="mg"
                isMaxGoal={true}
              />
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'ไขมันอิ่มตัว' : 'Saturated Fat'}
              </Typography>
              <LinearProgressWithLabel
                value={
                  micronutrientsSummary.saturated_fat?.goal
                    ? (micronutrientsSummary.saturated_fat.consumed /
                        micronutrientsSummary.saturated_fat.goal) *
                      100
                    : 0
                }
                consumed={micronutrientsSummary.saturated_fat?.consumed ?? 0}
                goal={micronutrientsSummary.saturated_fat?.goal ?? 20} // Default goal 20g
                unit="g"
                isMaxGoal={true}
              />
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'โอเมก้า 3' : 'Omega-3'}
              </Typography>
              <LinearProgressWithLabel
                value={
                  micronutrientsSummary.omega3?.goal
                    ? (micronutrientsSummary.omega3.consumed /
                        micronutrientsSummary.omega3.goal) *
                      100
                    : 0
                }
                consumed={micronutrientsSummary.omega3?.consumed ?? 0}
                goal={micronutrientsSummary.omega3?.goal ?? 1.6} // Default goal 1.6g (example for men)
                unit="g"
              />
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1.5 }}>
                {currentLang === 'th' ? 'น้ำ' : 'Water'}
              </Typography>
              <LinearProgressWithLabel
                value={
                  micronutrientsSummary.water?.goal
                    ? (micronutrientsSummary.water.consumed /
                        micronutrientsSummary.water.goal) *
                      100
                    : 0
                }
                consumed={micronutrientsSummary.water?.consumed ?? 0}
                goal={micronutrientsSummary.water?.goal ?? 2000} // Default goal 2000ml
                unit="ml"
              />
            </Box>
          </AccordionDetails>
        </Accordion>
      </Fade>

      <Fade in={contentLoaded} timeout={1200}>
        <Accordion
          expanded={expandedMicronutrients}
          onChange={handleAccordionChange('micronutrients')}
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
              {dailyData.micronutrients &&
              Object.keys(dailyData.micronutrients).length > 0 ? (
                Object.entries(dailyData.micronutrients)
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
                      <Grid key={key} size={{ xs: 12, sm: 6 }}>
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
                <Grid size={12} sx={{ textAlign: 'center', p: 2 }}>
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
          {dailyData.meals.length === 0 ? (
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
            dailyData.meals.map((meal, mealIndex) => {
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
              const mealEmoji = MEAL_EMOJIS[meal.name] || '🍽️'

              return (
                <Grow
                  in={contentLoaded}
                  timeout={(mealIndex + 1) * 200}
                  key={meal.id || `meal-${mealIndex}`}
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
                      {`${mealEmoji} ${meal.name} - ${meal.totalCalories} kcal`}
                    </Typography>
                    {meal.foodItems.map((item, itemIndex) => (
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
                          {/* เพิ่มส่วนแสดงภาพอาหาร */}
                          <Box sx={{ flexShrink: 0 }}>
                            {'imageUrl' in item && item.imageUrl ? (
                              <img
                                src={item.imageUrl as string}
                                alt={item.name.th || 'อาหาร'}
                                style={{
                                  width: '60px',
                                  height: '60px',
                                  borderRadius: '8px',
                                  objectFit: 'cover',
                                  border: '2px solid #e0e0e0',
                                }}
                                onError={(e) => {
                                  // ถ้าโหลดภาพไม่ได้ให้แสดง placeholder
                                  e.currentTarget.style.display = 'none'
                                  const placeholder = e.currentTarget
                                    .nextElementSibling as HTMLElement
                                  if (placeholder) {
                                    placeholder.style.display = 'flex'
                                  }
                                }}
                              />
                            ) : null}
                            {/* Placeholder สำหรับกรณีไม่มีภาพ */}
                            <Box
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
                              onClick={() => handleOpenEditModal(meal.id, item)}
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
                                handleOpenConfirmDeleteModal(meal.id, item)
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
                        {itemIndex < meal.foodItems.length - 1 && (
                          <Divider light />
                        )}
                      </div>
                    ))}
                    {meal.foodItems.length > 0 && <Divider sx={{ my: 1.5 }} />}
                    <Box
                      sx={{
                        mt: meal.foodItems.length > 0 ? 1.5 : 0,
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
                          ? `โปรตีน: ${mealProtein}g, คาร์โบไฮเดรต: ${mealCarbs}g, ไขมัน: ${mealFat}g`
                          : `Protein: ${mealProtein}g, Carbs: ${mealCarbs}g, Fat: ${mealFat}g`}
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
        onClose={handleCloseEditModal}
        aria-labelledby="edit-food-item-title"
      >
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 450 },
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 3,
            borderRadius: 2,
          }}
        >
          <Typography
            id="edit-food-item-title"
            variant="h6"
            component="h2"
            gutterBottom
          >
            {currentLang === 'th' ? 'แก้ไขรายการอาหาร' : 'Edit Food Item'}
          </Typography>
          {editingFoodItem && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label={
                    currentLang === 'th'
                      ? 'ชื่ออาหาร (ไทย)'
                      : 'Food Name (Thai)'
                  }
                  name="name.th"
                  fullWidth
                  variant="outlined"
                  value={editedFields.name?.th || ''}
                  onChange={handleEditFieldChange}
                  size="small"
                />
              </Grid>
              {currentLang === 'en' && (
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Food Name (English)"
                    name="name.en"
                    fullWidth
                    variant="outlined"
                    value={editedFields.name?.en || ''}
                    onChange={handleEditFieldChange}
                    size="small"
                  />
                </Grid>
              )}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={
                    currentLang === 'th'
                      ? 'ขนาดรับประทาน (เช่น 1, 100)'
                      : 'Serving Size (e.g., 1, 100)'
                  }
                  name="serving.size"
                  type="number"
                  fullWidth
                  variant="outlined"
                  value={
                    editedFields.serving?.size === undefined
                      ? ''
                      : String(editedFields.serving.size)
                  }
                  onChange={handleEditFieldChange}
                  size="small"
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
                  value={editedFields.serving?.unit || ''}
                  onChange={handleEditFieldChange}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={
                    currentLang === 'th' ? 'แคลอรี่ (kcal)' : 'Calories (kcal)'
                  }
                  name="nutrition.calories"
                  type="number"
                  fullWidth
                  variant="outlined"
                  value={editedFields.nutrition?.calories || ''}
                  onChange={handleEditFieldChange}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={currentLang === 'th' ? 'โปรตีน (g)' : 'Protein (g)'}
                  name="nutrition.protein"
                  type="number"
                  fullWidth
                  variant="outlined"
                  value={editedFields.nutrition?.protein || ''}
                  onChange={handleEditFieldChange}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={
                    currentLang === 'th' ? 'คาร์โบไฮเดรต (g)' : 'Carbs (g)'
                  }
                  name="nutrition.carbs"
                  type="number"
                  fullWidth
                  variant="outlined"
                  value={editedFields.nutrition?.carbs || ''}
                  onChange={handleEditFieldChange}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={currentLang === 'th' ? 'ไขมัน (g)' : 'Fat (g)'}
                  name="nutrition.fat"
                  type="number"
                  fullWidth
                  variant="outlined"
                  value={editedFields.nutrition?.fat || ''}
                  onChange={handleEditFieldChange}
                  size="small"
                />
              </Grid>
            </Grid>
          )}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleCloseEditModal} sx={{ mr: 1 }}>
              {currentLang === 'th' ? 'ยกเลิก' : 'Cancel'}
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveFoodItem}
              color="primary"
            >
              {currentLang === 'th' ? 'บันทึกการเปลี่ยนแปลง' : 'Save Changes'}
            </Button>
          </Box>
        </Paper>
      </Modal>

      {/* Confirm Delete Modal */}
      <Dialog
        open={confirmDeleteModalOpen}
        onClose={handleCloseConfirmDeleteModal}
        aria-labelledby="confirm-delete-dialog-title"
        aria-describedby="confirm-delete-dialog-description"
      >
        <DialogTitle id="confirm-delete-dialog-title">
          {currentLang === 'th' ? 'ยืนยันการลบ' : 'Confirm Deletion'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-delete-dialog-description">
            {currentLang === 'th'
              ? `คุณแน่ใจหรือไม่ว่าต้องการลบ '${deletingFoodItemInfo?.foodItem?.name?.th || 'รายการนี้'}' ออกจากบันทึก?`
              : `Are you sure you want to delete '${deletingFoodItemInfo?.foodItem?.name?.en || deletingFoodItemInfo?.foodItem?.name?.th || 'this item'}' from your log?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirmDeleteModal}>
            {currentLang === 'th' ? 'ยกเลิก' : 'Cancel'}
          </Button>
          <Button onClick={handleDeleteFoodItem} color="error" autoFocus>
            {currentLang === 'th' ? 'ลบ' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default DailyReportView
