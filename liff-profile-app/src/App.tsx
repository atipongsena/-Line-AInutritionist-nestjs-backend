import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from 'react-router-dom'
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
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { th, enUS } from 'date-fns/locale'
import { format, differenceInYears, isValid, parseISO } from 'date-fns'

// สร้าง interface สำหรับ LIFF SDK
interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

export interface LiffType {
  init(config: { liffId: string }): Promise<void>
  isLoggedIn(): boolean
  login(): void
  getIDToken(): string | null
  getProfile(): Promise<LiffProfile>
  getLanguage(): string
  closeWindow(): void
  // ปัจจุบัน LIFF SDK อาจไม่มีเมธอด isInitialized แล้ว
}

// Helper function to decode JWT (for debugging และตรวจสอบอายุ token)
const parseJwt = (token: string | null): object | null => {
  if (!token) {
    return null
  }
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        })
        .join(''),
    )
    return JSON.parse(jsonPayload) as object
  } catch (e) {
    console.error('Error decoding JWT:', e)
    return null
  }
}

// ฟังก์ชันตรวจสอบอายุของ token
const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true
  try {
    const decoded = parseJwt(token) as { exp?: number } | null
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

// const typedLiff: LiffType = liff as any; // Removed old assignment

import EditIcon from '@mui/icons-material/Edit'
import {
  SharedUserProfileDto,
  SharedUpdateUserProfileDto,
  Gender,
  ActivityLevel,
  DietType,
  PregnancyLactationStatus,
} from '@ai-nutritionist/shared-types'

// Lazy load NutritionReportMain for better initial load time
const NutritionReportMain = React.lazy(
  () => import('./nutrition-report/views/NutritionReportMain'),
)

// interface Profile {
//   userId: string
//   displayName: string
//   pictureUrl?: string
//   statusMessage?: string
// }

// Use LIFF ID from environment variable
const LIFF_ID = import.meta.env.VITE_LIFF_ID

console.log('import.meta.env.VITE_LIFF_ID:', import.meta.env.VITE_LIFF_ID)
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
  let displayValue: string | React.ReactNode = 'N/A'
  if (value !== undefined && value !== null) {
    if (Array.isArray(value)) {
      displayValue = value.join(', ') || 'N/A'
    } else if (typeof value === 'number') {
      displayValue = value.toString()
    } else if (typeof value === 'string' && value.trim() !== '') {
      displayValue = value
    }
  }

  // Special handling for age to show "ปี" or "years"
  if (label === translations.th.ageLabel && typeof value === 'number') {
    displayValue = `${value} ปี`
  } else if (label === translations.en.ageLabel && typeof value === 'number') {
    displayValue = `${value} years`
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, mb: 1, display: 'flex', justifyContent: 'space-between' }}
    >
      <Typography variant="body1" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body1"
        sx={{ textAlign: 'right', fontWeight: 'medium' }}
      >
        {displayValue}
      </Typography>
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

interface WindowWithLiff extends Window {
  liff?: LiffType & { [key: string]: any } // Make liff optional and allow other properties
}

function App() {
  const [liffObject, setLiffObject] = useState<LiffType | null>(null)
  const [isLiffSdkReady, setIsLiffSdkReady] = useState(false)
  const [isLiffInitialized, setIsLiffInitialized] = useState(false)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [lineProfile, setLineProfile] = useState<LiffProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [errorCount, setErrorCount] = useState<number>(0)
  const [hasInitiatedLoad, setHasInitiatedLoad] = useState<boolean>(false) // เพิ่ม state นี้เพื่อแทน window.hasInitiatedLoad

  const [userProfileFromApi, setUserProfileFromApi] =
    useState<SharedUserProfileDto | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [currentLang, setCurrentLang] = useState<'th' | 'en'>('th')
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<Partial<SharedUserProfileDto>>({})

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

  const T = translations[currentLang]

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[DEBUG] VITE_API_BASE_URL from env: ${import.meta.env.VITE_API_BASE_URL}`,
    )
    console.log('[DEBUG] apiBaseUrl in App.tsx:', apiBaseUrl)
  }

  const fetchWithTokenRetry = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      let currentIdToken: string | null = null

      if (liffObject && liffObject.isLoggedIn()) {
        if (process.env.NODE_ENV === 'development') {
          console.log(
            '[DEBUG] fetchWithTokenRetry: Attempting to get fresh ID token from liffObject.',
          )
        }
        currentIdToken = liffObject.getIDToken()
      } else {
        console.warn(
          '[DEBUG] fetchWithTokenRetry: liffObject not available or user not logged in. Cannot get ID token.',
        )
        throw new Error(
          'LIFF not initialized or user not logged in to get ID token.',
        )
      }

      if (!currentIdToken) {
        console.error(
          '[DEBUG] fetchWithTokenRetry: Failed to obtain ID token for API call.',
        )
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

      if (process.env.NODE_ENV === 'development') {
        console.log(
          '[DEBUG] fetchWithTokenRetry: Request Headers being set:',
          headers,
        )
      }

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        })

        // ตรวจสอบการตอบกลับที่เกี่ยวข้องกับ token หมดอายุ
        if (response.status === 401 || response.status === 403) {
          const responseText = await response.text()
          if (process.env.NODE_ENV === 'development') {
            console.warn('[DEBUG] Token error response:', responseText)
          }

          if (
            responseText.includes('expired') ||
            responseText.includes('Invalid')
          ) {
            if (process.env.NODE_ENV === 'development') {
              console.log(
                '[DEBUG] Token expired or invalid. Reloading the page...',
              )
            }

            // แสดงข้อความแจ้งเตือนให้ผู้ใช้ทราบ
            alert(
              'ช่วงเวลาเข้าสู่ระบบหมดอายุ กำลังรีเฟรชหน้าเว็บเพื่อเข้าสู่ระบบใหม่',
            )

            // หากต้องการรีเฟรชหน้า
            window.location.reload()

            throw new Error(
              'LINE login session expired. Reloading application...',
            )
          }
        }

        return response
      } catch (error) {
        console.error('[DEBUG] Fetch error:', error)

        // ตรวจสอบว่าถ้าเป็นข้อผิดพลาดเกี่ยวกับการเชื่อมต่อ
        if (
          error instanceof TypeError &&
          error.message.includes('Failed to fetch')
        ) {
          if (process.env.NODE_ENV === 'development') {
            console.log(
              '[DEBUG] Network error occurred. Please check your connection.',
            )
          }
        }

        throw error
      }
    },
    [liffObject],
  )

  useEffect(() => {
    // Wait for the LIFF SDK to load from the script tag
    const checkLiffSdk = () => {
      const windowWithLiff = window as WindowWithLiff
      if (
        windowWithLiff.liff &&
        typeof windowWithLiff.liff.init === 'function'
      ) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[LIFF_DEBUG] window.liff is available.')
        }
        setLiffObject(windowWithLiff.liff as LiffType)
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
          !!liffObject,
          'error:',
          error,
          'isLiffInitialized:',
          isLiffInitialized,
        )
      }

      if (!isLiffSdkReady || !liffObject) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            '[LIFF_DEBUG] LIFF SDK not ready or liffObject is null, skipping initialization.',
          )
        }
        if (!error && !isLiffInitialized)
          setError('Waiting for LIFF SDK to load...')
        return
      }

      const typedLiff = liffObject

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
          console.log('[LIFF_DEBUG] Attempting typedLiff.init().')
        }
        await typedLiff.init({ liffId: LIFF_ID })
        if (process.env.NODE_ENV === 'development') {
          console.log('[LIFF_DEBUG] Step 3: typedLiff.init() promise resolved.')
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
          const isLoggedIn = typedLiff.isLoggedIn()
          if (process.env.NODE_ENV === 'development') {
            console.log('[LIFF_DEBUG] liff.isLoggedIn() check:', isLoggedIn)
          }

          if (!isLoggedIn) {
            console.log(
              '[LIFF_DEBUG] liff.isLoggedIn() is false. Calling liff.login().',
            )
            typedLiff.login()
            return
          }
          if (process.env.NODE_ENV === 'development') {
            console.log('[LIFF_DEBUG] liff.isLoggedIn() is true.')
          }

          const token = typedLiff.getIDToken()
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
            typedLiff.login() // เข้าสู่ระบบใหม่
            return
          }

          const profile = await typedLiff.getProfile()
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
                    language: typedLiff.getLanguage() === 'th' ? 'th' : 'en',
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
              setProfileError(
                `${translations[currentLang].apiFetchError}: ${
                  (apiError as { message?: string })?.message ||
                  'Unknown API error'
                }`,
              )
              setErrorCount((prev) => prev + 1)
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
          '[LIFF_DEBUG] Step 3.E: Error during liff.init():',
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
    translations,
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
    if (!lineUserId || !idToken) {
      setSaveError(T.idTokenMissingError)
      return
    }
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

    const payload: SharedUpdateUserProfileDto = {
      ...formData,
      age:
        calculatedAge !== undefined && !isNaN(calculatedAge)
          ? calculatedAge
          : undefined,
      weightKg: formData.weightKg ? Number(formData.weightKg) : undefined,
      heightCm: formData.heightCm ? Number(formData.heightCm) : undefined,

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
    }

    if ('lineUserId' in payload) {
      delete (payload as Partial<SharedUserProfileDto>).lineUserId
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[PROFILE_DEBUG] Saving profile with payload:', payload)
    }

    try {
      // เปลี่ยน endpoint ให้ตรงกับที่ใช้ในการ fetch profile
      const response = await fetchWithTokenRetry(`${apiBaseUrl}/api/users/me`, {
        method: 'PUT', // ยังคงใช้ PUT method
        body: JSON.stringify(payload),
      })

      console.log(
        '[PROFILE_DEBUG] Profile save response status:',
        response.status,
      )

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

      setUserProfileFromApi(updatedProfile)
      setFormData(updatedProfile)
      setCurrentLang(updatedProfile.language === 'th' ? 'th' : 'en')
      setSaveSuccess(true)
      setIsEditMode(false)
      setCurrentStep(1)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: unknown) {
      console.error('[PROFILE_DEBUG] Save Profile Error:', err)
      setSaveError(
        `${T.apiSaveError}: ${(err as { message?: string })?.message || 'Unknown error'}`,
      )
      setTimeout(() => setSaveError(null), 5000)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleNextStep = () => setCurrentStep((prev) => prev + 1)
  const handlePrevStep = () => setCurrentStep((prev) => prev - 1)

  const navigate = useNavigate()
  const goToNutritionReport = useCallback(() => {
    void navigate('/nutrition-report')
  }, [navigate])

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
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container sx={{ textAlign: 'center', mt: 4 }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>
            {!isLiffSdkReady
              ? 'Loading LIFF SDK...'
              : !isLiffInitialized
                ? T.loadingLiff
                : T.loadingProfile}
          </Typography>
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
    <Paper
      elevation={3}
      sx={{ p: { xs: 1, sm: 2, md: 3 }, m: { xs: 0.5, sm: 1 } }}
    >
      <Typography
        variant="h6"
        gutterBottom
        component="div"
        sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
      >
        {T.userProfileTitle}
      </Typography>
      <Stepper
        activeStep={currentStep - 1}
        alternativeLabel
        sx={{
          mb: 2,
          '& .MuiStepLabel-label': {
            fontSize: { xs: '0.75rem', sm: '0.875rem' },
          },
        }}
      >
        {[
          T.step1Title,
          T.step2Title,
          T.step3Title,
          T.step4Title,
          T.step5Title,
          T.step6Title,
        ].map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {currentStep === 1 && (
        <Box sx={{ '& > *': { mb: { xs: 2, sm: 1 } } }}>
          <FormControl fullWidth size="small">
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
            <FormHelperText sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              {T.languageHelper}
            </FormHelperText>
          </FormControl>
          <TextField
            label={T.nicknameLabel}
            name="displayName"
            value={formData.displayName || ''}
            onChange={handleInputChange}
            fullWidth
            size="small"
            helperText={T.nicknameHelper}
            InputLabelProps={{
              sx: { fontSize: { xs: '0.9rem', sm: '1rem' } },
            }}
            FormHelperTextProps={{
              sx: { fontSize: { xs: '0.7rem', sm: '0.75rem' } },
            }}
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
              slotProps={{
                textField: {
                  size: 'small',
                  fullWidth: true,
                  InputLabelProps: {
                    sx: { fontSize: { xs: '0.9rem', sm: '1rem' } },
                  },
                  FormHelperTextProps: {
                    sx: { fontSize: { xs: '0.7rem', sm: '0.75rem' } },
                  },
                  helperText: T.birthdateHelper,
                },
              }}
              sx={{ width: '100%' }}
            />
          </LocalizationProvider>
          {calculatedAge !== undefined && (
            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                color: 'text.secondary',
              }}
            >
              {T.ageLabel}: {calculatedAge}{' '}
              {currentLang === 'th' ? 'ปี' : 'years'}
            </Typography>
          )}
          <FormControl component="fieldset" fullWidth>
            <Typography
              variant="subtitle1"
              gutterBottom
              sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
            >
              {T.genderLabel}
            </Typography>
            <ToggleButtonGroup
              value={formData.gender || ''}
              exclusive
              onChange={handleGenderChange}
              aria-label="gender selection"
              fullWidth
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  fontSize: { xs: '0.8rem', sm: '0.875rem' },
                  py: { xs: 0.5, sm: 1 },
                },
              }}
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
            <FormHelperText sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              {T.genderHelper}
            </FormHelperText>
          </FormControl>
        </Box>
      )}
      {currentStep === 2 && (
        <Box sx={{ '& > *': { mb: { xs: 2, sm: 1 } } }}>
          <FormControl fullWidth size="small">
            <InputLabel
              id="goal-label"
              sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
            >
              {T.goalLabel}
            </InputLabel>
            <Select
              labelId="goal-label"
              name="goal"
              value={formData.goal || ''}
              onChange={handleSelectChange}
              label={T.goalLabel}
              MenuProps={{
                PaperProps: {
                  sx: { maxHeight: 200 },
                },
              }}
            >
              {goalOptions.map((option) => (
                <MenuItem
                  key={option.value}
                  value={option.value}
                  sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                >
                  {getLocalizedOptionLabel(option, currentLang)}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              {T.goalHelper}
            </FormHelperText>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel
              id="activity-level-label"
              sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
            >
              {T.activityLevelLabel}
            </InputLabel>
            <Select
              labelId="activity-level-label"
              name="activityLevel"
              value={formData.activityLevel || ''}
              onChange={handleSelectChange}
              label={T.activityLevelLabel}
              MenuProps={{
                PaperProps: {
                  sx: { maxHeight: 200 },
                },
              }}
            >
              {activityLevelOptionsList.map((option) => (
                <MenuItem
                  key={option.value}
                  value={option.value}
                  sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                >
                  {getLocalizedOptionLabel(option, currentLang)}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              {T.activityLevelHelper}
            </FormHelperText>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel
              id="diet-type-label"
              sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
            >
              {T.dietTypeLabel}
            </InputLabel>
            <Select
              labelId="diet-type-label"
              name="dietType"
              value={formData.dietType || ''}
              onChange={handleSelectChange}
              label={T.dietTypeLabel}
              MenuProps={{
                PaperProps: {
                  sx: { maxHeight: 200 },
                },
              }}
            >
              {dietTypeOptionsList.map((option) => (
                <MenuItem
                  key={option.value}
                  value={option.value}
                  sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                >
                  {getLocalizedOptionLabel(option, currentLang)}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              {T.dietTypeHelper}
            </FormHelperText>
          </FormControl>
        </Box>
      )}
      {currentStep === 3 && renderStep3Content()}
      {currentStep === 4 && (
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
      {currentStep === 5 && (
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
      {currentStep === 6 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            {T.summaryTitle}
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

          {formData?.targetWeightKg !== undefined && (
            <ProfileListItem
              label={T.targetWeightLabel}
              value={formData.targetWeightKg ?? '-'}
            />
          )}
          {formData?.calculatedTdee !== undefined && (
            <ProfileListItem
              label={T.calculatedCaloriesLabel}
              value={
                formData.calculatedTdee
                  ? `${formData.calculatedTdee} kcal`
                  : '-'
              }
            />
          )}
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

  return (
    <LocalizationProvider
      dateAdapter={AdapterDateFns}
      adapterLocale={currentLang === 'th' ? th : enUS}
    >
      <ThemeProvider theme={theme}>
        <LiffIdHandler>
          <CssBaseline />
          <AppBar position="static">
            <Toolbar>
              {lineProfile && lineProfile.pictureUrl && (
                <IconButton sx={{ p: 0, mr: 1 }}>
                  <img
                    src={lineProfile.pictureUrl}
                    alt={lineProfile.displayName}
                    style={{ width: 32, height: 32, borderRadius: '50%' }}
                  />
                </IconButton>
              )}
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                {lineProfile ? lineProfile.displayName : T.appName}
              </Typography>
              {!isEditMode && userProfileFromApi && (
                <Button
                  color="inherit"
                  onClick={() => void goToNutritionReport()}
                >
                  {T.nutritionReportTitle}
                </Button>
              )}
            </Toolbar>
          </AppBar>
          <Container
            component="main"
            maxWidth="md"
            sx={{ mt: 1, mb: 1, px: { xs: 1, sm: 2 } }}
          >
            {profileError && !profileError.includes(T.noApiProfileData) && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {profileError}
              </Alert>
            )}
            <Box sx={{ px: 1, py: 1 }}>
              <Suspense fallback={<CircularProgress />}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      isEditMode
                        ? renderEditModeContent()
                        : renderDisplayModeContent()
                    }
                  />
                  <Route
                    path="/nutrition-report"
                    element={<NutritionReportMain />}
                  />
                  <Route
                    path="/daily-report"
                    element={<NutritionReportMain />}
                  />
                </Routes>
              </Suspense>
            </Box>
          </Container>
        </LiffIdHandler>
      </ThemeProvider>
    </LocalizationProvider>
  )
}

const AppWithRouter: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/*" element={<App />} />
      </Routes>
    </Router>
  )
}

export default AppWithRouter
