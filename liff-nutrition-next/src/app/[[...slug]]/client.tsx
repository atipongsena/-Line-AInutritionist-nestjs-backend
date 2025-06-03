'use client'

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from 'react'
import {
  Container,
  Typography,
  Button,
  CircularProgress,
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Alert,
  AppBar,
  Toolbar,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardContent,
  CssBaseline,
  ThemeProvider,
  createTheme,
  SelectChangeEvent,
  Stepper,
  Step,
  StepLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Fab,
  Menu,
  MenuList,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import PersonIcon from '@mui/icons-material/Person'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import ScaleIcon from '@mui/icons-material/Scale'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { th, enUS } from 'date-fns/locale'
import { format, differenceInYears, isValid, parseISO } from 'date-fns'
import { useRouter } from 'next/navigation' // Keep useRouter if still used for other purposes, or remove if not
import Image from 'next/image'
import Link from 'next/link'

// Import nutrition calculator functions
import {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  calculateNutritionGoals,
  validateUserProfileForCalculation,
  type UserProfile as NutritionUserProfile,
  type NutritionGoals,
} from '@/utils/nutritionCalculator'

// สร้าง interface สำหรับ LIFF SDK
// export interface LiffType { ... } // Keep custom LiffType commented or remove if not strictly needed elsewhere
// interface LiffProfile { ... } // Keep custom LiffProfile commented or remove

// Attempt to import the Liff type, assuming it's available from an installed package or local types
// This might be from '@liff/liff-types' or a custom definition in '@/types/liff'
// For now, let's assume a Liff type is available globally or can be imported.
// If not, this will need adjustment based on where LiffObject or similar type is defined.
import type { Liff } from '@liff/liff-types' // Or your custom LiffObject type
import type {
  SharedUserProfileDto,
  SharedCreateUserProfileDto,
  SharedUpdateUserProfileDto,
  Gender,
  ActivityLevel,
  DietType,
  PregnancyLactationStatus,
} from '@ai-nutritionist/shared-types'

// Helper function to decode JWT (for debugging และตรวจสอบอายุ token)
const decodeJWT = (token: string): any => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error('Error decoding JWT:', error)
    return null
  }
}

// ฟังก์ชันตรวจสอบอายุของ token
const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true
  try {
    const decoded = decodeJWT(token) as { exp?: number } | null
    if (!decoded || !decoded.exp) return true

    // คำนวณเวลาที่เหลือก่อน token หมดอายุ (หน่วยเป็นวินาที)
    const currentTime = Math.floor(Date.now() / 1000)
    const timeRemaining = decoded.exp - currentTime

    if (process.env.NODE_ENV === 'development') {
      console.log(`[TOKEN_DEBUG] Token expires in ${timeRemaining} seconds`)
    }

    // ถ้าเหลือเวลาน้อยกว่า 5 นาที ให้ถือว่า token ใกล้หมดอายุ
    return timeRemaining < 300
  } catch (error) {
    console.error('Error checking token expiration:', error)
    return true
  }
}

// Lazy load NutritionReportMain for better initial load time
// const NutritionReportMain = React.lazy(
//   () => import('./nutrition-report/views/NutritionReportMain'),
// )

// interface Profile {
//   userId: string
//   displayName: string
//   pictureUrl?: string
//   statusMessage?: string
// }

// Use LIFF ID from environment variable
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID

console.log('process.env.NEXT_PUBLIC_LIFF_ID:', process.env.NEXT_PUBLIC_LIFF_ID)
console.log('Effective LIFF_ID for liff.init:', LIFF_ID)

// Basic MUI theme (can be customized later)
const theme = createTheme({
  palette: {
    primary: {
      main: '#00B900', // LINE Green
    },
    secondary: {
      main: '#f50057', // Example secondary color
    },
  },
})

// App Global State and API interaction types
// (Re-evaluating SharedUserProfileDto usage based on actual backend responses)
// Re-importing from shared-types

interface Translations {
  [key: string]: {
    // General
    appName: string
    userProfileTitle: string
    nutritionReportTitle: string
    loadingLiff: string
    loadingProfile: string
    saveChangesButton: string
    editProfileButton: string
    nextButton: string
    backButton: string
    cancelButton: string
    stepOutOf: (current: number, total: number) => string
    // Errors
    liffIdMissingError: string
    liffInitError: string
    apiFetchError: string
    apiSaveError: string
    idTokenMissingError: string
    // Welcome
    welcomeMessage: string
    lineUserIdLabel: string
    idTokenLabel: string
    apiProfileDataTitle: string
    noApiProfileData: string
    // Form Sections & Fields
    step1Title: string
    languageLabel: string
    languageHelper: string
    nicknameLabel: string
    nicknameHelper: string
    birthdateLabel: string
    birthdateHelper: string
    ageLabel: string
    genderLabel: string
    genderHelper: string
    male: string
    female: string
    other: string // Simplified for gender ToggleButton

    step2Title: string
    goalLabel: string
    goalHelper: string
    goalOptions: { [key: string]: string }
    activityLevelLabel: string
    activityLevelHelper: string
    activityLevelOptions: { [key: string]: string }
    dietTypeLabel: string
    dietTypeHelper: string
    dietTypeOptions: { [key: string]: string }

    step3Title: string
    healthConditionsLabel: string
    foodAllergiesLabel: string

    step4Title: string
    ethicalConsiderationsLabel: string
    pregnancyStatusLabel: string
    pregnancyStatusHelper: string
    pregnancyOptions: { [key: string]: string }
    preferredCuisineLabel: string
    preferredFlavorProfilesLabel: string

    step5Title: string
    weightLabel: string
    weightHelper: string
    heightLabel: string
    heightHelper: string
    bmiLabel: string
    bmiCalculatedLabel: string

    step6Title: string
    summaryTitle: string
    targetWeightLabel: string // Example for summary
    calculatedCaloriesLabel: string // Example for summary
    profileUpdatedSuccess: string
  }
}

const translations: Translations = {
  th: {
    appName: 'Kin-Geng AI',
    userProfileTitle: '⚙️ แก้ไขโปรไฟล์',
    nutritionReportTitle: '📊 รายงานโภชนาการ',
    loadingLiff: '⏳ กำลังโหลด LIFF...',
    loadingProfile: '⏳ กำลังโหลดข้อมูลส่วนตัว...',
    saveChangesButton: '💾 บันทึกข้อมูล',
    editProfileButton: '✏️ แก้ไขข้อมูล',
    nextButton: 'ถัดไป ➡️',
    backButton: '⬅️ ย้อนกลับ',
    cancelButton: '❌ ยกเลิก',
    stepOutOf: (current, total) => `ขั้นตอนที่ ${current} จาก ${total}`,
    liffIdMissingError: '❗️ ไม่ได้ตั้งค่า LIFF ID',
    liffInitError: '❗️ เกิดข้อผิดพลาดในการเริ่มต้น LIFF',
    apiFetchError: '❗️ ไม่สามารถโหลดข้อมูลได้',
    apiSaveError: '❗️ ไม่สามารถบันทึกข้อมูลได้',
    idTokenMissingError: '❗️ ไม่พบ ID Token',
    welcomeMessage: '👋 ยินดีต้อนรับ!',
    lineUserIdLabel: 'LINE User ID:',
    idTokenLabel: 'ID Token (สำหรับทดสอบ):',
    apiProfileDataTitle: 'ข้อมูลจาก API:',
    noApiProfileData: '✨ ยินดีต้อนรับ! กรุณากรอกข้อมูลของคุณ',
    step1Title: '👤 ข้อมูลพื้นฐาน',
    languageLabel: '🌐 ภาษา',
    languageHelper: 'เลือกภาษาที่ต้องการใช้งาน',
    nicknameLabel: '😊 ชื่อเล่น',
    nicknameHelper: 'ชื่อที่ต้องการให้เรียก',
    birthdateLabel: '📅 วันเกิด',
    birthdateHelper: 'เลือกวันเกิดของคุณ หรืออายุจะคำนวณให้อัตโนมัติ',
    ageLabel: '🎂 อายุ',
    genderLabel: '👥 เพศ',
    genderHelper: 'เลือกข้อมูลเพศของคุณ (ใช้ในการคำนวณพลังงานที่ต้องการ)',
    male: '👨 ชาย',
    female: '👩 หญิง',
    other: '⚧ อื่นๆ',
    step2Title: '🎯 เป้าหมายและไลฟ์สไตล์',
    goalLabel: '🎯 เป้าหมายสุขภาพ',
    goalHelper: 'เลือกเป้าหมายหลักของคุณ',
    goalOptions: {
      lose_weight: '🏃‍♀️ ลดน้ำหนัก',
      maintain_weight: '⚖️ คงที่',
      gain_weight: '📈 เพิ่มน้ำหนัก',
      build_muscle: '💪 เพิ่มกล้ามเนื้อ',
      general_health: '🌱 สุขภาพโดยรวม',
      improve_digestion: '🥗 ปรับปรุงระบบย่อยอาหาร',
      increase_energy: '⚡ เพิ่มพลังงาน',
      manage_stress: '🧘 จัดการความเครียด',
      better_sleep: '😴 นอนหลับดีขึ้น',
      learn_recipes: '👨‍🍳 เรียนรู้สูตรอาหารใหม่',
      special_diet: '🏥 ดูแลอาหารเฉพาะโรค', // (เช่น เบาหวาน, ความดัน)
    },
    activityLevelLabel: '🏃‍♂️ ระดับกิจกรรม',
    activityLevelHelper: 'เลือกระดับการออกกำลังกายของคุณเฉลี่ยต่อสัปดาห์',
    activityLevelOptions: {
      sedentary: '📱 นั่งทำงานเป็นหลัก (ไม่ได้ออกกำลังกาย)',
      light: '🚶 เดินบ้าง / ออกกำลังเบา 1-3 วัน/สัปดาห์',
      moderate: '🏊 ออกกำลังปานกลาง 3-5 วัน/สัปดาห์',
      active: '🏋️ ออกกำลังหนัก 6-7 วัน/สัปดาห์',
      very_active: '🚴‍♂️ ทำงานใช้แรง/ออกกำลัง 2 รอบ/วัน',
    },
    dietTypeLabel: '🍽️ รูปแบบอาหาร',
    dietTypeHelper: 'เลือกรูปแบบการทานอาหารที่คุณสนใจหรือทานเป็นประจำ',
    dietTypeOptions: {
      normal: '🍽️ อาหารทั่วไป',
      keto: '🥑 คีโตเจนิค (ไขมันสูง-คาร์บต่ำ)',
      vegetarian: '🥗 มังสวิรัติ',
      vegan: '🌱 วีแกน/เจ',
      low_carb: '🥦 คาร์โบไฮเดรตต่ำ',
      high_protein: '🥩 โปรตีนสูง',
      if_16_8: '⏱️ IF (16/8)',
      if_5_2: '📅 IF (5:2)',
      paleo: '🦴 พาเลโอ',
      mediterranean: '🫒 เมดิเตอร์เรเนียน',
      gluten_free: '🌾 ปลอดกลูเตน',
      dairy_free: '🥛 ไม่ทานผลิตภัณฑ์จากนม',
      halal: '☪️ ฮาลาล',
      kosher: '✡️ โคเชอร์',
    },
    step3Title: '⚕️ สุขภาพและข้อจำกัด',
    healthConditionsLabel: '🏥 โรคประจำตัว (ถ้ามี)',
    foodAllergiesLabel: '⚠️ อาหารที่แพ้/ไม่ทาน (ถ้ามี)',
    step4Title: '🍲 ไลฟ์สไตล์และความชอบ',
    ethicalConsiderationsLabel: '🙏 ข้อพิจารณาด้านศาสนา/แนวทางจริยธรรม',
    pregnancyStatusLabel: '👶 สถานะการตั้งครรภ์/ให้นมบุตร',
    pregnancyStatusHelper: 'เลือกสถานะปัจจุบันของคุณ',
    pregnancyOptions: {
      not_applicable: '➖ ไม่เกี่ยวข้อง',
      pregnant: '🤰 กำลังตั้งครรภ์',
      lactating: '🍼 กำลังให้นมบุตร',
    },
    preferredCuisineLabel: '🍜 วัฒนธรรมอาหารที่ชื่นชอบ',
    preferredFlavorProfilesLabel: '🧂 รสชาติอาหารที่ชื่นชอบ',
    step5Title: '📏 ข้อมูลร่างกาย',
    weightLabel: '⚖️ น้ำหนัก (กก.)',
    weightHelper: 'ระบุน้ำหนักปัจจุบันของคุณ',
    heightLabel: '📏 ส่วนสูง (ซม.)',
    heightHelper: 'ระบุส่วนสูงปัจจุบันของคุณ',
    bmiLabel: '📊 BMI:',
    bmiCalculatedLabel: '📊 ค่า BMI:',
    step6Title: '✅ ยืนยันข้อมูล',
    summaryTitle: '📋 สรุปข้อมูลโปรไฟล์',
    targetWeightLabel: '🎯 น้ำหนักเป้าหมาย (กก.)',
    calculatedCaloriesLabel: '🔥 พลังงานที่แนะนำ (kcal)',
    profileUpdatedSuccess: '✅ บันทึกข้อมูลสำเร็จแล้ว',
  },
  en: {
    appName: 'My Profile',
    userProfileTitle: '⚙️ Edit Profile',
    nutritionReportTitle: '📊 Nutrition Report',
    loadingLiff: '⏳ Loading LIFF...',
    loadingProfile: '⏳ Loading profile...',
    saveChangesButton: '💾 Save Changes',
    editProfileButton: '✏️ Edit Profile',
    nextButton: 'Next ➡️',
    backButton: '⬅️ Back',
    cancelButton: '❌ Cancel',
    stepOutOf: (current, total) => `Step ${current} of ${total}`,
    liffIdMissingError: '❗️ LIFF ID is not set.',
    liffInitError: '❗️ Error initializing LIFF.',
    apiFetchError: '❗️ Could not load profile data.',
    apiSaveError: '❗️ Could not save profile data.',
    idTokenMissingError: '❗️ ID Token not found.',
    welcomeMessage: '👋 Welcome!',
    lineUserIdLabel: 'LINE User ID:',
    idTokenLabel: 'ID Token (for testing):',
    apiProfileDataTitle: 'Profile Data:',
    noApiProfileData: '✨ Welcome! Please fill in your information.',
    step1Title: '👤 Basic Information',
    languageLabel: '🌐 Language',
    languageHelper: 'Select your display language',
    nicknameLabel: '😊 Nickname',
    nicknameHelper: 'Your preferred name',
    birthdateLabel: '📅 Birthdate',
    birthdateHelper: 'Select your date of birth',
    ageLabel: '🎂 Age',
    genderLabel: '👥 Gender',
    genderHelper: 'Select your gender (used for energy calculations)',
    male: '👨 Male',
    female: '👩 Female',
    other: '⚧ Other',
    step2Title: '🎯 Goals & Lifestyle',
    goalLabel: '🎯 Health Goal',
    goalHelper: 'Select your primary health goal',
    goalOptions: {
      lose_weight: '🏃‍♀️ Weight Loss',
      maintain_weight: '⚖️ Maintain',
      gain_weight: '📈 Weight Gain',
      build_muscle: '💪 Muscle Gain',
      general_health: '🌱 General Health',
      improve_digestion: '🥗 Improve Digestion',
      increase_energy: '⚡ Increase Energy',
      manage_stress: '🧘 Manage Stress',
      better_sleep: '😴 Better Sleep',
      learn_recipes: '👨‍🍳 Learn New Recipes',
      special_diet: '🏥 Manage Special Diet',
    },
    activityLevelLabel: '🏃‍♂️ Activity Level',
    activityLevelHelper: 'Select your weekly exercise level',
    activityLevelOptions: {
      sedentary: '📱 Sedentary (little or no exercise)',
      light: '🚶 Light exercise 1-3 days/week',
      moderate: '🏊 Moderate exercise 3-5 days/week',
      active: '🏋️ Hard exercise 6-7 days/week',
      very_active: '🚴‍♂️ Physical job & hard exercise',
    },
    dietTypeLabel: '🍽️ Dietary Preferences',
    dietTypeHelper: 'Select diets you are interested in or follow',
    dietTypeOptions: {
      normal: '🍽️ Normal Diet',
      keto: '🥑 Ketogenic',
      vegetarian: '🥗 Vegetarian',
      vegan: '🌱 Vegan',
      low_carb: '🥦 Low Carb',
      high_protein: '🥩 High Protein',
      if_16_8: '⏱️ IF (16/8)',
      if_5_2: '📅 IF (5:2)',
      paleo: '🦴 Paleo',
      mediterranean: '🫒 Mediterranean',
      gluten_free: '🌾 Gluten-Free',
      dairy_free: '🥛 Dairy-Free',
      halal: '☪️ Halal',
      kosher: '✡️ Kosher',
    },
    step3Title: '⚕️ Health & Restrictions',
    healthConditionsLabel: '🏥 Health Conditions (if any)',
    foodAllergiesLabel: '⚠️ Food Allergies/Restrictions (if any)',
    step4Title: '🍲 Lifestyle & Preferences',
    ethicalConsiderationsLabel: '🙏 Religious/Ethical Considerations',
    pregnancyStatusLabel: '👶 Pregnancy/Lactation Status',
    pregnancyStatusHelper: 'Select your current status',
    pregnancyOptions: {
      not_applicable: '➖ Not Applicable',
      pregnant: '🤰 Pregnant',
      lactating: '🍼 Lactating',
    },
    preferredCuisineLabel: '🍜 Preferred Cuisine Types',
    preferredFlavorProfilesLabel: '🧂 Preferred Flavor Profiles',
    step5Title: '📏 Body Metrics',
    weightLabel: '⚖️ Weight (kg)',
    weightHelper: 'Enter your current weight',
    heightLabel: '📏 Height (cm)',
    heightHelper: 'Enter your current height',
    bmiLabel: '📊 BMI:',
    bmiCalculatedLabel: '📊 Calculated BMI:',
    step6Title: '✅ Review & Confirm',
    summaryTitle: '📋 Profile Summary',
    targetWeightLabel: '🎯 Target Weight (kg)',
    calculatedCaloriesLabel: '🔥 Recommended Calories (kcal)',
    profileUpdatedSuccess: '✅ Profile updated successfully!',
  },
}

const ProfileListItem: React.FC<{
  label: string
  value?: string | string[] | number | null
}> = ({ label, value }) => {
  const displayValue = useMemo(() => {
    if (value === null || value === undefined) return '-'
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : '-'
    }
    return String(value)
  }, [value])

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1, sm: 1.5 },
        mb: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: { xs: 48, sm: 56 },
      }}
    >
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{
          fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' },
          fontWeight: { xs: 400, sm: 500 },
          lineHeight: { xs: 1.3, sm: 1.5 },
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          textAlign: 'right',
          fontWeight: { xs: 500, sm: 600 },
          fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' },
          lineHeight: { xs: 1.3, sm: 1.5 },
          maxWidth: { xs: '60%', sm: '70%' },
          wordBreak: 'break-word',
        }}
      >
        {displayValue}
      </Typography>
    </Paper>
  )
}

// Editable ProfileListItem with arrow for section editing
const EditableProfileListItem: React.FC<{
  label: string
  value?: string | string[] | number | null
  onEdit?: () => void
}> = ({ label, value, onEdit }) => {
  const displayValue = useMemo(() => {
    if (value === null || value === undefined) return '-'
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : '-'
    }
    return String(value)
  }, [value])

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        mb: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: onEdit ? 'pointer' : 'default',
        '&:hover': onEdit ? { backgroundColor: 'grey.50' } : {},
      }}
      onClick={onEdit}
    >
      <Typography variant="body1" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="body1"
          sx={{ textAlign: 'right', fontWeight: 'medium' }}
        >
          {displayValue}
        </Typography>
        {onEdit && (
          <Typography
            variant="h6"
            color="action.active"
            sx={{ fontSize: '1.2rem' }}
          >
            ›
          </Typography>
        )}
      </Box>
    </Paper>
  )
}

// Options for Select components (example)
const goalOptions = [
  { value: 'lose_weight', labelTh: 'ลดน้ำหนัก', labelEn: 'Weight Loss' },
  { value: 'gain_weight', labelTh: 'เพิ่มน้ำหนัก', labelEn: 'Weight Gain' },
  { value: 'build_muscle', labelTh: 'เพิ่มกล้ามเนื้อ', labelEn: 'Muscle Gain' },
  {
    value: 'maintain_weight',
    labelTh: 'รักษาน้ำหนัก',
    labelEn: 'Maintain Weight',
  },
  {
    value: 'general_health',
    labelTh: 'ปรับสมดุลสุขภาพทั่วไป',
    labelEn: 'General Health Balance',
  },
]

// Food allergies options
const foodAllergyOptions = [
  { value: 'none', labelTh: 'ไม่มีแพ้', labelEn: 'No allergies' },
  { value: 'peanuts', labelTh: 'ถั่วลิสง', labelEn: 'Peanuts' },
  { value: 'dairy', labelTh: 'นมวัว', labelEn: 'Dairy' },
  { value: 'gluten', labelTh: 'แป้งสาลี / กลูเตน', labelEn: 'Gluten' },
  { value: 'seafood', labelTh: 'อาหารทะเล', labelEn: 'Seafood' },
  { value: 'eggs', labelTh: 'ไข่', labelEn: 'Eggs' },
  { value: 'other', labelTh: 'อื่นๆ', labelEn: 'Others' },
]

// Health conditions options
const healthConditionOptions = [
  { value: 'none', labelTh: 'ไม่มี', labelEn: 'None' },
  { value: 'diabetes', labelTh: 'เบาหวาน', labelEn: 'Diabetes' },
  {
    value: 'hypertension',
    labelTh: 'ความดันโลหิตสูง',
    labelEn: 'Hypertension',
  },
  { value: 'kidney_disease', labelTh: 'โรคไต', labelEn: 'Kidney Disease' },
  { value: 'heart_disease', labelTh: 'โรคหัวใจ', labelEn: 'Heart Disease' },
  {
    value: 'high_cholesterol',
    labelTh: 'ไขมันในเลือดสูง',
    labelEn: 'High Cholesterol',
  },
  { value: 'other', labelTh: 'อื่นๆ', labelEn: 'Others' },
]

// Ethical considerations options
const ethicalConsiderationOptions = [
  { value: 'none', labelTh: 'ไม่ระบุ', labelEn: 'Not specified' },
  { value: 'vegetarian', labelTh: 'ทานอาหารเจ', labelEn: 'Vegetarian' },
  { value: 'halal', labelTh: 'ฮาลาล', labelEn: 'Halal' },
  { value: 'no_beef', labelTh: 'ไม่ทานเนื้อวัว', labelEn: 'No beef' },
  { value: 'other', labelTh: 'อื่นๆ', labelEn: 'Others' },
]

// Cuisine preferences options
const cuisinePreferenceOptions = [
  { value: 'thai', labelTh: 'ไทย', labelEn: 'Thai' },
  { value: 'japanese', labelTh: 'ญี่ปุ่น', labelEn: 'Japanese' },
  { value: 'western', labelTh: 'ตะวันตก', labelEn: 'Western' },
  { value: 'chinese', labelTh: 'จีน', labelEn: 'Chinese' },
  {
    value: 'indian_arab',
    labelTh: 'อินเดีย / อาหรับ',
    labelEn: 'Indian / Arab',
  },
  { value: 'other', labelTh: 'อื่นๆ', labelEn: 'Others' },
]

// Flavor preferences options
const flavorPreferenceOptions = [
  { value: 'very_spicy', labelTh: 'เผ็ดจัด', labelEn: 'Very spicy' },
  { value: 'medium', labelTh: 'รสกลาง', labelEn: 'Medium' },
  { value: 'mild', labelTh: 'จืด', labelEn: 'Mild' },
  {
    value: 'sweet_low_salt',
    labelTh: 'หวาน / เค็มน้อย',
    labelEn: 'Sweet / Low salt',
  },
  {
    value: 'no_oily_fried',
    labelTh: 'ไม่ชอบมัน / ทอด',
    labelEn: 'No oily / fried',
  },
  { value: 'other', labelTh: 'อื่นๆ', labelEn: 'Others' },
]

const activityLevelOptionsList = [
  { value: 'sedentary', labelTh: 'ไม่ออกกำลังกายเลย', labelEn: 'Sedentary' },
  {
    value: 'light',
    labelTh: 'ออกกำลังกายเบาๆ 1-3 วัน/สัปดาห์',
    labelEn: 'Lightly active',
  },
  {
    value: 'moderate',
    labelTh: 'ออกกำลังกายปานกลาง 3-5 วัน/สัปดาห์',
    labelEn: 'Moderately active',
  },
  {
    value: 'active',
    labelTh: 'ออกกำลังกายหนัก 6-7 วัน/สัปดาห์',
    labelEn: 'Very active',
  },
  {
    value: 'very_active',
    labelTh: 'ออกกำลังกายหนักมาก (นักกีฬา)',
    labelEn: 'Super active',
  },
]

const dietTypeOptionsList = [
  { value: 'normal', labelTh: 'อาหารทั่วไป', labelEn: 'Normal Diet' },
  { value: 'keto', labelTh: 'คีโตเจนิค', labelEn: 'Ketogenic' },
  { value: 'vegetarian', labelTh: 'มังสวิรัติ', labelEn: 'Vegetarian' },
  { value: 'vegan', labelTh: 'วีแกน', labelEn: 'Vegan' },
  { value: 'low_carb', labelTh: 'คาร์โบไฮเดรตต่ำ', labelEn: 'Low Carb' },
  { value: 'high_protein', labelTh: 'โปรตีนสูง', labelEn: 'High Protein' },
  { value: 'if_16_8', labelTh: 'IF (16/8)', labelEn: 'IF (16/8)' },
  { value: 'if_5_2', labelTh: 'IF (5:2)', labelEn: 'IF (5:2)' },
  { value: 'paleo', labelTh: 'พาเลโอ', labelEn: 'Paleo' },
  {
    value: 'mediterranean',
    labelTh: 'เมดิเตอร์เรเนียน',
    labelEn: 'Mediterranean',
  },
  { value: 'gluten_free', labelTh: 'ปลอดกลูเตน', labelEn: 'Gluten-Free' },
  {
    value: 'dairy_free',
    labelTh: 'ไม่ทานผลิตภัณฑ์จากนม',
    labelEn: 'Dairy-Free',
  },
  { value: 'halal', labelTh: 'ฮาลาล', labelEn: 'Halal' },
  { value: 'kosher', labelTh: 'โคเชอร์', labelEn: 'Kosher' },
]

const pregnancyOptionsList = [
  {
    value: 'not_applicable',
    labelTh: 'ไม่เกี่ยวข้อง',
    labelEn: 'Not Applicable',
  },
  { value: 'pregnant', labelTh: 'กำลังตั้งครรภ์', labelEn: 'Pregnant' },
  { value: 'lactating', labelTh: 'กำลังให้นมบุตร', labelEn: 'Lactating' },
]

// Get localized label for select options
const getLocalizedOptionLabel = (
  option: { value: string; labelTh: string; labelEn: string },
  lang: 'th' | 'en',
) => {
  return lang === 'th' ? option.labelTh : option.labelEn
}

const LiffIdHandler: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [error] = useState<string | null>(null)

  if (error) {
    return (
      <Container
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Alert severity="error">{error}</Alert>
      </Container>
    )
  }
  return <>{children}</>
}

// ตรวจสอบ URL parameters ก่อน component render เพื่อตั้งค่า initial state
// const checkForPendingNavigation = (): boolean => {
//   const urlParams = new URLSearchParams(window.location.search)
//   const targetPath = urlParams.get('targetPath')
//   const page = urlParams.get('page')
//   const fullUrl = window.location.href
//   const pathname = window.location.pathname
//   const hash = window.location.hash

//   const hasPendingNav = !!(
//     targetPath?.includes('nutrition-report') ||
//     targetPath?.includes('daily-report') ||
//     page === 'nutrition-report' ||
//     page === 'daily-report' ||
//     fullUrl.includes('/nutrition-report') ||
//     pathname.includes('/nutrition-report') ||
//     hash.includes('/nutrition-report') ||
//     fullUrl.includes('nutrition-report') ||
//     fullUrl.includes('/daily-report') ||
//     pathname.includes('/daily-report') ||
//     hash.includes('/daily-report') ||
//     fullUrl.includes('daily-report')
//   )

//   if (hasPendingNav) {
//     console.log(
//       '[LIFF_ROUTING] Early detection: Pending navigation detected, will show loading screen',
//     )
//   }

//   return hasPendingNav
// }

function App() {
  const router = useRouter()
  // const pathname = usePathname() // No longer directly used here for routing logic
  // const searchParams = useSearchParams() // No longer directly used here

  const [liffObject, setLiffObject] = useState<any>(null) // Use Liff type if defined and stable
  const [liffError, setLiffError] = useState<string | null>(null)
  const [isLiffSdkReady, setIsLiffSdkReady] = useState(false)
  const [isLiffInitialized, setIsLiffInitialized] = useState(false)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [lineProfile, setLineProfile] = useState<any | null>(null) // Use any for lineProfile state, or a more specific custom type if preferred
  const [error, setError] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [errorCount, setErrorCount] = useState<number>(0)
  const [hasInitiatedLoad, setHasInitiatedLoad] = useState<boolean>(false) // เพิ่ม state นี้เพื่อแทน window.hasInitiatedLoad
  // const [isPendingNavigation, setIsPendingNavigation] = useState<boolean>( // REMOVED STATE
  //   checkForPendingNavigation(),
  // )

  const [userProfileFromApi, setUserProfileFromApi] =
    useState<SharedUserProfileDto | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [currentLang, setCurrentLang] = useState<'th' | 'en'>('th')
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<Partial<SharedUserProfileDto>>({})

  // Individual section edit states - เพิ่มสำหรับการแก้ไขทีละส่วน
  const [editingSections, setEditingSections] = useState<{
    basic: boolean
    goals: boolean
    health: boolean
    lifestyle: boolean
    body: boolean
  }>({
    basic: false,
    goals: false,
    health: false,
    lifestyle: false,
    body: false,
  })

  // State for checkbox arrays
  const [selectedFoodAllergies, setSelectedFoodAllergies] = useState<string[]>(
    [],
  )
  const [selectedHealthConditions, setSelectedHealthConditions] = useState<
    string[]
  >([])
  const [selectedEthicalConsiderations, setSelectedEthicalConsiderations] =
    useState<string[]>([])
  const [selectedCuisinePreferences, setSelectedCuisinePreferences] = useState<
    string[]
  >([])
  const [selectedFlavorPreferences, setSelectedFlavorPreferences] = useState<
    string[]
  >([])

  // State for "other" text inputs
  const [otherFoodAllergy, setOtherFoodAllergy] = useState('')
  const [otherHealthCondition, setOtherHealthCondition] = useState('')
  const [otherEthicalConsideration, setOtherEthicalConsideration] = useState('')
  const [otherCuisinePreference, setOtherCuisinePreference] = useState('')
  const [otherFlavorPreference, setOtherFlavorPreference] = useState('')

  // State for edit menu
  const [editMenuAnchor, setEditMenuAnchor] = useState<null | HTMLElement>(null)
  const editMenuOpen = Boolean(editMenuAnchor)

  const T = translations[currentLang]

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[DEBUG] NEXT_PUBLIC_API_URL from env: ${process.env.NEXT_PUBLIC_API_URL}`,
    )
    console.log('[DEBUG] apiBaseUrl in App.tsx:', apiBaseUrl)
  }

  const fetchWithTokenRetry = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      console.log('[FETCH_DEBUG] Starting fetchWithTokenRetry')
      console.log('[FETCH_DEBUG] URL:', url)
      console.log('[FETCH_DEBUG] Options:', options)

      let currentIdToken: string | null = null

      if (liffObject && liffObject.isLoggedIn()) {
        console.log('[FETCH_DEBUG] LIFF object available and user logged in')
        currentIdToken = liffObject.getIDToken()
        console.log(
          '[FETCH_DEBUG] Got ID token:',
          currentIdToken ? 'YES' : 'NO',
        )
      } else {
        console.error('[FETCH_DEBUG] LIFF not available or user not logged in')
        console.log('[FETCH_DEBUG] liffObject:', !!liffObject)
        console.log(
          '[FETCH_DEBUG] isLoggedIn:',
          liffObject ? liffObject.isLoggedIn() : 'N/A',
        )
        throw new Error(
          'LIFF not initialized or user not logged in to get ID token.',
        )
      }

      if (!currentIdToken) {
        console.error('[FETCH_DEBUG] Failed to obtain ID token')
        throw new Error('Failed to obtain ID token for API call.')
      }

      const baseHeaders = {
        ...options.headers,
        'Content-Type': 'application/json',
        'X-LINE-ID-TOKEN': currentIdToken,
      }

      const isLocalhost = url.includes('localhost')
      const headers = isLocalhost
        ? baseHeaders
        : { ...baseHeaders, 'ngrok-skip-browser-warning': 'true' }

      console.log('[FETCH_DEBUG] Final headers:', headers)
      console.log('[FETCH_DEBUG] Making request to:', url)

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        })

        console.log('[FETCH_DEBUG] Response received')
        console.log('[FETCH_DEBUG] Status:', response.status)
        console.log('[FETCH_DEBUG] Status Text:', response.statusText)
        console.log(
          '[FETCH_DEBUG] Headers:',
          Object.fromEntries(response.headers.entries()),
        )

        // ตรวจสอบการตอบกลับที่เกี่ยวข้องกับ token หมดอายุ
        if (response.status === 401 || response.status === 403) {
          let responseText = ''
          try {
            responseText = await response.clone().text()
            console.warn(
              '[FETCH_DEBUG] Auth error response text:',
              responseText,
            )
          } catch {
            console.warn('[FETCH_DEBUG] Could not read response text')
          }

          if (
            responseText.includes('expired') ||
            responseText.includes('Invalid')
          ) {
            console.log('[FETCH_DEBUG] Token expired, reloading page')
            alert(
              'ช่วงเวลาเข้าสู่ระบบหมดอายุ กำลังรีเฟรชหน้าเว็บเพื่อเข้าสู่ระบบใหม่',
            )
            window.location.reload()
            throw new Error(
              'LINE login session expired. Reloading application...',
            )
          }
        }

        return response
      } catch (error) {
        console.error('[FETCH_DEBUG] Fetch error occurred:', error)

        if (error instanceof TypeError) {
          console.error('[FETCH_DEBUG] TypeError details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
          })

          if (error.message.includes('Failed to fetch')) {
            console.error('[FETCH_DEBUG] Network error - Failed to fetch')
            throw new Error(
              `Network error: Cannot connect to ${url}. Please check your internet connection.`,
            )
          }
        }

        if (error instanceof Error) {
          console.error('[FETCH_DEBUG] Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
          })
        }

        throw error
      }
    },
    [liffObject],
  )

  useEffect(() => {
    // Wait for the LIFF SDK to load from the script tag
    const checkLiffSdk = () => {
      const liffInstance = (window as any).liff
      if (liffInstance && typeof liffInstance.init === 'function') {
        if (process.env.NODE_ENV === 'development') {
          console.log('[LIFF_DEBUG] window.liff is available.')
        }
        setLiffObject(liffInstance)
        setIsLiffSdkReady(true)
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log(
            '[LIFF_DEBUG] window.liff is NOT YET available or not fully loaded, retrying...',
          )
        }
        setTimeout(checkLiffSdk, 100) // Retry after 100ms
      }
    }
    checkLiffSdk()
  }, [])

  const initializeLiffAndLoadProfile = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        '[LIFF_DEBUG] useCallback for initializeLiffAndLoadProfile is being defined/redefined. Current lang in closure: ',
        currentLang,
      )
    }
    return async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '[LIFF_DEBUG] Step 1: Entering initializeLiffAndLoadProfile (async part).',
        )
        console.log(
          '[LIFF_DEBUG] Step 1.1: Current states - isLiffSdkReady:',
          isLiffSdkReady,
          'liffObject:',
          !!liffObject, // liffObject is now just `any`
          'error:',
          error,
          'isLiffInitialized:',
          isLiffInitialized,
        )
      }

      const currentLiff = liffObject || (window as any).liff // Ensure we use the liff instance

      if (!isLiffSdkReady || !currentLiff) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            '[LIFF_DEBUG] LIFF SDK not ready or liffObject is null, skipping initialization.',
          )
        }
        if (!error && !isLiffInitialized)
          setError('Waiting for LIFF SDK to load...')
        return
      }

      if (!LIFF_ID) {
        setError(translations[currentLang].liffIdMissingError)
        setIsLoadingProfile(false)
        return
      }
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '[LIFF_DEBUG] Starting initializeLiffAndLoadProfile. LIFF_ID:',
          LIFF_ID,
        )
      }

      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('[LIFF_DEBUG] Attempting currentLiff.init().')
        }
        await currentLiff.init({ liffId: LIFF_ID })
        if (process.env.NODE_ENV === 'development') {
          console.log(
            '[LIFF_DEBUG] Step 3: currentLiff.init() promise resolved.',
          )
        }

        await new Promise((resolve) => setTimeout(resolve, 100))
        if (process.env.NODE_ENV === 'development') {
          console.log(
            '[LIFF_DEBUG] Step 4: Delay finished. ตรวจสอบสถานะหลังจาก init',
          )
        }
        setIsLiffInitialized(true)
        if (process.env.NODE_ENV === 'development') {
          console.log('[LIFF_DEBUG] Step 4.1: isLiffInitialized set to true.')
        }

        try {
          const isLoggedIn = currentLiff.isLoggedIn()
          if (process.env.NODE_ENV === 'development') {
            console.log(
              '[LIFF_DEBUG] currentLiff.isLoggedIn() check:',
              isLoggedIn,
            )
          }

          if (!isLoggedIn) {
            console.log(
              '[LIFF_DEBUG] currentLiff.isLoggedIn() is false. Calling currentLiff.login().',
            )
            currentLiff.login()
            return
          }
          if (process.env.NODE_ENV === 'development') {
            console.log('[LIFF_DEBUG] currentLiff.isLoggedIn() is true.')
          }

          const token = currentLiff.getIDToken()
          setIdToken(token)
          if (process.env.NODE_ENV === 'development') {
            console.log('[LIFF_DEBUG] ID Token:', token ? 'Exists' : 'NULL')
          }

          // ตรวจสอบ token ว่าหมดอายุหรือยัง
          if (token && isTokenExpired(token)) {
            console.log(
              '[LIFF_DEBUG] Token is expired or about to expire. Re-login required.',
            )
            alert(
              'ช่วงเวลาเข้าสู่ระบบหมดอายุหรือกำลังจะหมดอายุ กำลังเข้าสู่ระบบใหม่',
            )
            currentLiff.login() // เข้าสู่ระบบใหม่
            return
          }

          const profile = await currentLiff.getProfile()
          setLineProfile(profile)
          setLineUserId(profile.userId)
          if (process.env.NODE_ENV === 'development') {
            console.log('[LIFF_DEBUG] Profile UserID:', profile.userId)
          }

          if (profile.userId && token) {
            try {
              console.log(
                '[LIFF_DEBUG] Fetching API profile for user (via /api/users/me). LIFF User ID will be derived from token by backend.',
              )
              console.log(
                '[LIFF_DEBUG] Step 7: About to call fetchWithTokenRetry for /api/users/me.',
              )
              const response = await fetchWithTokenRetry(
                `${apiBaseUrl}/api/users/me`,
              )
              console.log(
                '[LIFF_DEBUG] Step 8: fetchWithTokenRetry for /api/users/me completed. Response status:',
                response.status,
              )

              if (!response.ok) {
                if (response.status === 404) {
                  console.log(
                    '[LIFF_DEBUG] API Profile not found (404). Setting up for new user.',
                  )
                  setProfileError(translations[currentLang].noApiProfileData)
                  setUserProfileFromApi(null)
                  setFormData({
                    lineUserId: profile.userId,
                    displayName: profile.displayName,
                    pictureUrl: profile.pictureUrl,
                    language: currentLiff.getLanguage() === 'th' ? 'th' : 'en',
                  })
                  setIsEditMode(true)
                  setCurrentStep(1)
                } else {
                  const errorData = (await response
                    .json()
                    .catch(() => ({}))) as {
                    message?: string
                  }
                  console.error(
                    '[LIFF_DEBUG] API Profile fetch error:',
                    errorData,
                  )
                  throw new Error(
                    errorData?.message || `API Error: ${response.status}`,
                  )
                }
              } else {
                const data = (await response.json()) as SharedUserProfileDto
                console.log(
                  '[LIFF_DEBUG] Step 8.1: API Profile data received and parsed:',
                  data,
                )
                setUserProfileFromApi(data)
                setFormData(data)
                if (currentLang !== (data.language === 'th' ? 'th' : 'en')) {
                  setCurrentLang(data.language === 'th' ? 'th' : 'en')
                }
              }
            } catch (apiError: unknown) {
              console.error(
                '[LIFF_DEBUG] Step 8.E: API Profile Fetch Exception:',
                apiError,
              )
              // ✅ เพิ่ม fallback สำหรับกรณีที่ API ไม่ทำงาน
              if (
                apiError instanceof Error &&
                apiError.message.includes('Failed to fetch')
              ) {
                console.warn(
                  '[LIFF_DEBUG] API Connection failed, setting up for offline/fallback mode',
                )
                setProfileError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้')

                // ✅ ไม่ตั้ง demo data ให้ user กรอกข้อมูลเอง
                setUserProfileFromApi(null)
                setFormData({
                  lineUserId: profile.userId,
                  displayName: profile.displayName,
                  pictureUrl: profile.pictureUrl,
                  language: currentLiff.getLanguage() === 'th' ? 'th' : 'en',
                })
                setIsEditMode(true) // เข้าสู่โหมดแก้ไขเพื่อให้ user กรอกข้อมูล
                setCurrentStep(1)
              } else if (
                apiError instanceof Error &&
                apiError.message.includes('HTML instead of JSON')
              ) {
                console.error(
                  '[LIFF_DEBUG] Server returned HTML instead of JSON - likely a backend configuration issue',
                )
                setProfileError('เซิร์ฟเวอร์มีปัญหา กรุณาลองใหม่ภายหลัง')
                setUserProfileFromApi(null)
                setIsEditMode(true)
                setCurrentStep(1)
              } else {
                setProfileError(
                  `${translations[currentLang].apiFetchError}: ${
                    apiError instanceof Error
                      ? apiError.message
                      : String(apiError)
                  }`,
                )
              }
            }
          }
        } catch (loginError) {
          console.error(
            '[LIFF_DEBUG] Step 4.E: Error checking login status or getting profile/token:',
            loginError,
          )
          setError(
            `${translations[currentLang].liffInitError}: ${
              (loginError as { message?: string })?.message ||
              'Unknown LIFF error'
            }`,
          )
          setErrorCount((prev) => prev + 1)
        }
      } catch (initError: unknown) {
        console.error(
          '[LIFF_DEBUG] Step 3.E: Error during currentLiff.init():',
          initError,
        )
        setError(
          `${translations[currentLang].liffInitError}: ${
            (initError as { message?: string })?.message || 'Unknown LIFF error'
          }`,
        )
        setErrorCount((prev) => prev + 1)
      } finally {
        if (process.env.NODE_ENV === 'development') {
          console.log(
            '[LIFF_DEBUG] initializeLiffAndLoadProfile finally block.',
          )
        }
        setIsLoadingProfile(false)
      }
    }
  }, [
    isLiffSdkReady,
    liffObject,
    apiBaseUrl,
    currentLang,
    error,
    isLiffInitialized,
    fetchWithTokenRetry,
    setError,
    setIsLoadingProfile,
    setIsLiffInitialized,
    setIdToken,
    setLineProfile,
    setLineUserId,
    setProfileError,
    setUserProfileFromApi,
    setFormData,
    setIsEditMode,
    setCurrentStep,
    setErrorCount,
  ])

  useEffect(() => {
    console.log(
      '[LIFF_DEBUG] useEffect for initial load. States: isLiffSdkReady:',
      isLiffSdkReady,
      'liffObject:',
      !!liffObject,
      'userProfileFromApi:',
      !!userProfileFromApi,
      'isLoadingProfile:',
      isLoadingProfile,
      'error:',
      error,
      'errorCount:',
      errorCount,
    )

    const shouldAttemptLoad =
      isLiffSdkReady &&
      liffObject &&
      !userProfileFromApi &&
      errorCount < 3 &&
      !hasInitiatedLoad // ใช้ state แทน window

    if (shouldAttemptLoad) {
      setHasInitiatedLoad(true) // ใช้ state แทน window

      console.log(
        '[LIFF_DEBUG_PINNED] Starting load sequence - first and only attempt',
      )

      const liffIdMissingErrorText = translations['en'].liffIdMissingError
      const criticalErrors = [liffIdMissingErrorText]

      console.log(
        '[LIFF_DEBUG_PINNED] Breaking potential deadlock. Current isLoadingProfile:',
        isLoadingProfile,
      )
      console.log(
        '[LIFF_DEBUG_PINNED] Checking condition for triggering load. Error state:',
        error,
      )
      const isErrorPreventingLoad =
        error && criticalErrors.some((e) => error.startsWith(e))
      console.log(
        '[LIFF_DEBUG_PINNED] Is error preventing load? (error && criticalErrors.some()):',
        isErrorPreventingLoad,
      )

      if (!error || !isErrorPreventingLoad) {
        console.log(
          '[LIFF_DEBUG] Triggering initial profile load logic (useEffect) despite isLoadingProfile=true.',
        )
        setIsLoadingProfile(true)
        void initializeLiffAndLoadProfile()()
      } else {
        console.warn(
          '[LIFF_DEBUG] Load NOT triggered because of existing error or critical error condition.',
          { error, isErrorPreventingLoad },
        )
        setHasInitiatedLoad(false) // ใช้ state แทน window
      }
    } else if (errorCount >= 3) {
      console.warn(
        '[LIFF_DEBUG] Stopped retry attempts after 3 errors. Please reload manually.',
      )
    }
  }, [
    isLiffSdkReady,
    liffObject,
    userProfileFromApi,
    isLoadingProfile,
    error,
    initializeLiffAndLoadProfile,
    errorCount,
    hasInitiatedLoad,
  ])

  // ตรวจสอบอายุของ token ทุกๆ นาที และรีเฟรชหากใกล้หมดอายุ
  useEffect(() => {
    if (!liffObject || !isLiffInitialized) return

    // ตรวจสอบ token ทุกๆ 1 นาที
    const tokenCheckInterval = setInterval(() => {
      if (liffObject.isLoggedIn()) {
        const currentToken = liffObject.getIDToken()
        if (currentToken && isTokenExpired(currentToken)) {
          console.log(
            '[TOKEN_DEBUG] Token is expiring soon. Will refresh session.',
          )

          // แสดงข้อความแจ้งเตือนผู้ใช้
          if (
            confirm(
              'ช่วงเวลาเข้าสู่ระบบกำลังจะหมดอายุ ต้องการเข้าสู่ระบบใหม่อัตโนมัติหรือไม่?',
            )
          ) {
            // หากผู้ใช้ตกลง ทำการรีเฟรชหน้าเพื่อเข้าสู่ระบบใหม่
            window.location.reload()
          }
        }
      }
    }, 60000) // ตรวจสอบทุก 1 นาที

    return () => clearInterval(tokenCheckInterval)
  }, [liffObject, isLiffInitialized])

  useEffect(() => {
    setFormData((prev) => ({ ...prev, language: currentLang }))
  }, [currentLang])

  const getBmiStatus = (
    bmi: number | null | string,
    lang: 'th' | 'en',
  ): string => {
    const bmiVal = typeof bmi === 'string' ? parseFloat(bmi) : bmi
    if (bmiVal === null || isNaN(bmiVal)) return '-'

    const statusesTh = {
      underweight: 'น้ำหนักน้อยกว่าเกณฑ์',
      normal: 'น้ำหนักตามเกณฑ์',
      overweight: 'น้ำหนักเกินเกณฑ์ (ท้วม)',
      obese1: 'โรคอ้วนระดับ 1 (อ้วน)',
      obese2: 'โรคอ้วนระดับ 2 (อ้วนมาก)',
      obese3: 'โรคอ้วนระดับ 3 (อ้วนอันตราย)',
    }
    const statusesEn = {
      underweight: 'Underweight',
      normal: 'Normal weight',
      overweight: 'Overweight',
      obese1: 'Obesity Class 1',
      obese2: 'Obesity Class 2',
      obese3: 'Obesity Class 3 (Dangerously Obese)',
    }
    const S = lang === 'th' ? statusesTh : statusesEn

    if (bmiVal < 18.5) return S.underweight
    if (bmiVal < 23) return S.normal
    if (bmiVal < 25) return S.overweight
    if (bmiVal < 30) return S.obese1
    if (bmiVal < 35) return S.obese2
    return S.obese3
  }

  const getGenderDisplay = (genderKey?: Gender): string | undefined => {
    if (!genderKey) return undefined
    const key = genderKey.toLowerCase()
    if (key === 'male') return T.male
    if (key === 'female') return T.female
    if (key.startsWith('lgbtq_')) return T.other
    if (key === 'other') return T.other
    return undefined
  }

  const getActivityLevelDisplay = (
    levelKey?: ActivityLevel,
  ): string | undefined => {
    if (!levelKey) return undefined
    return T.activityLevelOptions[levelKey] || undefined
  }

  const getDietTypeDisplay = (dietKey?: DietType): string | undefined => {
    if (!dietKey) return undefined
    return T.dietTypeOptions[dietKey] || undefined
  }

  const getGoalDisplay = (goalKey?: string): string | undefined => {
    if (!goalKey) return undefined
    return T.goalOptions[goalKey] || undefined
  }

  const getPregnancyStatusDisplay = (
    statusKey?: PregnancyLactationStatus,
  ): string | undefined => {
    if (!statusKey) return undefined
    return T.pregnancyOptions[statusKey] || undefined
  }

  const calculatedBmi = useMemo(() => {
    if (formData.weightKg && formData.heightCm) {
      const heightM = formData.heightCm / 100
      return (formData.weightKg / (heightM * heightM)).toFixed(1)
    }
    return null
  }, [formData.weightKg, formData.heightCm])

  const calculatedAge = useMemo(() => {
    if (formData.birthDate && isValid(parseISO(formData.birthDate))) {
      return differenceInYears(new Date(), parseISO(formData.birthDate))
    }
    return formData.age
  }, [formData.birthDate, formData.age])

  const handleInputChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }
    >,
  ) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement
    const { name, value, type } = target

    let processedValue: string | number | string[] | undefined = value
    if (type === 'number') {
      processedValue = value === '' ? undefined : Number(value)
    }

    setFormData((prev) => ({ ...prev, [name]: processedValue }))
  }

  const handleGenderChange = (
    event: React.MouseEvent<HTMLElement>,
    newGender: string | null,
  ) => {
    if (newGender !== null) {
      setFormData((prev) => ({ ...prev, gender: newGender as Gender }))
    }
  }

  const handleSelectChange = (event: SelectChangeEvent<any>) => {
    // Event target มี type 'any' แต่เราสามารถตั้งค่า known type ได้
    type SelectTargetType = { name: string; value: unknown }
    const target = event.target as SelectTargetType
    const name = target.name
    const value = target.value
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Checkbox handling functions
  const handleCheckboxChange = (
    value: string,
    selectedArray: string[],
    setSelectedArray: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    if (selectedArray.includes(value)) {
      setSelectedArray(selectedArray.filter((item) => item !== value))
    } else {
      setSelectedArray([...selectedArray, value])
    }
  }

  const handleOtherInputChange = (
    value: string,
    setOtherValue: React.Dispatch<React.SetStateAction<string>>,
    selectedArray: string[],
    setSelectedArray: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setOtherValue(value)

    // Auto-add "other" to selection if not already present and value is not empty
    if (value.trim() && !selectedArray.includes('other')) {
      setSelectedArray([...selectedArray, 'other'])
    } else if (!value.trim() && selectedArray.includes('other')) {
      setSelectedArray(selectedArray.filter((item) => item !== 'other'))
    }
  }

  const handleSave = async () => {
    console.log('[PROFILE_DEBUG] ========== SAVE PROFILE STARTED ==========')
    console.log('[PROFILE_DEBUG] handleSave called')
    console.log('[PROFILE_DEBUG] lineUserId:', lineUserId)
    console.log('[PROFILE_DEBUG] idToken exists:', !!idToken)
    console.log('[PROFILE_DEBUG] liffObject exists:', !!liffObject)
    console.log('[PROFILE_DEBUG] isLoggedIn:', liffObject?.isLoggedIn())
    console.log('[PROFILE_DEBUG] apiBaseUrl:', apiBaseUrl)

    if (!lineUserId || !idToken) {
      console.error('[PROFILE_DEBUG] Missing lineUserId or idToken')
      console.error('[PROFILE_DEBUG] lineUserId:', lineUserId)
      console.error('[PROFILE_DEBUG] idToken:', !!idToken)
      setSaveError(T.idTokenMissingError)
      return
    }

    console.log('[PROFILE_DEBUG] Validation passed, starting save process...')
    setIsSavingProfile(true)
    setSaveError(null)
    setSaveSuccess(false)

    // Process checkbox selections and combine with "other" inputs
    const processCheckboxData = (
      selected: string[],
      otherText: string,
      options: Array<{ value: string; labelTh: string; labelEn: string }>,
    ): string[] => {
      const result: string[] = []

      selected.forEach((value) => {
        if (value === 'other' && otherText.trim()) {
          result.push(otherText.trim())
        } else if (value !== 'other') {
          const option = options.find((opt) => opt.value === value)
          result.push(
            option
              ? currentLang === 'th'
                ? option.labelTh
                : option.labelEn
              : value,
          )
        }
      })

      return result
    }

    // คำนวณค่าโภชนาการ
    let calculatedBmr: number | undefined
    let calculatedTdee: number | undefined
    let targetCalories: number | undefined
    let nutritionGoals: NutritionGoals | undefined

    if (
      formData.gender &&
      calculatedAge &&
      formData.weightKg &&
      formData.heightCm &&
      formData.activityLevel &&
      formData.goal
    ) {
      const profile: NutritionUserProfile = {
        gender: formData.gender as 'male' | 'female' | 'other',
        age: calculatedAge,
        weightKg: formData.weightKg,
        heightCm: formData.heightCm,
        activityLevel: formData.activityLevel as any,
        goal: formData.goal as any,
        dietType: formData.dietType as any,
      }

      if (validateUserProfileForCalculation(profile)) {
        calculatedBmr = Math.round(calculateBMR(profile))
        calculatedTdee = Math.round(calculateTDEE(profile))
        targetCalories = calculateTargetCalories(profile)
        nutritionGoals = calculateNutritionGoals(profile)

        console.log('[PROFILE_DEBUG] Calculated nutrition values:', {
          calculatedBmr,
          calculatedTdee,
          targetCalories,
          nutritionGoals,
        })
      }
    }

    const payload = {
      ...formData,
      age:
        calculatedAge !== undefined && !isNaN(calculatedAge)
          ? calculatedAge
          : undefined,
      weightKg: formData.weightKg ? Number(formData.weightKg) : undefined,
      heightCm: formData.heightCm ? Number(formData.heightCm) : undefined,

      // เพิ่มค่าที่คำนวณได้
      calculatedBmr: calculatedBmr || null,
      calculatedTdee: calculatedTdee || null,
      targetWeightKg: targetCalories || null, // อาจจะต้องปรับตามความต้องการ

      // เพิ่มเป้าหมายสารอาหาร
      ...(nutritionGoals && {
        dailyCaloriesGoal: nutritionGoals.calories,
        dailyProteinGoal: nutritionGoals.protein,
        dailyCarbsGoal: nutritionGoals.carbs,
        dailyFatGoal: nutritionGoals.fat,
        dailyFiberGoal: nutritionGoals.fiber,
        dailySugarGoal: nutritionGoals.sugar,
        dailySodiumGoal: nutritionGoals.sodium,
        dailyWaterGoal: nutritionGoals.water,
        dailyCholesterolGoal: nutritionGoals.cholesterol,
        dailySaturatedFatGoal: nutritionGoals.saturated_fat,
        dailyOmega3Goal: nutritionGoals.omega3,
      }),

      // Process checkbox data
      foodAllergies: processCheckboxData(
        selectedFoodAllergies,
        otherFoodAllergy,
        foodAllergyOptions,
      ),
      healthConditions: processCheckboxData(
        selectedHealthConditions,
        otherHealthCondition,
        healthConditionOptions,
      ),
      ethicalFoodConsiderations: processCheckboxData(
        selectedEthicalConsiderations,
        otherEthicalConsideration,
        ethicalConsiderationOptions,
      ),
      preferredCuisine: processCheckboxData(
        selectedCuisinePreferences,
        otherCuisinePreference,
        cuisinePreferenceOptions,
      ),
      preferredFlavorProfiles: processCheckboxData(
        selectedFlavorPreferences,
        otherFlavorPreference,
        flavorPreferenceOptions,
      ),
    } as SharedUpdateUserProfileDto

    if ('lineUserId' in payload) {
      delete (payload as Partial<SharedUserProfileDto>).lineUserId
    }

    console.log('[PROFILE_DEBUG] Payload prepared:', payload)
    console.log('[PROFILE_DEBUG] API Base URL:', apiBaseUrl)

    try {
      console.log('[PROFILE_DEBUG] About to call fetchWithTokenRetry...')
      console.log('[PROFILE_DEBUG] Target URL:', `${apiBaseUrl}/api/users/me`)
      console.log('[PROFILE_DEBUG] Method: PUT')
      console.log(
        '[PROFILE_DEBUG] Payload size:',
        JSON.stringify(payload).length,
        'characters',
      )

      // เปลี่ยน endpoint ให้ตรงกับที่ใช้ในการ fetch profile
      const response = await fetchWithTokenRetry(`${apiBaseUrl}/api/users/me`, {
        method: 'PUT', // ยังคงใช้ PUT method
        body: JSON.stringify(payload),
      })

      console.log('[PROFILE_DEBUG] ========== RESPONSE RECEIVED ==========')
      console.log('[PROFILE_DEBUG] fetchWithTokenRetry completed')
      console.log('[PROFILE_DEBUG] Response status:', response.status)
      console.log('[PROFILE_DEBUG] Response ok:', response.ok)
      console.log('[PROFILE_DEBUG] Response statusText:', response.statusText)

      if (!response.ok) {
        let errorMessage = `API Error: ${response.status}`
        try {
          const errorData = (await response.json()) as { message?: string }
          errorMessage = errorData?.message || errorMessage
          console.error('[PROFILE_DEBUG] API save error details:', errorData)
        } catch (jsonError) {
          console.error(
            '[PROFILE_DEBUG] Could not parse error response:',
            jsonError,
          )
        }
        throw new Error(errorMessage)
      }

      const updatedProfile = (await response.json()) as SharedUserProfileDto
      console.log(
        '[PROFILE_DEBUG] Profile updated successfully:',
        updatedProfile,
      )

      // --- START: Save essential profile data to localStorage for Report Views ---
      if (lineUserId && updatedProfile) {
        // Define StoredUserProfile interface structure (mirroring what Report Views expect)
        // Loosen types for goal, activityLevel, and dietType to string | undefined to resolve linter errors
        // The actual string values from SharedUserProfileDto will be used, which are what calculateNutritionGoals expects.
        interface StoredUserProfile {
          gender?: 'male' | 'female' | 'other' // Keep specific for clarity, ensure only one declaration
          age?: number
          weightKg?: number
          heightCm?: number
          activityLevel?: string // Loosened from specific enum/literals
          goal?: string // Loosened from specific enum/literals
          dietType?: string // Loosened from specific enum/literals
          // เพิ่มข้อมูลการคำนวณ
          calculatedBmr?: number
          calculatedTdee?: number
          dailyCaloriesGoal?: number
          dailyProteinGoal?: number
          dailyCarbsGoal?: number
          dailyFatGoal?: number
          dailyFiberGoal?: number
          dailyWaterGoal?: number
        }

        const storedProfileData: StoredUserProfile = {
          gender: updatedProfile.gender as StoredUserProfile['gender'], // Correctly assigns value here
          age: updatedProfile.age,
          weightKg: updatedProfile.weightKg,
          heightCm: updatedProfile.heightCm,
          activityLevel: updatedProfile.activityLevel as string, // Cast to string
          goal: updatedProfile.goal as string, // Cast to string
          dietType: updatedProfile.dietType as string, // Cast to string
          // เพิ่มข้อมูลการคำนวณ
          calculatedBmr: updatedProfile.calculatedBmr ?? undefined,
          calculatedTdee: updatedProfile.calculatedTdee ?? undefined,
          dailyCaloriesGoal: (updatedProfile as any).dailyCaloriesGoal,
          dailyProteinGoal: (updatedProfile as any).dailyProteinGoal,
          dailyCarbsGoal: (updatedProfile as any).dailyCarbsGoal,
          dailyFatGoal: (updatedProfile as any).dailyFatGoal,
          dailyFiberGoal: (updatedProfile as any).dailyFiberGoal,
          dailyWaterGoal: (updatedProfile as any).dailyWaterGoal,
        }

        try {
          localStorage.setItem(
            `userProfile_${lineUserId}`,
            JSON.stringify(storedProfileData),
          )
          console.log(
            '[PROFILE_DEBUG] User profile data saved to localStorage:',
            storedProfileData,
          )
        } catch (e) {
          console.error(
            '[PROFILE_DEBUG] Error saving user profile to localStorage:',
            e,
          )
        }
      }
      // --- END: Save essential profile data to localStorage ---

      setUserProfileFromApi(updatedProfile)
      setFormData(updatedProfile)
      setCurrentLang(updatedProfile.language === 'th' ? 'th' : 'en')
      setSaveSuccess(true)
      setIsEditMode(false)
      setCurrentStep(1)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: unknown) {
      console.error('[PROFILE_DEBUG] Save Profile Error:', err)

      let errorMessage = 'Unknown error'
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'string') {
        errorMessage = err
      }

      setSaveError(`${T.apiSaveError}: ${errorMessage}`)
      setTimeout(() => setSaveError(null), 5000)
    } finally {
      console.log('[PROFILE_DEBUG] Save process completed')
      setIsSavingProfile(false)
    }
  }

  const handleNextStep = () => setCurrentStep((prev) => prev + 1)
  const handlePrevStep = () => setCurrentStep((prev) => prev - 1)

  // Section editing functions - ฟังก์ชันสำหรับการแก้ไขทีละส่วน
  const toggleSectionEdit = (section: keyof typeof editingSections) => {
    setEditingSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
    // ถ้าเปิด edit mode ใหม่ ให้อัปเดต formData ด้วยข้อมูลปัจจุบัน
    if (!editingSections[section] && userProfileFromApi) {
      setFormData(userProfileFromApi)
    }
  }

  const cancelSectionEdit = (section: keyof typeof editingSections) => {
    setEditingSections((prev) => ({
      ...prev,
      [section]: false,
    }))
    // Reset formData to original values
    if (userProfileFromApi) {
      setFormData(userProfileFromApi)
    }
  }

  // Save individual section
  const handleSectionSave = async (section: keyof typeof editingSections) => {
    if (!lineUserId || !idToken) {
      setSaveError(T.idTokenMissingError)
      return
    }

    setIsSavingProfile(true)
    setSaveError(null)

    // Helper function for processing checkbox data
    const processCheckboxData = (
      selected: string[],
      otherText: string,
      options: Array<{ value: string; labelTh: string; labelEn: string }>,
    ): string[] => {
      const result: string[] = []
      selected.forEach((value) => {
        if (value === 'other' && otherText.trim()) {
          result.push(otherText.trim())
        } else if (value !== 'other') {
          const option = options.find((opt) => opt.value === value)
          result.push(
            option
              ? currentLang === 'th'
                ? option.labelTh
                : option.labelEn
              : value,
          )
        }
      })
      return result
    }

    try {
      // Prepare payload for the specific section
      let sectionPayload: SharedUpdateUserProfileDto = {}

      switch (section) {
        case 'basic':
          sectionPayload = {
            displayName: formData.displayName,
            birthDate: formData.birthDate,
            age:
              calculatedAge !== undefined && !isNaN(calculatedAge)
                ? calculatedAge
                : undefined,
            gender: formData.gender,
          }
          break
        case 'goals':
          sectionPayload = {
            goal: formData.goal,
            activityLevel: formData.activityLevel,
            dietType: formData.dietType,
          }
          break
        case 'health':
          sectionPayload = {
            foodAllergies: processCheckboxData(
              selectedFoodAllergies,
              otherFoodAllergy,
              foodAllergyOptions,
            ),
            healthConditions: processCheckboxData(
              selectedHealthConditions,
              otherHealthCondition,
              healthConditionOptions,
            ),
          }
          break
        case 'lifestyle':
          sectionPayload = {
            pregnancyLactationStatus: formData.pregnancyLactationStatus,
            ethicalFoodConsiderations: processCheckboxData(
              selectedEthicalConsiderations,
              otherEthicalConsideration,
              ethicalConsiderationOptions,
            ),
            preferredCuisine: processCheckboxData(
              selectedCuisinePreferences,
              otherCuisinePreference,
              cuisinePreferenceOptions,
            ),
            preferredFlavorProfiles: processCheckboxData(
              selectedFlavorPreferences,
              otherFlavorPreference,
              flavorPreferenceOptions,
            ),
          }
          break
        case 'body':
          sectionPayload = {
            weightKg: formData.weightKg ? Number(formData.weightKg) : undefined,
            heightCm: formData.heightCm ? Number(formData.heightCm) : undefined,
          }
          break
      }

      // Remove lineUserId if it exists
      if ('lineUserId' in sectionPayload) {
        delete (sectionPayload as Partial<SharedUserProfileDto>).lineUserId
      }

      const response = await fetchWithTokenRetry(`${apiBaseUrl}/api/users/me`, {
        method: 'PUT',
        body: JSON.stringify(sectionPayload),
      })

      if (!response.ok) {
        let errorMessage = `API Error: ${response.status}`
        try {
          const errorData = (await response.json()) as { message?: string }
          errorMessage = errorData?.message || errorMessage
        } catch (jsonError) {
          console.error('Could not parse error response:', jsonError)
        }
        throw new Error(errorMessage)
      }

      const updatedProfile = (await response.json()) as SharedUserProfileDto

      // Update states
      setUserProfileFromApi(updatedProfile)
      setFormData(updatedProfile)
      setCurrentLang(updatedProfile.language === 'th' ? 'th' : 'en')
      setSaveSuccess(true)

      // Close edit mode for this section
      setEditingSections((prev) => ({
        ...prev,
        [section]: false,
      }))

      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: unknown) {
      console.error('Save Section Error:', err)
      let errorMessage = 'Unknown error'
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      setSaveError(`${T.apiSaveError}: ${errorMessage}`)
      setTimeout(() => setSaveError(null), 5000)
    } finally {
      setIsSavingProfile(false)
    }
  }

  // Edit menu handlers
  const handleEditMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setEditMenuAnchor(event.currentTarget)
  }

  const handleEditMenuClose = () => {
    setEditMenuAnchor(null)
  }

  const handleEditSection = (section: keyof typeof editingSections) => {
    // First, update formData with current API data
    if (userProfileFromApi) {
      setFormData(userProfileFromApi)
    }

    // Open the section for editing
    setEditingSections((prev) => ({
      ...prev,
      [section]: true,
    }))

    // Close menu
    handleEditMenuClose()
  }

  useEffect(() => {
    if (
      error &&
      (error.includes('LIFF ID') || error.includes('LIFF initialization'))
    ) {
      console.error(
        'Critical LIFF error, navigation to report page might be blocked.',
      )
    }
  }, [error])

  // เพิ่ม useEffect เพื่อ sync checkbox states กับข้อมูล profile ที่มีอยู่
  useEffect(() => {
    if (userProfileFromApi && isEditMode) {
      // Initialize checkbox states from API data
      if (userProfileFromApi.foodAllergies) {
        const allergies = userProfileFromApi.foodAllergies
        const mappedAllergies: string[] = []
        let otherAllergies = ''

        allergies.forEach((allergy) => {
          const found = foodAllergyOptions.find(
            (option) =>
              option.labelTh === allergy || option.labelEn === allergy,
          )
          if (found) {
            mappedAllergies.push(found.value)
          } else {
            otherAllergies += (otherAllergies ? ', ' : '') + allergy
          }
        })

        if (otherAllergies) {
          mappedAllergies.push('other')
          setOtherFoodAllergy(otherAllergies)
        }

        setSelectedFoodAllergies(mappedAllergies)
      }

      if (userProfileFromApi.healthConditions) {
        const conditions = userProfileFromApi.healthConditions
        const mappedConditions: string[] = []
        let otherConditions = ''

        conditions.forEach((condition) => {
          const found = healthConditionOptions.find(
            (option) =>
              option.labelTh === condition || option.labelEn === condition,
          )
          if (found) {
            mappedConditions.push(found.value)
          } else {
            otherConditions += (otherConditions ? ', ' : '') + condition
          }
        })

        if (otherConditions) {
          mappedConditions.push('other')
          setOtherHealthCondition(otherConditions)
        }

        setSelectedHealthConditions(mappedConditions)
      }

      if (userProfileFromApi.ethicalFoodConsiderations) {
        const considerations = userProfileFromApi.ethicalFoodConsiderations
        const mappedConsiderations: string[] = []
        let otherConsiderations = ''

        considerations.forEach((consideration) => {
          const found = ethicalConsiderationOptions.find(
            (option) =>
              option.labelTh === consideration ||
              option.labelEn === consideration,
          )
          if (found) {
            mappedConsiderations.push(found.value)
          } else {
            otherConsiderations +=
              (otherConsiderations ? ', ' : '') + consideration
          }
        })

        if (otherConsiderations) {
          mappedConsiderations.push('other')
          setOtherEthicalConsideration(otherConsiderations)
        }

        setSelectedEthicalConsiderations(mappedConsiderations)
      }

      if (userProfileFromApi.preferredCuisine) {
        const cuisines = userProfileFromApi.preferredCuisine
        const mappedCuisines: string[] = []
        let otherCuisines = ''

        cuisines.forEach((cuisine) => {
          const found = cuisinePreferenceOptions.find(
            (option) =>
              option.labelTh === cuisine || option.labelEn === cuisine,
          )
          if (found) {
            mappedCuisines.push(found.value)
          } else {
            otherCuisines += (otherCuisines ? ', ' : '') + cuisine
          }
        })

        if (otherCuisines) {
          mappedCuisines.push('other')
          setOtherCuisinePreference(otherCuisines)
        }

        setSelectedCuisinePreferences(mappedCuisines)
      }

      if (userProfileFromApi.preferredFlavorProfiles) {
        const flavors = userProfileFromApi.preferredFlavorProfiles
        const mappedFlavors: string[] = []
        let otherFlavors = ''

        flavors.forEach((flavor) => {
          const found = flavorPreferenceOptions.find(
            (option) => option.labelTh === flavor || option.labelEn === flavor,
          )
          if (found) {
            mappedFlavors.push(found.value)
          } else {
            otherFlavors += (otherFlavors ? ', ' : '') + flavor
          }
        })

        if (otherFlavors) {
          mappedFlavors.push('other')
          setOtherFlavorPreference(otherFlavors)
        }

        setSelectedFlavorPreferences(mappedFlavors)
      }
    }
  }, [userProfileFromApi, isEditMode])

  if (!isLiffSdkReady || isLoadingProfile) {
    // REMOVED isPendingNavigation from this condition
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container sx={{ textAlign: 'center', mt: 4 }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>
            {!isLiffSdkReady
              ? 'กำลังโหลด LIFF SDK...'
              : !isLiffInitialized
                ? T.loadingLiff
                : // : isPendingNavigation // REMOVED
                  //   ? '🚀 กำลังนำทางไปหน้าที่ต้องการ...' // REMOVED
                  T.loadingProfile}
          </Typography>
          {/* {isPendingNavigation && ( // REMOVED
            <Typography variant="caption" sx={{ mt: 1, opacity: 0.7 }}>
              ตรวจพบการเข้าถึงผ่าน Deep Link
            </Typography>
          )} */}
        </Container>
      </ThemeProvider>
    )
  }

  if (error && !lineUserId) {
    // Critical LIFF errors before profile loaded
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container sx={{ textAlign: 'center', mt: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      </ThemeProvider>
    )
  }

  const renderStep3Content = () => (
    <Box>
      {/* Food Allergies Accordion */}
      <Accordion defaultExpanded sx={{ mb: 2 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="food-allergies-content"
          id="food-allergies-header"
        >
          <Typography variant="h6">{T.foodAllergiesLabel}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormGroup>
            {foodAllergyOptions.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    checked={selectedFoodAllergies.includes(option.value)}
                    onChange={() =>
                      handleCheckboxChange(
                        option.value,
                        selectedFoodAllergies,
                        setSelectedFoodAllergies,
                      )
                    }
                  />
                }
                label={getLocalizedOptionLabel(option, currentLang)}
              />
            ))}
          </FormGroup>
          {selectedFoodAllergies.includes('other') && (
            <TextField
              fullWidth
              margin="normal"
              size="small"
              label={
                currentLang === 'th'
                  ? 'ระบุอาหารที่แพ้อื่นๆ'
                  : 'Specify other allergies'
              }
              value={otherFoodAllergy}
              onChange={(e) =>
                handleOtherInputChange(
                  e.target.value,
                  setOtherFoodAllergy,
                  selectedFoodAllergies,
                  setSelectedFoodAllergies,
                )
              }
              placeholder={
                currentLang === 'th'
                  ? 'เช่น ถั่วอัลมอนด์, สับปะรด'
                  : 'e.g. almonds, pineapple'
              }
            />
          )}
        </AccordionDetails>
      </Accordion>

      {/* Health Conditions Accordion */}
      <Accordion defaultExpanded sx={{ mb: 2 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="health-conditions-content"
          id="health-conditions-header"
        >
          <Typography variant="h6">{T.healthConditionsLabel}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormGroup>
            {healthConditionOptions.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    checked={selectedHealthConditions.includes(option.value)}
                    onChange={() =>
                      handleCheckboxChange(
                        option.value,
                        selectedHealthConditions,
                        setSelectedHealthConditions,
                      )
                    }
                  />
                }
                label={getLocalizedOptionLabel(option, currentLang)}
              />
            ))}
          </FormGroup>
          {selectedHealthConditions.includes('other') && (
            <TextField
              fullWidth
              margin="normal"
              size="small"
              label={
                currentLang === 'th'
                  ? 'ระบุโรคประจำตัวอื่นๆ'
                  : 'Specify other conditions'
              }
              value={otherHealthCondition}
              onChange={(e) =>
                handleOtherInputChange(
                  e.target.value,
                  setOtherHealthCondition,
                  selectedHealthConditions,
                  setSelectedHealthConditions,
                )
              }
              placeholder={
                currentLang === 'th'
                  ? 'เช่น โรคผิวหนัง, โรคภูมิแพ้'
                  : 'e.g. skin conditions, allergies'
              }
            />
          )}
        </AccordionDetails>
      </Accordion>

      {/* Ethical Considerations Accordion */}
      <Accordion sx={{ mb: 2 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="ethical-considerations-content"
          id="ethical-considerations-header"
        >
          <Typography variant="h6">{T.ethicalConsiderationsLabel}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormGroup>
            {ethicalConsiderationOptions.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    checked={selectedEthicalConsiderations.includes(
                      option.value,
                    )}
                    onChange={() =>
                      handleCheckboxChange(
                        option.value,
                        selectedEthicalConsiderations,
                        setSelectedEthicalConsiderations,
                      )
                    }
                  />
                }
                label={getLocalizedOptionLabel(option, currentLang)}
              />
            ))}
          </FormGroup>
          {selectedEthicalConsiderations.includes('other') && (
            <TextField
              fullWidth
              margin="normal"
              size="small"
              label={
                currentLang === 'th'
                  ? 'ระบุข้อพิจารณาอื่นๆ'
                  : 'Specify other considerations'
              }
              value={otherEthicalConsideration}
              onChange={(e) =>
                handleOtherInputChange(
                  e.target.value,
                  setOtherEthicalConsideration,
                  selectedEthicalConsiderations,
                  setSelectedEthicalConsiderations,
                )
              }
              placeholder={
                currentLang === 'th'
                  ? 'เช่น ไม่ทานเนื้อแกะ, โคเชอร์'
                  : 'e.g. no lamb, kosher'
              }
            />
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  )

  const renderEditModeContent = () => (
    <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" gutterBottom component="div">
        {T.userProfileTitle}
      </Typography>
      <Stepper activeStep={currentStep - 1} alternativeLabel sx={{ mb: 3 }}>
        {[
          T.step1Title,
          T.step5Title, // ย้าย "ข้อมูลร่างกาย" มาเป็น step 2
          T.step2Title, // "เป้าหมายและไลฟ์สไตล์" เป็น step 3
          T.step3Title,
          T.step4Title,
          T.step6Title,
        ].map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step 1: ข้อมูลพื้นฐาน */}
      {currentStep === 1 && (
        <>
          <FormControl fullWidth margin="normal">
            <InputLabel id="language-select-label">
              {T.languageLabel}
            </InputLabel>
            <Select
              labelId="language-select-label"
              name="language"
              value={currentLang}
              label={T.languageLabel}
              onChange={(e) => setCurrentLang(e.target.value)}
            >
              <MenuItem value="th">ภาษาไทย</MenuItem>
              <MenuItem value="en">English</MenuItem>
            </Select>
            <FormHelperText>{T.languageHelper}</FormHelperText>
          </FormControl>
          <TextField
            label={T.nicknameLabel}
            name="displayName"
            value={formData.displayName || ''}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
            helperText={T.nicknameHelper}
          />
          <LocalizationProvider
            dateAdapter={AdapterDateFns}
            adapterLocale={currentLang === 'th' ? th : enUS}
          >
            <DatePicker
              label={T.birthdateLabel}
              value={formData.birthDate ? parseISO(formData.birthDate) : null}
              onChange={(newValue) =>
                setFormData((prev) => ({
                  ...prev,
                  birthDate: newValue
                    ? format(newValue, 'yyyy-MM-dd')
                    : undefined,
                }))
              }
              sx={{ width: '100%', mt: 2, mb: 1 }}
            />
          </LocalizationProvider>
          <FormHelperText>{T.birthdateHelper}</FormHelperText>
          {calculatedAge !== undefined && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {T.ageLabel}: {calculatedAge}{' '}
              {currentLang === 'th' ? 'ปี' : 'years'}
            </Typography>
          )}
          <FormControl component="fieldset" margin="normal" fullWidth>
            <Typography variant="subtitle1" gutterBottom>
              {T.genderLabel}
            </Typography>
            <ToggleButtonGroup
              value={formData.gender || ''}
              exclusive
              onChange={handleGenderChange}
              aria-label="gender selection"
              fullWidth
            >
              <ToggleButton value="male" aria-label="male">
                {T.male}
              </ToggleButton>
              <ToggleButton value="female" aria-label="female">
                {T.female}
              </ToggleButton>
              <ToggleButton value="other" aria-label="other">
                {T.other}
              </ToggleButton>
            </ToggleButtonGroup>
            <FormHelperText>{T.genderHelper}</FormHelperText>
          </FormControl>
        </>
      )}

      {/* Step 2: ข้อมูลร่างกาย (ย้ายมาจาก step 5) */}
      {currentStep === 2 && (
        <>
          <TextField
            label={T.weightLabel}
            name="weightKg"
            type="number"
            value={formData.weightKg || ''}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
            helperText={T.weightHelper}
            InputProps={{ inputProps: { min: 0, step: 0.1 } }}
          />
          <TextField
            label={T.heightLabel}
            name="heightCm"
            type="number"
            value={formData.heightCm || ''}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
            helperText={T.heightHelper}
            InputProps={{ inputProps: { min: 0, step: 1 } }}
          />
          {calculatedBmi && (
            <Typography variant="body1" sx={{ mt: 1 }}>
              {T.bmiCalculatedLabel} {calculatedBmi} (
              {getBmiStatus(calculatedBmi, currentLang)})
            </Typography>
          )}
        </>
      )}

      {/* Step 3: เป้าหมายและไลฟ์สไตล์ + การคำนวณ */}
      {currentStep === 3 && (
        <>
          <FormControl fullWidth margin="normal">
            <InputLabel id="goal-label">{T.goalLabel}</InputLabel>
            <Select
              labelId="goal-label"
              name="goal"
              value={formData.goal || ''}
              onChange={handleSelectChange}
              label={T.goalLabel}
            >
              {goalOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {getLocalizedOptionLabel(option, currentLang)}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{T.goalHelper}</FormHelperText>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel id="activity-level-label">
              {T.activityLevelLabel}
            </InputLabel>
            <Select
              labelId="activity-level-label"
              name="activityLevel"
              value={formData.activityLevel || ''}
              onChange={handleSelectChange}
              label={T.activityLevelLabel}
            >
              {activityLevelOptionsList.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {getLocalizedOptionLabel(option, currentLang)}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{T.activityLevelHelper}</FormHelperText>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel id="diet-type-label">{T.dietTypeLabel}</InputLabel>
            <Select
              labelId="diet-type-label"
              name="dietType"
              value={formData.dietType || ''}
              onChange={handleSelectChange}
              label={T.dietTypeLabel}
            >
              {dietTypeOptionsList.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {getLocalizedOptionLabel(option, currentLang)}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{T.dietTypeHelper}</FormHelperText>
          </FormControl>

          {/* แสดงการคำนวณ BMR, TDEE, เป้าแคลอรี่ */}
          {formData.gender &&
            calculatedAge &&
            formData.weightKg &&
            formData.heightCm &&
            formData.activityLevel &&
            formData.goal && (
              <Paper
                elevation={1}
                sx={{
                  mt: 3,
                  p: 2,
                  backgroundColor: 'primary.50',
                  border: '1px solid',
                  borderColor: 'primary.200',
                }}
              >
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ color: 'primary.main' }}
                >
                  🧮{' '}
                  {currentLang === 'th'
                    ? 'การคำนวณความต้องการโภชนาการ'
                    : 'Nutrition Calculations'}
                </Typography>

                {(() => {
                  const profile: NutritionUserProfile = {
                    gender: formData.gender as 'male' | 'female' | 'other',
                    age: calculatedAge,
                    weightKg: formData.weightKg,
                    heightCm: formData.heightCm,
                    activityLevel: formData.activityLevel as any,
                    goal: formData.goal as any,
                    dietType: formData.dietType as any,
                  }

                  if (validateUserProfileForCalculation(profile)) {
                    const bmr = Math.round(calculateBMR(profile))
                    const tdee = Math.round(calculateTDEE(profile))
                    const targetCalories = calculateTargetCalories(profile)
                    const nutritionGoals = calculateNutritionGoals(profile)

                    return (
                      <Box>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          <strong>🔥 BMR (พลังงานพื้นฐาน):</strong>{' '}
                          {bmr.toLocaleString()} kcal/วัน
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          <strong>⚡ TDEE (พลังงานรวม):</strong>{' '}
                          {tdee.toLocaleString()} kcal/วัน
                        </Typography>
                        <Typography
                          variant="body1"
                          sx={{
                            mb: 2,
                            color: 'primary.main',
                            fontWeight: 'bold',
                          }}
                        >
                          <strong>🎯 เป้าแคลอรี่:</strong>{' '}
                          {targetCalories.toLocaleString()} kcal/วัน
                        </Typography>

                        <Typography
                          variant="subtitle2"
                          gutterBottom
                          sx={{ color: 'text.secondary' }}
                        >
                          📊 เป้าหมายสารอาหารรายวัน:
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: 1,
                          }}
                        >
                          <Typography variant="body2">
                            • โปรตีน: {nutritionGoals.protein}g
                          </Typography>
                          <Typography variant="body2">
                            • คาร์โบไฮเดรต: {nutritionGoals.carbs}g
                          </Typography>
                          <Typography variant="body2">
                            • ไขมัน: {nutritionGoals.fat}g
                          </Typography>
                          <Typography variant="body2">
                            • ใยอาหาร: {nutritionGoals.fiber}g
                          </Typography>
                          <Typography variant="body2">
                            • น้ำ: {(nutritionGoals.water / 1000).toFixed(1)}L
                          </Typography>
                        </Box>
                      </Box>
                    )
                  } else {
                    return (
                      <Typography variant="body2" color="text.secondary">
                        กรุณากรอกข้อมูลให้ครบถ้วนเพื่อดูการคำนวณ
                      </Typography>
                    )
                  }
                })()}
              </Paper>
            )}
        </>
      )}

      {/* Step 4: สุขภาพและข้อจำกัด (เดิม step 3) */}
      {currentStep === 4 && renderStep3Content()}

      {/* Step 5: ไลฟ์สไตล์และความชอบ (เดิม step 4) */}
      {currentStep === 5 && (
        <>
          <FormControl fullWidth margin="normal">
            <InputLabel id="pregnancy-status-label">
              {T.pregnancyStatusLabel}
            </InputLabel>
            <Select
              labelId="pregnancy-status-label"
              name="pregnancyLactationStatus"
              value={formData.pregnancyLactationStatus || ''}
              onChange={handleSelectChange}
              label={T.pregnancyStatusLabel}
            >
              {pregnancyOptionsList.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {getLocalizedOptionLabel(option, currentLang)}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{T.pregnancyStatusHelper}</FormHelperText>
          </FormControl>

          {/* Cuisine Preferences Accordion */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="cuisine-preferences-content"
              id="cuisine-preferences-header"
            >
              <Typography variant="h6">{T.preferredCuisineLabel}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormGroup>
                {cuisinePreferenceOptions.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Checkbox
                        checked={selectedCuisinePreferences.includes(
                          option.value,
                        )}
                        onChange={() =>
                          handleCheckboxChange(
                            option.value,
                            selectedCuisinePreferences,
                            setSelectedCuisinePreferences,
                          )
                        }
                      />
                    }
                    label={getLocalizedOptionLabel(option, currentLang)}
                  />
                ))}
              </FormGroup>
              {selectedCuisinePreferences.includes('other') && (
                <TextField
                  fullWidth
                  margin="normal"
                  size="small"
                  label={
                    currentLang === 'th'
                      ? 'ระบุวัฒนธรรมอาหารอื่นๆ'
                      : 'Specify other cuisines'
                  }
                  value={otherCuisinePreference}
                  onChange={(e) =>
                    handleOtherInputChange(
                      e.target.value,
                      setOtherCuisinePreference,
                      selectedCuisinePreferences,
                      setSelectedCuisinePreferences,
                    )
                  }
                  placeholder={
                    currentLang === 'th'
                      ? 'เช่น เกาหลี, เวียดนาม, เม็กซิกัน'
                      : 'e.g. Korean, Vietnamese, Mexican'
                  }
                />
              )}
            </AccordionDetails>
          </Accordion>

          {/* Flavor Preferences Accordion */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="flavor-preferences-content"
              id="flavor-preferences-header"
            >
              <Typography variant="h6">
                {T.preferredFlavorProfilesLabel}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormGroup>
                {flavorPreferenceOptions.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Checkbox
                        checked={selectedFlavorPreferences.includes(
                          option.value,
                        )}
                        onChange={() =>
                          handleCheckboxChange(
                            option.value,
                            selectedFlavorPreferences,
                            setSelectedFlavorPreferences,
                          )
                        }
                      />
                    }
                    label={getLocalizedOptionLabel(option, currentLang)}
                  />
                ))}
              </FormGroup>
              {selectedFlavorPreferences.includes('other') && (
                <TextField
                  fullWidth
                  margin="normal"
                  size="small"
                  label={
                    currentLang === 'th'
                      ? 'ระบุรสชาติอื่นๆ'
                      : 'Specify other flavors'
                  }
                  value={otherFlavorPreference}
                  onChange={(e) =>
                    handleOtherInputChange(
                      e.target.value,
                      setOtherFlavorPreference,
                      selectedFlavorPreferences,
                      setSelectedFlavorPreferences,
                    )
                  }
                  placeholder={
                    currentLang === 'th'
                      ? 'เช่น เปรี้ยว, ขม, หอม'
                      : 'e.g. sour, bitter, aromatic'
                  }
                />
              )}
            </AccordionDetails>
          </Accordion>
        </>
      )}

      {/* Step 6: สรุปข้อมูล */}
      {currentStep === 6 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            {T.summaryTitle}
          </Typography>

          {/* ข้อมูลพื้นฐาน */}
          <Typography variant="h6" sx={{ mt: 3, mb: 1, color: 'primary.main' }}>
            👤 {T.step1Title}
          </Typography>
          <ProfileListItem
            label={T.nicknameLabel}
            value={formData.displayName}
          />
          <ProfileListItem
            label={T.birthdateLabel}
            value={
              formData.birthDate
                ? format(parseISO(formData.birthDate), 'PPP', {
                    locale: currentLang === 'th' ? th : enUS,
                  })
                : ''
            }
          />
          <ProfileListItem
            label={T.ageLabel}
            value={
              calculatedAge !== undefined
                ? `${calculatedAge} ${currentLang === 'th' ? 'ปี' : 'years'}`
                : ''
            }
          />
          <ProfileListItem
            label={T.genderLabel}
            value={getGenderDisplay(formData.gender)}
          />

          {/* ข้อมูลร่างกาย */}
          <Typography variant="h6" sx={{ mt: 3, mb: 1, color: 'primary.main' }}>
            📏 {T.step5Title}
          </Typography>
          <ProfileListItem
            label={T.weightLabel}
            value={formData.weightKg ? `${formData.weightKg} kg` : ''}
          />
          <ProfileListItem
            label={T.heightLabel}
            value={formData.heightCm ? `${formData.heightCm} cm` : ''}
          />
          {calculatedBmi && (
            <ProfileListItem
              label={T.bmiLabel}
              value={`${calculatedBmi} (${getBmiStatus(calculatedBmi, currentLang)})`}
            />
          )}

          {/* การคำนวณโภชนาการ */}
          {formData.gender &&
            calculatedAge &&
            formData.weightKg &&
            formData.heightCm &&
            formData.activityLevel &&
            formData.goal && (
              <>
                <Typography
                  variant="h6"
                  sx={{ mt: 3, mb: 1, color: 'success.main' }}
                >
                  🧮{' '}
                  {currentLang === 'th'
                    ? 'การคำนวณโภชนาการ'
                    : 'Nutrition Calculations'}
                </Typography>

                {(() => {
                  const profile: NutritionUserProfile = {
                    gender: formData.gender as 'male' | 'female' | 'other',
                    age: calculatedAge,
                    weightKg: formData.weightKg,
                    heightCm: formData.heightCm,
                    activityLevel: formData.activityLevel as any,
                    goal: formData.goal as any,
                    dietType: formData.dietType as any,
                  }

                  if (validateUserProfileForCalculation(profile)) {
                    const bmr = Math.round(calculateBMR(profile))
                    const tdee = Math.round(calculateTDEE(profile))
                    const targetCalories = calculateTargetCalories(profile)
                    const nutritionGoals = calculateNutritionGoals(profile)

                    return (
                      <Box>
                        <ProfileListItem
                          label="🔥 BMR (พลังงานพื้นฐาน)"
                          value={`${bmr.toLocaleString()} kcal/วัน`}
                        />
                        <ProfileListItem
                          label="⚡ TDEE (พลังงานรวม)"
                          value={`${tdee.toLocaleString()} kcal/วัน`}
                        />
                        <ProfileListItem
                          label="🎯 เป้าแคลอรี่"
                          value={`${targetCalories.toLocaleString()} kcal/วัน`}
                        />
                        <ProfileListItem
                          label="💪 โปรตีน"
                          value={`${nutritionGoals.protein} g/วัน`}
                        />
                        <ProfileListItem
                          label="🍞 คาร์โบไฮเดรต"
                          value={`${nutritionGoals.carbs} g/วัน`}
                        />
                        <ProfileListItem
                          label="🥑 ไขมัน"
                          value={`${nutritionGoals.fat} g/วัน`}
                        />
                        <ProfileListItem
                          label="🌾 ใยอาหาร"
                          value={`${nutritionGoals.fiber} g/วัน`}
                        />
                        <ProfileListItem
                          label="💧 น้ำ"
                          value={`${(nutritionGoals.water / 1000).toFixed(1)} ลิตร/วัน`}
                        />
                      </Box>
                    )
                  }
                  return null
                })()}
              </>
            )}

          {/* เป้าหมายและไลฟ์สไตล์ */}
          <Typography variant="h6" sx={{ mt: 3, mb: 1, color: 'primary.main' }}>
            🎯 {T.step2Title}
          </Typography>
          <ProfileListItem
            label={T.goalLabel}
            value={getGoalDisplay(formData.goal)}
          />
          <ProfileListItem
            label={T.activityLevelLabel}
            value={getActivityLevelDisplay(formData.activityLevel)}
          />
          <ProfileListItem
            label={T.dietTypeLabel}
            value={getDietTypeDisplay(formData.dietType)}
          />

          {/* ข้อมูลสุขภาพ */}
          <Typography variant="h6" sx={{ mt: 3, mb: 1, color: 'primary.main' }}>
            ⚕️ {T.step3Title}
          </Typography>
          <ProfileListItem
            label={T.healthConditionsLabel}
            value={
              selectedHealthConditions.length > 0
                ? selectedHealthConditions
                    .map((value) => {
                      if (value === 'other') {
                        return otherHealthCondition
                      }
                      const option = healthConditionOptions.find(
                        (opt) => opt.value === value,
                      )
                      return option
                        ? getLocalizedOptionLabel(option, currentLang)
                        : value
                    })
                    .filter(Boolean)
                    .join(', ')
                : formData.healthConditions?.join(', ')
            }
          />
          <ProfileListItem
            label={T.foodAllergiesLabel}
            value={
              selectedFoodAllergies.length > 0
                ? selectedFoodAllergies
                    .map((value) => {
                      if (value === 'other') {
                        return otherFoodAllergy
                      }
                      const option = foodAllergyOptions.find(
                        (opt) => opt.value === value,
                      )
                      return option
                        ? getLocalizedOptionLabel(option, currentLang)
                        : value
                    })
                    .filter(Boolean)
                    .join(', ')
                : formData.foodAllergies?.join(', ')
            }
          />

          {/* ข้อมูลเพิ่มเติม */}
          <Typography variant="h6" sx={{ mt: 3, mb: 1, color: 'primary.main' }}>
            🍲 {T.step4Title}
          </Typography>
          <ProfileListItem
            label={T.ethicalConsiderationsLabel}
            value={
              selectedEthicalConsiderations.length > 0
                ? selectedEthicalConsiderations
                    .map((value) => {
                      if (value === 'other') {
                        return otherEthicalConsideration
                      }
                      const option = ethicalConsiderationOptions.find(
                        (opt) => opt.value === value,
                      )
                      return option
                        ? getLocalizedOptionLabel(option, currentLang)
                        : value
                    })
                    .filter(Boolean)
                    .join(', ')
                : formData.ethicalFoodConsiderations?.join(', ')
            }
          />
          <ProfileListItem
            label={T.pregnancyStatusLabel}
            value={getPregnancyStatusDisplay(formData.pregnancyLactationStatus)}
          />
          <ProfileListItem
            label={T.preferredCuisineLabel}
            value={
              selectedCuisinePreferences.length > 0
                ? selectedCuisinePreferences
                    .map((value) => {
                      if (value === 'other') {
                        return otherCuisinePreference
                      }
                      const option = cuisinePreferenceOptions.find(
                        (opt) => opt.value === value,
                      )
                      return option
                        ? getLocalizedOptionLabel(option, currentLang)
                        : value
                    })
                    .filter(Boolean)
                    .join(', ')
                : formData.preferredCuisine?.join(', ')
            }
          />
          <ProfileListItem
            label={T.preferredFlavorProfilesLabel}
            value={
              selectedFlavorPreferences.length > 0
                ? selectedFlavorPreferences
                    .map((value) => {
                      if (value === 'other') {
                        return otherFlavorPreference
                      }
                      const option = flavorPreferenceOptions.find(
                        (opt) => opt.value === value,
                      )
                      return option
                        ? getLocalizedOptionLabel(option, currentLang)
                        : value
                    })
                    .filter(Boolean)
                    .join(', ')
                : formData.preferredFlavorProfiles?.join(', ')
            }
          />
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        {currentStep === 6 && (
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              void handleSave()
            }}
            disabled={isSavingProfile}
            sx={{ mr: 1 }}
          >
            {isSavingProfile ? (
              <CircularProgress size={24} />
            ) : (
              T.saveChangesButton
            )}
          </Button>
        )}
        {currentStep > 1 && (
          <Button onClick={handlePrevStep} sx={{ mr: 1 }}>
            {T.backButton}
          </Button>
        )}
        {currentStep < 6 && isEditMode && (
          <Button variant="contained" onClick={handleNextStep}>
            {T.nextButton}
          </Button>
        )}
      </Box>

      {saveSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {T.profileUpdatedSuccess}
        </Alert>
      )}
      {saveError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {saveError}
        </Alert>
      )}
    </Paper>
  )

  const renderDisplayModeContent = () =>
    userProfileFromApi ? (
      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h5">
              {userProfileFromApi.displayName || T.userProfileTitle}
            </Typography>
            <IconButton
              onClick={() => {
                setIsEditMode(true)
                setCurrentStep(1)
              }}
              color="primary"
            >
              <EditIcon />
            </IconButton>
          </Box>
          <ProfileListItem
            label={T.nicknameLabel}
            value={userProfileFromApi.displayName}
          />
          {userProfileFromApi.birthDate && (
            <ProfileListItem
              label={T.birthdateLabel}
              value={format(parseISO(userProfileFromApi.birthDate), 'PPP', {
                locale: currentLang === 'th' ? th : enUS,
              })}
            />
          )}
          <ProfileListItem
            label={T.ageLabel}
            value={
              userProfileFromApi.age !== undefined
                ? `${userProfileFromApi.age} ${currentLang === 'th' ? 'ปี' : 'years'}`
                : '-'
            }
          />
          <ProfileListItem
            label={T.genderLabel}
            value={getGenderDisplay(userProfileFromApi.gender)}
          />
          <ProfileListItem
            label={T.weightLabel}
            value={
              userProfileFromApi.weightKg
                ? `${userProfileFromApi.weightKg} kg`
                : '-'
            }
          />
          <ProfileListItem
            label={T.heightLabel}
            value={
              userProfileFromApi.heightCm
                ? `${userProfileFromApi.heightCm} cm`
                : '-'
            }
          />
          {userProfileFromApi.weightKg &&
            userProfileFromApi.heightCm &&
            (() => {
              const bmiVal = (
                userProfileFromApi.weightKg /
                (userProfileFromApi.heightCm / 100) ** 2
              ).toFixed(1)
              return (
                <ProfileListItem
                  label={T.bmiLabel}
                  value={`${bmiVal} (${getBmiStatus(bmiVal, currentLang)})`}
                />
              )
            })()}
          <ProfileListItem
            label={T.goalLabel}
            value={getGoalDisplay(userProfileFromApi.goal)}
          />
          <ProfileListItem
            label={T.activityLevelLabel}
            value={getActivityLevelDisplay(userProfileFromApi.activityLevel)}
          />
          <ProfileListItem
            label={T.dietTypeLabel}
            value={getDietTypeDisplay(userProfileFromApi.dietType)}
          />
          <ProfileListItem
            label={T.healthConditionsLabel}
            value={userProfileFromApi.healthConditions?.join(', ')}
          />
          <ProfileListItem
            label={T.foodAllergiesLabel}
            value={userProfileFromApi.foodAllergies?.join(', ')}
          />
          <ProfileListItem
            label={T.pregnancyStatusLabel}
            value={getPregnancyStatusDisplay(
              userProfileFromApi.pregnancyLactationStatus,
            )}
          />

          {userProfileFromApi?.targetWeightKg !== undefined && (
            <ProfileListItem
              label={T.targetWeightLabel}
              value={userProfileFromApi.targetWeightKg ?? '-'}
            />
          )}
          {userProfileFromApi?.calculatedTdee !== undefined && (
            <ProfileListItem
              label={T.calculatedCaloriesLabel}
              value={
                userProfileFromApi.calculatedTdee
                  ? `${userProfileFromApi.calculatedTdee} kcal`
                  : '-'
              }
            />
          )}
        </CardContent>
      </Card>
    ) : (
      !isLoadingProfile && <Typography>{T.noApiProfileData}</Typography>
    )

  // Enhanced display with section-based editing
  const renderEnhancedDisplayContent = () =>
    userProfileFromApi ? (
      <Box>
        {/* Main Profile Header */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Typography variant="h5">
                {userProfileFromApi.displayName || T.userProfileTitle}
              </Typography>
              <Box>
                <IconButton
                  onClick={handleEditMenuOpen}
                  color="primary"
                  aria-label="edit profile sections"
                >
                  <MoreVertIcon />
                </IconButton>
                <Menu
                  anchorEl={editMenuAnchor}
                  open={editMenuOpen}
                  onClose={handleEditMenuClose}
                  PaperProps={{
                    sx: { width: 280, maxWidth: '100%' },
                  }}
                >
                  <MenuList>
                    <MenuItem onClick={() => handleEditSection('basic')}>
                      <ListItemIcon>
                        <PersonIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="แก้ไขข้อมูลพื้นฐาน"
                        primaryTypographyProps={{
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                        }}
                      />
                    </MenuItem>
                    <MenuItem onClick={() => handleEditSection('goals')}>
                      <ListItemIcon>
                        <FitnessCenterIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="แก้ไขเป้าหมาย & ไลฟ์สไตล์"
                        primaryTypographyProps={{
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                        }}
                      />
                    </MenuItem>
                    <MenuItem onClick={() => handleEditSection('body')}>
                      <ListItemIcon>
                        <ScaleIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="แก้ไขข้อมูลร่างกาย"
                        primaryTypographyProps={{
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                        }}
                      />
                    </MenuItem>
                    <MenuItem onClick={() => handleEditSection('health')}>
                      <ListItemIcon>
                        <LocalHospitalIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="แก้ไขข้อมูลสุขภาพ"
                        primaryTypographyProps={{
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                        }}
                      />
                    </MenuItem>
                    <MenuItem onClick={() => handleEditSection('lifestyle')}>
                      <ListItemIcon>
                        <RestaurantIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="แก้ไขข้อมูลเพิ่มเติม"
                        primaryTypographyProps={{
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                        }}
                      />
                    </MenuItem>
                    <Divider />
                    <MenuItem
                      onClick={() => {
                        setIsEditMode(true)
                        setCurrentStep(1)
                        handleEditMenuClose()
                      }}
                    >
                      <ListItemIcon>
                        <EditIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="แก้ไขโปรไฟล์ทั้งหมด"
                        primaryTypographyProps={{
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                        }}
                      />
                    </MenuItem>
                  </MenuList>
                </Menu>
              </Box>
            </Box>

            {/* การคำนวณโภชนาการ - แสดงด้านบน */}
            {userProfileFromApi.gender &&
              userProfileFromApi.age &&
              userProfileFromApi.weightKg &&
              userProfileFromApi.heightCm &&
              userProfileFromApi.activityLevel &&
              userProfileFromApi.goal && (
                <>
                  {(() => {
                    const profile: NutritionUserProfile = {
                      gender: userProfileFromApi.gender as
                        | 'male'
                        | 'female'
                        | 'other',
                      age: userProfileFromApi.age,
                      weightKg: userProfileFromApi.weightKg,
                      heightCm: userProfileFromApi.heightCm,
                      activityLevel: userProfileFromApi.activityLevel as any,
                      goal: userProfileFromApi.goal as any,
                      dietType: userProfileFromApi.dietType as any,
                    }

                    if (validateUserProfileForCalculation(profile)) {
                      const bmr = Math.round(calculateBMR(profile))
                      const tdee = Math.round(calculateTDEE(profile))
                      const targetCalories = calculateTargetCalories(profile)
                      const nutritionGoals = calculateNutritionGoals(profile)

                      return (
                        <Paper
                          elevation={2}
                          sx={{
                            p: 2,
                            mb: 3,
                            backgroundColor: 'success.50',
                            border: '1px solid',
                            borderColor: 'success.200',
                          }}
                        >
                          <Typography
                            variant="h6"
                            gutterBottom
                            sx={{ color: 'success.main', mb: 2 }}
                          >
                            🧮{' '}
                            {currentLang === 'th'
                              ? 'การคำนวณโภชนาการประจำวัน'
                              : 'Daily Nutrition Calculations'}
                          </Typography>

                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns:
                                'repeat(auto-fit, minmax(200px, 1fr))',
                              gap: 2,
                              mb: 2,
                            }}
                          >
                            <Box
                              sx={{
                                textAlign: 'center',
                                p: 1,
                                backgroundColor: 'white',
                                borderRadius: 1,
                              }}
                            >
                              <Typography
                                variant="h4"
                                sx={{
                                  color: 'primary.main',
                                  fontWeight: 'bold',
                                }}
                              >
                                {bmr.toLocaleString()}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                🔥 BMR (kcal/วัน)
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                textAlign: 'center',
                                p: 1,
                                backgroundColor: 'white',
                                borderRadius: 1,
                              }}
                            >
                              <Typography
                                variant="h4"
                                sx={{
                                  color: 'success.main',
                                  fontWeight: 'bold',
                                }}
                              >
                                {tdee.toLocaleString()}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                ⚡ TDEE (kcal/วัน)
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                textAlign: 'center',
                                p: 1,
                                backgroundColor: 'white',
                                borderRadius: 1,
                              }}
                            >
                              <Typography
                                variant="h4"
                                sx={{
                                  color: 'secondary.main',
                                  fontWeight: 'bold',
                                }}
                              >
                                {targetCalories.toLocaleString()}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                🎯 เป้าแคลอรี่ (kcal/วัน)
                              </Typography>
                            </Box>
                          </Box>

                          <Typography
                            variant="subtitle2"
                            gutterBottom
                            sx={{ color: 'text.secondary', mb: 1 }}
                          >
                            📊 เป้าหมายสารอาหารรายวัน:
                          </Typography>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns:
                                'repeat(auto-fit, minmax(120px, 1fr))',
                              gap: 1,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                padding: 0.5,
                                backgroundColor: 'white',
                                borderRadius: 0.5,
                                textAlign: 'center',
                              }}
                            >
                              💪 {nutritionGoals.protein}g โปรตีน
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                padding: 0.5,
                                backgroundColor: 'white',
                                borderRadius: 0.5,
                                textAlign: 'center',
                              }}
                            >
                              🍞 {nutritionGoals.carbs}g คาร์บ
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                padding: 0.5,
                                backgroundColor: 'white',
                                borderRadius: 0.5,
                                textAlign: 'center',
                              }}
                            >
                              🥑 {nutritionGoals.fat}g ไขมัน
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                padding: 0.5,
                                backgroundColor: 'white',
                                borderRadius: 0.5,
                                textAlign: 'center',
                              }}
                            >
                              🌾 {nutritionGoals.fiber}g ใยอาหาร
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                padding: 0.5,
                                backgroundColor: 'white',
                                borderRadius: 0.5,
                                textAlign: 'center',
                              }}
                            >
                              💧 {(nutritionGoals.water / 1000).toFixed(1)}L น้ำ
                            </Typography>
                          </Box>
                        </Paper>
                      )
                    }
                    return null
                  })()}
                </>
              )}

            {/* Display all profile data in flat list format */}
            <Box>
              {/* Basic Information */}
              <ProfileListItem
                label={T.nicknameLabel}
                value={userProfileFromApi.displayName}
              />
              {userProfileFromApi.birthDate && (
                <ProfileListItem
                  label={T.birthdateLabel}
                  value={format(parseISO(userProfileFromApi.birthDate), 'PPP', {
                    locale: currentLang === 'th' ? th : enUS,
                  })}
                />
              )}
              <ProfileListItem
                label={T.ageLabel}
                value={
                  userProfileFromApi.age !== undefined
                    ? `${userProfileFromApi.age} ${currentLang === 'th' ? 'ปี' : 'years'}`
                    : '-'
                }
              />
              <ProfileListItem
                label={T.genderLabel}
                value={getGenderDisplay(userProfileFromApi.gender)}
              />

              {/* Body Metrics */}
              <ProfileListItem
                label={T.weightLabel}
                value={
                  userProfileFromApi.weightKg
                    ? `${userProfileFromApi.weightKg} kg`
                    : '-'
                }
              />
              <ProfileListItem
                label={T.heightLabel}
                value={
                  userProfileFromApi.heightCm
                    ? `${userProfileFromApi.heightCm} cm`
                    : '-'
                }
              />
              {userProfileFromApi.weightKg &&
                userProfileFromApi.heightCm &&
                (() => {
                  const bmiVal = (
                    userProfileFromApi.weightKg /
                    (userProfileFromApi.heightCm / 100) ** 2
                  ).toFixed(1)
                  return (
                    <ProfileListItem
                      label={T.bmiLabel}
                      value={`${bmiVal} (${getBmiStatus(bmiVal, currentLang)})`}
                    />
                  )
                })()}

              {/* Goals & Lifestyle */}
              <ProfileListItem
                label={T.goalLabel}
                value={getGoalDisplay(userProfileFromApi.goal)}
              />
              <ProfileListItem
                label={T.activityLevelLabel}
                value={getActivityLevelDisplay(
                  userProfileFromApi.activityLevel,
                )}
              />
              <ProfileListItem
                label={T.dietTypeLabel}
                value={getDietTypeDisplay(userProfileFromApi.dietType)}
              />

              {/* Health Information */}
              <ProfileListItem
                label={T.healthConditionsLabel}
                value={userProfileFromApi.healthConditions?.join(', ')}
              />
              <ProfileListItem
                label={T.foodAllergiesLabel}
                value={userProfileFromApi.foodAllergies?.join(', ')}
              />
              <ProfileListItem
                label={T.pregnancyStatusLabel}
                value={getPregnancyStatusDisplay(
                  userProfileFromApi.pregnancyLactationStatus,
                )}
              />

              {/* Additional Information */}
              {userProfileFromApi.ethicalFoodConsiderations &&
                userProfileFromApi.ethicalFoodConsiderations.length > 0 && (
                  <ProfileListItem
                    label={T.ethicalConsiderationsLabel}
                    value={userProfileFromApi.ethicalFoodConsiderations.join(
                      ', ',
                    )}
                  />
                )}
              {userProfileFromApi.preferredCuisine &&
                userProfileFromApi.preferredCuisine.length > 0 && (
                  <ProfileListItem
                    label={T.preferredCuisineLabel}
                    value={userProfileFromApi.preferredCuisine.join(', ')}
                  />
                )}
              {userProfileFromApi.preferredFlavorProfiles &&
                userProfileFromApi.preferredFlavorProfiles.length > 0 && (
                  <ProfileListItem
                    label={T.preferredFlavorProfilesLabel}
                    value={userProfileFromApi.preferredFlavorProfiles.join(
                      ', ',
                    )}
                  />
                )}

              {/* Calculated Values - แสดงจากฐานข้อมูลด้วย */}
              {userProfileFromApi.calculatedBmr && (
                <ProfileListItem
                  label="🔥 BMR (จากฐานข้อมูล)"
                  value={`${userProfileFromApi.calculatedBmr.toLocaleString()} kcal/วัน`}
                />
              )}
              {userProfileFromApi.calculatedTdee && (
                <ProfileListItem
                  label="⚡ TDEE (จากฐานข้อมูล)"
                  value={`${userProfileFromApi.calculatedTdee.toLocaleString()} kcal/วัน`}
                />
              )}
              {userProfileFromApi.targetWeightKg !== undefined && (
                <ProfileListItem
                  label={T.targetWeightLabel}
                  value={userProfileFromApi.targetWeightKg ?? '-'}
                />
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Section-based editing accordions (only show when editing specific sections) */}
        <Dialog
          open={
            editingSections.basic ||
            editingSections.goals ||
            editingSections.body ||
            editingSections.health ||
            editingSections.lifestyle
          }
          onClose={() => {
            const activeSection = Object.keys(editingSections).find(
              (key) => editingSections[key as keyof typeof editingSections],
            ) as keyof typeof editingSections
            if (activeSection) cancelSectionEdit(activeSection)
          }}
          maxWidth="md"
          fullWidth
          scroll="paper"
          sx={{
            '& .MuiDialog-container': {
              alignItems: 'flex-start',
              paddingTop: 2,
            },
            '& .MuiDialog-paper': {
              margin: 2,
              maxHeight: 'calc(100vh - 32px)',
              borderRadius: 2,
            },
          }}
        >
          <DialogTitle
            sx={{
              pb: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h6" component="span">
              {editingSections.basic && `👤 ${T.step1Title}`}
              {editingSections.goals && `🎯 ${T.step2Title}`}
              {editingSections.body && `📏 ${T.step5Title}`}
              {editingSections.health && `🏥 ${T.step3Title}`}
              {editingSections.lifestyle && `🌱 ${T.step4Title}`}
            </Typography>
            <IconButton
              onClick={() => {
                const activeSection = Object.keys(editingSections).find(
                  (key) => editingSections[key as keyof typeof editingSections],
                ) as keyof typeof editingSections
                if (activeSection) cancelSectionEdit(activeSection)
              }}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            {editingSections.basic && <BasicInfoSectionContent />}
            {editingSections.goals && <GoalsSectionContent />}
            {editingSections.body && <BodyMetricsSectionContent />}
            {editingSections.health && <HealthInfoSectionContent />}
            {editingSections.lifestyle && <AdditionalInfoSectionContent />}
          </DialogContent>
        </Dialog>

        {saveSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {T.profileUpdatedSuccess}
          </Alert>
        )}
        {saveError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {saveError}
          </Alert>
        )}
      </Box>
    ) : (
      !isLoadingProfile && <Typography>{T.noApiProfileData}</Typography>
    )

  // Section components for individual editing
  const BasicInfoSection: React.FC = () => {
    const isEditing = editingSections.basic

    return (
      <Accordion
        expanded={isEditing || false}
        onChange={() => !isEditing && toggleSectionEdit('basic')}
        sx={{ mb: 2 }}
      >
        <AccordionSummary
          expandIcon={
            isEditing ? null : (
              <Typography sx={{ color: 'action.active', fontSize: '1.2rem' }}>
                ›
              </Typography>
            )
          }
          aria-controls="basic-info-content"
          id="basic-info-header"
          sx={{
            ...(isEditing
              ? {}
              : {
                  '&:hover': { backgroundColor: 'grey.50' },
                  cursor: 'pointer',
                }),
          }}
        >
          <Typography variant="h6">👤 {T.step1Title}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {isEditing ? (
            <Box>
              <TextField
                label={T.nicknameLabel}
                name="displayName"
                value={formData.displayName || ''}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
                size="small"
              />
              <LocalizationProvider
                dateAdapter={AdapterDateFns}
                adapterLocale={currentLang === 'th' ? th : enUS}
              >
                <DatePicker
                  label={T.birthdateLabel}
                  value={
                    formData.birthDate ? parseISO(formData.birthDate) : null
                  }
                  onChange={(newValue) =>
                    setFormData((prev) => ({
                      ...prev,
                      birthDate: newValue
                        ? format(newValue, 'yyyy-MM-dd')
                        : undefined,
                    }))
                  }
                  sx={{ width: '100%', mt: 2, mb: 1 }}
                />
              </LocalizationProvider>
              <FormControl component="fieldset" margin="normal" fullWidth>
                <Typography variant="subtitle1" gutterBottom>
                  {T.genderLabel}
                </Typography>
                <ToggleButtonGroup
                  value={formData.gender || ''}
                  exclusive
                  onChange={handleGenderChange}
                  aria-label="gender selection"
                  fullWidth
                >
                  <ToggleButton value="male" aria-label="male">
                    {T.male}
                  </ToggleButton>
                  <ToggleButton value="female" aria-label="female">
                    {T.female}
                  </ToggleButton>
                  <ToggleButton value="other" aria-label="other">
                    {T.other}
                  </ToggleButton>
                </ToggleButtonGroup>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => handleSectionSave('basic')}
                  disabled={isSavingProfile}
                  size="small"
                >
                  {isSavingProfile ? <CircularProgress size={20} /> : 'บันทึก'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => cancelSectionEdit('basic')}
                  size="small"
                >
                  ยกเลิก
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <EditableProfileListItem
                label={T.nicknameLabel}
                value={userProfileFromApi?.displayName}
                onEdit={() => toggleSectionEdit('basic')}
              />
              {userProfileFromApi?.birthDate && (
                <EditableProfileListItem
                  label={T.birthdateLabel}
                  value={format(parseISO(userProfileFromApi.birthDate), 'PPP', {
                    locale: currentLang === 'th' ? th : enUS,
                  })}
                  onEdit={() => toggleSectionEdit('basic')}
                />
              )}
              <EditableProfileListItem
                label={T.ageLabel}
                value={
                  userProfileFromApi?.age !== undefined
                    ? `${userProfileFromApi.age} ${currentLang === 'th' ? 'ปี' : 'years'}`
                    : '-'
                }
                onEdit={() => toggleSectionEdit('basic')}
              />
              <EditableProfileListItem
                label={T.genderLabel}
                value={getGenderDisplay(userProfileFromApi?.gender)}
                onEdit={() => toggleSectionEdit('basic')}
              />
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    )
  }

  const GoalsSection: React.FC = () => {
    const isEditing = editingSections.goals

    return (
      <Accordion
        expanded={isEditing || false}
        onChange={() => !isEditing && toggleSectionEdit('goals')}
        sx={{ mb: 2 }}
      >
        <AccordionSummary
          expandIcon={
            isEditing ? null : (
              <Typography sx={{ color: 'action.active', fontSize: '1.2rem' }}>
                ›
              </Typography>
            )
          }
          aria-controls="goals-content"
          id="goals-header"
          sx={{
            ...(isEditing
              ? {}
              : {
                  '&:hover': { backgroundColor: 'grey.50' },
                  cursor: 'pointer',
                }),
          }}
        >
          <Typography variant="h6">🎯 {T.step2Title}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {isEditing ? (
            <Box>
              <FormControl fullWidth margin="normal" size="small">
                <InputLabel id="goal-label">{T.goalLabel}</InputLabel>
                <Select
                  labelId="goal-label"
                  name="goal"
                  value={formData.goal || ''}
                  onChange={handleSelectChange}
                  label={T.goalLabel}
                >
                  {goalOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {getLocalizedOptionLabel(option, currentLang)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal" size="small">
                <InputLabel id="activity-level-label">
                  {T.activityLevelLabel}
                </InputLabel>
                <Select
                  labelId="activity-level-label"
                  name="activityLevel"
                  value={formData.activityLevel || ''}
                  onChange={handleSelectChange}
                  label={T.activityLevelLabel}
                >
                  {activityLevelOptionsList.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {getLocalizedOptionLabel(option, currentLang)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal" size="small">
                <InputLabel id="diet-type-label">{T.dietTypeLabel}</InputLabel>
                <Select
                  labelId="diet-type-label"
                  name="dietType"
                  value={formData.dietType || ''}
                  onChange={handleSelectChange}
                  label={T.dietTypeLabel}
                >
                  {dietTypeOptionsList.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {getLocalizedOptionLabel(option, currentLang)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => handleSectionSave('goals')}
                  disabled={isSavingProfile}
                  size="small"
                >
                  {isSavingProfile ? <CircularProgress size={20} /> : 'บันทึก'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => cancelSectionEdit('goals')}
                  size="small"
                >
                  ยกเลิก
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <EditableProfileListItem
                label={T.goalLabel}
                value={getGoalDisplay(userProfileFromApi?.goal)}
                onEdit={() => toggleSectionEdit('goals')}
              />
              <EditableProfileListItem
                label={T.activityLevelLabel}
                value={getActivityLevelDisplay(
                  userProfileFromApi?.activityLevel,
                )}
                onEdit={() => toggleSectionEdit('goals')}
              />
              <EditableProfileListItem
                label={T.dietTypeLabel}
                value={getDietTypeDisplay(userProfileFromApi?.dietType)}
                onEdit={() => toggleSectionEdit('goals')}
              />
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    )
  }

  const BodyMetricsSection: React.FC = () => {
    const isEditing = editingSections.body

    return (
      <Accordion
        expanded={isEditing || false}
        onChange={() => !isEditing && toggleSectionEdit('body')}
        sx={{ mb: 2 }}
      >
        <AccordionSummary
          expandIcon={
            isEditing ? null : (
              <Typography sx={{ color: 'action.active', fontSize: '1.2rem' }}>
                ›
              </Typography>
            )
          }
          aria-controls="body-metrics-content"
          id="body-metrics-header"
          sx={{
            ...(isEditing
              ? {}
              : {
                  '&:hover': { backgroundColor: 'grey.50' },
                  cursor: 'pointer',
                }),
          }}
        >
          <Typography variant="h6">📏 {T.step5Title}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {isEditing ? (
            <Box>
              <TextField
                label={T.weightLabel}
                name="weightKg"
                type="number"
                value={formData.weightKg || ''}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
                size="small"
                inputProps={{ min: 0, step: 0.1 }}
              />
              <TextField
                label={T.heightLabel}
                name="heightCm"
                type="number"
                value={formData.heightCm || ''}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
                size="small"
                inputProps={{ min: 0, step: 1 }}
              />
              {calculatedBmi && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {T.bmiCalculatedLabel} {calculatedBmi} (
                  {getBmiStatus(calculatedBmi, currentLang)})
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => handleSectionSave('body')}
                  disabled={isSavingProfile}
                  size="small"
                >
                  {isSavingProfile ? <CircularProgress size={20} /> : 'บันทึก'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => cancelSectionEdit('body')}
                  size="small"
                >
                  ยกเลิก
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <EditableProfileListItem
                label={T.weightLabel}
                value={
                  userProfileFromApi?.weightKg
                    ? `${userProfileFromApi.weightKg} kg`
                    : '-'
                }
                onEdit={() => toggleSectionEdit('body')}
              />
              <EditableProfileListItem
                label={T.heightLabel}
                value={
                  userProfileFromApi?.heightCm
                    ? `${userProfileFromApi.heightCm} cm`
                    : '-'
                }
                onEdit={() => toggleSectionEdit('body')}
              />
              {userProfileFromApi?.weightKg &&
                userProfileFromApi?.heightCm &&
                (() => {
                  const bmiVal = (
                    userProfileFromApi.weightKg /
                    (userProfileFromApi.heightCm / 100) ** 2
                  ).toFixed(1)
                  return (
                    <EditableProfileListItem
                      label={T.bmiLabel}
                      value={`${bmiVal} (${getBmiStatus(bmiVal, currentLang)})`}
                      onEdit={() => toggleSectionEdit('body')}
                    />
                  )
                })()}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    )
  }

  const HealthInfoSection: React.FC = () => {
    const isEditing = editingSections.health

    return (
      <Accordion
        expanded={isEditing || false}
        onChange={() => !isEditing && toggleSectionEdit('health')}
        sx={{ mb: 2 }}
      >
        <AccordionSummary
          expandIcon={
            isEditing ? null : (
              <Typography sx={{ color: 'action.active', fontSize: '1.2rem' }}>
                ›
              </Typography>
            )
          }
          aria-controls="health-info-content"
          id="health-info-header"
          sx={{
            ...(isEditing
              ? {}
              : {
                  '&:hover': { backgroundColor: 'grey.50' },
                  cursor: 'pointer',
                }),
          }}
        >
          <Typography variant="h6">🏥 ข้อมูลสุขภาพ</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {isEditing ? (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                {T.healthConditionsLabel}
              </Typography>
              <FormGroup>
                {healthConditionOptions.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Checkbox
                        checked={selectedHealthConditions.includes(
                          option.value,
                        )}
                        onChange={() =>
                          handleCheckboxChange(
                            option.value,
                            selectedHealthConditions,
                            setSelectedHealthConditions,
                          )
                        }
                      />
                    }
                    label={getLocalizedOptionLabel(option, currentLang)}
                  />
                ))}
              </FormGroup>

              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                {T.foodAllergiesLabel}
              </Typography>
              <FormGroup>
                {foodAllergyOptions.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Checkbox
                        checked={selectedFoodAllergies.includes(option.value)}
                        onChange={() =>
                          handleCheckboxChange(
                            option.value,
                            selectedFoodAllergies,
                            setSelectedFoodAllergies,
                          )
                        }
                      />
                    }
                    label={getLocalizedOptionLabel(option, currentLang)}
                  />
                ))}
              </FormGroup>

              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => handleSectionSave('health')}
                  disabled={isSavingProfile}
                  size="small"
                >
                  {isSavingProfile ? <CircularProgress size={20} /> : 'บันทึก'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => cancelSectionEdit('health')}
                  size="small"
                >
                  ยกเลิก
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <EditableProfileListItem
                label={T.healthConditionsLabel}
                value={userProfileFromApi?.healthConditions?.join(', ')}
                onEdit={() => toggleSectionEdit('health')}
              />
              <EditableProfileListItem
                label={T.foodAllergiesLabel}
                value={userProfileFromApi?.foodAllergies?.join(', ')}
                onEdit={() => toggleSectionEdit('health')}
              />
              <EditableProfileListItem
                label={T.pregnancyStatusLabel}
                value={getPregnancyStatusDisplay(
                  userProfileFromApi?.pregnancyLactationStatus,
                )}
                onEdit={() => toggleSectionEdit('health')}
              />
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    )
  }

  const AdditionalInfoSection: React.FC = () => {
    const isEditing = editingSections.lifestyle

    return (
      <Accordion
        expanded={isEditing || false}
        onChange={() => !isEditing && toggleSectionEdit('lifestyle')}
        sx={{ mb: 2 }}
      >
        <AccordionSummary
          expandIcon={
            isEditing ? null : (
              <Typography sx={{ color: 'action.active', fontSize: '1.2rem' }}>
                ›
              </Typography>
            )
          }
          aria-controls="additional-info-content"
          id="additional-info-header"
          sx={{
            ...(isEditing
              ? {}
              : {
                  '&:hover': { backgroundColor: 'grey.50' },
                  cursor: 'pointer',
                }),
          }}
        >
          <Typography variant="h6">🌿 ข้อมูลเพิ่มเติม</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {isEditing ? (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                {T.ethicalConsiderationsLabel}
              </Typography>
              <FormGroup>
                {ethicalConsiderationOptions.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Checkbox
                        checked={selectedEthicalConsiderations.includes(
                          option.value,
                        )}
                        onChange={() =>
                          handleCheckboxChange(
                            option.value,
                            selectedEthicalConsiderations,
                            setSelectedEthicalConsiderations,
                          )
                        }
                      />
                    }
                    label={getLocalizedOptionLabel(option, currentLang)}
                  />
                ))}
              </FormGroup>

              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                {T.preferredCuisineLabel}
              </Typography>
              <FormGroup>
                {cuisinePreferenceOptions.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Checkbox
                        checked={selectedCuisinePreferences.includes(
                          option.value,
                        )}
                        onChange={() =>
                          handleCheckboxChange(
                            option.value,
                            selectedCuisinePreferences,
                            setSelectedCuisinePreferences,
                          )
                        }
                      />
                    }
                    label={getLocalizedOptionLabel(option, currentLang)}
                  />
                ))}
              </FormGroup>

              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                {T.preferredFlavorProfilesLabel}
              </Typography>
              <FormGroup>
                {flavorPreferenceOptions.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Checkbox
                        checked={selectedFlavorPreferences.includes(
                          option.value,
                        )}
                        onChange={() =>
                          handleCheckboxChange(
                            option.value,
                            selectedFlavorPreferences,
                            setSelectedFlavorPreferences,
                          )
                        }
                      />
                    }
                    label={getLocalizedOptionLabel(option, currentLang)}
                  />
                ))}
              </FormGroup>

              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => handleSectionSave('lifestyle')}
                  disabled={isSavingProfile}
                  size="small"
                >
                  {isSavingProfile ? <CircularProgress size={20} /> : 'บันทึก'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => cancelSectionEdit('lifestyle')}
                  size="small"
                >
                  ยกเลิก
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              {userProfileFromApi?.ethicalFoodConsiderations &&
                userProfileFromApi.ethicalFoodConsiderations.length > 0 && (
                  <EditableProfileListItem
                    label={T.ethicalConsiderationsLabel}
                    value={userProfileFromApi.ethicalFoodConsiderations.join(
                      ', ',
                    )}
                    onEdit={() => toggleSectionEdit('lifestyle')}
                  />
                )}
              {userProfileFromApi?.preferredCuisine &&
                userProfileFromApi.preferredCuisine.length > 0 && (
                  <EditableProfileListItem
                    label={T.preferredCuisineLabel}
                    value={userProfileFromApi.preferredCuisine.join(', ')}
                    onEdit={() => toggleSectionEdit('lifestyle')}
                  />
                )}
              {userProfileFromApi?.preferredFlavorProfiles &&
                userProfileFromApi.preferredFlavorProfiles.length > 0 && (
                  <EditableProfileListItem
                    label={T.preferredFlavorProfilesLabel}
                    value={userProfileFromApi.preferredFlavorProfiles.join(
                      ', ',
                    )}
                    onEdit={() => toggleSectionEdit('lifestyle')}
                  />
                )}
              {userProfileFromApi?.targetWeightKg !== undefined && (
                <EditableProfileListItem
                  label={T.targetWeightLabel}
                  value={userProfileFromApi.targetWeightKg ?? '-'}
                  onEdit={() => toggleSectionEdit('lifestyle')}
                />
              )}
              {userProfileFromApi?.calculatedTdee !== undefined && (
                <EditableProfileListItem
                  label={T.calculatedCaloriesLabel}
                  value={
                    userProfileFromApi.calculatedTdee
                      ? `${userProfileFromApi.calculatedTdee} kcal`
                      : '-'
                  }
                  onEdit={() => toggleSectionEdit('lifestyle')}
                />
              )}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    )
  }

  // Section-based editing dialog (แสดงที่ด้านบนสุดแทนที่จะอยู่ข้างล่าง)
  const BasicInfoSectionContent = () => (
    <Box>
      <TextField
        label={T.nicknameLabel}
        name="displayName"
        value={formData.displayName || ''}
        onChange={handleInputChange}
        fullWidth
        margin="normal"
        size="small"
      />
      <LocalizationProvider
        dateAdapter={AdapterDateFns}
        adapterLocale={currentLang === 'th' ? th : enUS}
      >
        <DatePicker
          label={T.birthdateLabel}
          value={formData.birthDate ? parseISO(formData.birthDate) : null}
          onChange={(newValue) =>
            setFormData((prev) => ({
              ...prev,
              birthDate: newValue ? format(newValue, 'yyyy-MM-dd') : undefined,
            }))
          }
          sx={{ width: '100%', mt: 2, mb: 1 }}
        />
      </LocalizationProvider>
      <FormControl component="fieldset" margin="normal" fullWidth>
        <Typography variant="subtitle1" gutterBottom>
          {T.genderLabel}
        </Typography>
        <ToggleButtonGroup
          value={formData.gender || ''}
          exclusive
          onChange={handleGenderChange}
          aria-label="gender selection"
          fullWidth
        >
          <ToggleButton value="male" aria-label="male">
            {T.male}
          </ToggleButton>
          <ToggleButton value="female" aria-label="female">
            {T.female}
          </ToggleButton>
          <ToggleButton value="other" aria-label="other">
            {T.other}
          </ToggleButton>
        </ToggleButtonGroup>
      </FormControl>
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          variant="contained"
          onClick={() => handleSectionSave('basic')}
          disabled={isSavingProfile}
          size="small"
        >
          {isSavingProfile ? <CircularProgress size={20} /> : 'บันทึก'}
        </Button>
        <Button
          variant="outlined"
          onClick={() => cancelSectionEdit('basic')}
          size="small"
        >
          ยกเลิก
        </Button>
      </Box>
    </Box>
  )

  const GoalsSectionContent = () => (
    <Box>
      <FormControl fullWidth margin="normal" size="small">
        <InputLabel id="goal-label">{T.goalLabel}</InputLabel>
        <Select
          labelId="goal-label"
          name="goal"
          value={formData.goal || ''}
          onChange={handleSelectChange}
          label={T.goalLabel}
        >
          {goalOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {getLocalizedOptionLabel(option, currentLang)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth margin="normal" size="small">
        <InputLabel id="activity-level-label">
          {T.activityLevelLabel}
        </InputLabel>
        <Select
          labelId="activity-level-label"
          name="activityLevel"
          value={formData.activityLevel || ''}
          onChange={handleSelectChange}
          label={T.activityLevelLabel}
        >
          {activityLevelOptionsList.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {getLocalizedOptionLabel(option, currentLang)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth margin="normal" size="small">
        <InputLabel id="diet-type-label">{T.dietTypeLabel}</InputLabel>
        <Select
          labelId="diet-type-label"
          name="dietType"
          value={formData.dietType || ''}
          onChange={handleSelectChange}
          label={T.dietTypeLabel}
        >
          {dietTypeOptionsList.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {getLocalizedOptionLabel(option, currentLang)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          variant="contained"
          onClick={() => handleSectionSave('goals')}
          disabled={isSavingProfile}
          size="small"
        >
          {isSavingProfile ? <CircularProgress size={20} /> : 'บันทึก'}
        </Button>
        <Button
          variant="outlined"
          onClick={() => cancelSectionEdit('goals')}
          size="small"
        >
          ยกเลิก
        </Button>
      </Box>
    </Box>
  )

  const BodyMetricsSectionContent = () => (
    <Box>
      <TextField
        label={T.weightLabel}
        name="weightKg"
        type="number"
        value={formData.weightKg || ''}
        onChange={handleInputChange}
        fullWidth
        margin="normal"
        size="small"
        inputProps={{ min: 0, step: 0.1 }}
      />
      <TextField
        label={T.heightLabel}
        name="heightCm"
        type="number"
        value={formData.heightCm || ''}
        onChange={handleInputChange}
        fullWidth
        margin="normal"
        size="small"
        inputProps={{ min: 0, step: 1 }}
      />
      {calculatedBmi && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {T.bmiCalculatedLabel} {calculatedBmi} (
          {getBmiStatus(calculatedBmi, currentLang)})
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          variant="contained"
          onClick={() => handleSectionSave('body')}
          disabled={isSavingProfile}
          size="small"
        >
          {isSavingProfile ? <CircularProgress size={20} /> : 'บันทึก'}
        </Button>
        <Button
          variant="outlined"
          onClick={() => cancelSectionEdit('body')}
          size="small"
        >
          ยกเลิก
        </Button>
      </Box>
    </Box>
  )

  const HealthInfoSectionContent = () => (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        {T.healthConditionsLabel}
      </Typography>
      <FormGroup>
        {healthConditionOptions.map((option) => (
          <FormControlLabel
            key={option.value}
            control={
              <Checkbox
                checked={selectedHealthConditions.includes(option.value)}
                onChange={() =>
                  handleCheckboxChange(
                    option.value,
                    selectedHealthConditions,
                    setSelectedHealthConditions,
                  )
                }
              />
            }
            label={getLocalizedOptionLabel(option, currentLang)}
          />
        ))}
      </FormGroup>

      <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
        {T.foodAllergiesLabel}
      </Typography>
      <FormGroup>
        {foodAllergyOptions.map((option) => (
          <FormControlLabel
            key={option.value}
            control={
              <Checkbox
                checked={selectedFoodAllergies.includes(option.value)}
                onChange={() =>
                  handleCheckboxChange(
                    option.value,
                    selectedFoodAllergies,
                    setSelectedFoodAllergies,
                  )
                }
              />
            }
            label={getLocalizedOptionLabel(option, currentLang)}
          />
        ))}
      </FormGroup>

      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          variant="contained"
          onClick={() => handleSectionSave('health')}
          disabled={isSavingProfile}
          size="small"
        >
          {isSavingProfile ? <CircularProgress size={20} /> : 'บันทึก'}
        </Button>
        <Button
          variant="outlined"
          onClick={() => cancelSectionEdit('health')}
          size="small"
        >
          ยกเลิก
        </Button>
      </Box>
    </Box>
  )

  const AdditionalInfoSectionContent = () => (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        {T.ethicalConsiderationsLabel}
      </Typography>
      <FormGroup>
        {ethicalConsiderationOptions.map((option) => (
          <FormControlLabel
            key={option.value}
            control={
              <Checkbox
                checked={selectedEthicalConsiderations.includes(option.value)}
                onChange={() =>
                  handleCheckboxChange(
                    option.value,
                    selectedEthicalConsiderations,
                    setSelectedEthicalConsiderations,
                  )
                }
              />
            }
            label={getLocalizedOptionLabel(option, currentLang)}
          />
        ))}
      </FormGroup>

      <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
        {T.preferredCuisineLabel}
      </Typography>
      <FormGroup>
        {cuisinePreferenceOptions.map((option) => (
          <FormControlLabel
            key={option.value}
            control={
              <Checkbox
                checked={selectedCuisinePreferences.includes(option.value)}
                onChange={() =>
                  handleCheckboxChange(
                    option.value,
                    selectedCuisinePreferences,
                    setSelectedCuisinePreferences,
                  )
                }
              />
            }
            label={getLocalizedOptionLabel(option, currentLang)}
          />
        ))}
      </FormGroup>

      <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
        {T.preferredFlavorProfilesLabel}
      </Typography>
      <FormGroup>
        {flavorPreferenceOptions.map((option) => (
          <FormControlLabel
            key={option.value}
            control={
              <Checkbox
                checked={selectedFlavorPreferences.includes(option.value)}
                onChange={() =>
                  handleCheckboxChange(
                    option.value,
                    selectedFlavorPreferences,
                    setSelectedFlavorPreferences,
                  )
                }
              />
            }
            label={getLocalizedOptionLabel(option, currentLang)}
          />
        ))}
      </FormGroup>

      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          variant="contained"
          onClick={() => handleSectionSave('lifestyle')}
          disabled={isSavingProfile}
          size="small"
        >
          {isSavingProfile ? <CircularProgress size={20} /> : 'บันทึก'}
        </Button>
        <Button
          variant="outlined"
          onClick={() => cancelSectionEdit('lifestyle')}
          size="small"
        >
          ยกเลิก
        </Button>
      </Box>
    </Box>
  )

  return (
    <LocalizationProvider
      dateAdapter={AdapterDateFns}
      adapterLocale={currentLang === 'th' ? th : enUS}
    >
      <ThemeProvider theme={theme}>
        <LiffIdHandler>
          <CssBaseline />
          <AppBar
            position="static"
            sx={{
              background: 'linear-gradient(135deg, #00B900 0%, #16a34a 100%)',
              boxShadow: '0 4px 20px rgba(0, 185, 0, 0.3)',
              borderRadius: '0 0 16px 16px',
            }}
          >
            <Toolbar sx={{ justifyContent: 'space-between', py: 1, px: 2 }}>
              {/* ✅ Left section: Profile picture และ name */}
              <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                {lineProfile && lineProfile.pictureUrl && (
                  <Box sx={{ mr: 2 }}>
                    <Image
                      src={lineProfile.pictureUrl}
                      alt={lineProfile.displayName}
                      width={48}
                      height={48}
                      style={{
                        borderRadius: '50%',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      }}
                      priority={false}
                      loading="lazy"
                    />
                  </Box>
                )}
                <Box>
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'white',
                      fontWeight: 600,
                      fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.25rem' },
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                      lineHeight: { xs: 1.2, sm: 1.3 },
                    }}
                  >
                    {lineProfile ? lineProfile.displayName : T.appName}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      lineHeight: { xs: 1.1, sm: 1.2 },
                    }}
                  >
                    Kin-Geng AI Assistant
                  </Typography>
                </Box>
              </Box>

              {/* ✅ Right section: Navigation button อยู่มุมขวาสุด */}
              {!isEditMode && userProfileFromApi && (
                <Button
                  variant="contained"
                  onClick={() => {
                    window.location.href = '/nutrition-report/daily'
                  }}
                  startIcon={
                    <svg
                      width="20"
                      height="20"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.25L12 18l-7.5 1.25V21L12 19.75 19.5 21v-1.75z" />
                    </svg>
                  }
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' },
                    px: { xs: 2, sm: 3 },
                    py: 1,
                    minWidth: 'auto',
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    },
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                    รายงานโภชนาการ
                  </Box>
                  <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                    รายงาน
                  </Box>
                </Button>
              )}
            </Toolbar>
          </AppBar>
          <Container component="main" maxWidth="md" sx={{ mt: 2, mb: 2 }}>
            {profileError && !profileError.includes(T.noApiProfileData) && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {profileError}
              </Alert>
            )}
            {/* Render enhanced display mode or edit mode */}
            {isEditMode
              ? renderEditModeContent()
              : renderEnhancedDisplayContent()}
          </Container>
        </LiffIdHandler>
      </ThemeProvider>
    </LocalizationProvider>
  )
}

export default App
