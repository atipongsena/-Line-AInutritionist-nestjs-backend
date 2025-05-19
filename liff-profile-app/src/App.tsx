import React, { useEffect, useState, useMemo } from 'react'
import liff from '@line/liff'
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
  Typography,
  CircularProgress,
  Box,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  TextField,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardContent,
  Grid,
  FormHelperText,
} from '@mui/material'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { th, enUS } from 'date-fns/locale'
import {
  SharedUserProfileDto,
  Gender,
  ActivityLevel,
  DietType,
  PregnancyLactationStatus,
} from '@ai-nutritionist/shared-types'
import MultipleCheckboxWithOther from './MultipleCheckboxWithOther'

// Helper function to decode JWT (for debugging purposes ONLY)
const parseJwt = (token: string | null) => {
  if (!token) return null
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
    return JSON.parse(jsonPayload)
  } catch (e) {
    console.error('Error decoding JWT:', e)
    return null
  }
}

// Define Profile type based on liff.getProfile() response
interface Profile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

// Use LIFF ID from environment variable
const LIFF_ID = process.env.REACT_APP_LIFF_ID

console.log('process.env.REACT_APP_LIFF_ID:', process.env.REACT_APP_LIFF_ID)
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

// --- Localization (i18n) ---
interface Translations {
  [key: string]: {
    // General
    appName: string
    userProfileTitle: string
    loadingLiff: string
    loadingProfile: string
    saveChangesButton: string
    editProfileButton: string
    nextButton: string
    backButton: string
    cancelButton: string
    stepOutOf: string
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
    appName: 'โปรไฟล์สุขภาพ AI Nutritionist',
    userProfileTitle: 'โปรไฟล์ผู้ใช้',
    loadingLiff: 'กำลังเริ่มต้น LIFF...',
    loadingProfile: 'กำลังโหลดข้อมูลโปรไฟล์...',
    saveChangesButton: 'บันทึกการเปลี่ยนแปลง',
    editProfileButton: 'แก้ไขโปรไฟล์',
    nextButton: 'ถัดไป',
    backButton: 'ย้อนกลับ',
    cancelButton: 'ยกเลิก',
    stepOutOf: 'ขั้นตอนที่ {current} จาก {total}',
    liffIdMissingError: 'ข้อผิดพลาดการตั้งค่า: ไม่พบ LIFF ID',
    liffInitError: 'เกิดข้อผิดพลาดในการเริ่มต้น LIFF: {message}',
    apiFetchError: 'ไม่สามารถโหลดโปรไฟล์จากเซิร์ฟเวอร์: {message}',
    apiSaveError: 'ไม่สามารถบันทึกโปรไฟล์: {message}',
    idTokenMissingError: 'ไม่สามารถบันทึก: ไม่พบ ID Token',
    welcomeMessage: 'ยินดีต้อนรับ, {name}!',
    lineUserIdLabel: 'LINE User ID',
    idTokenLabel: 'ID Token (เริ่มต้น)',
    apiProfileDataTitle: 'ข้อมูลโปรไฟล์ (จาก /api/users/me):',
    noApiProfileData: 'ยังไม่มีข้อมูลโปรไฟล์จาก API หรือการเรียก API ล้มเหลว',
    step1Title: 'ข้อมูลส่วนตัว',
    languageLabel: 'ภาษาในการตอบกลับ',
    languageHelper: 'เลือกภาษาที่ต้องการให้ AI ใช้สื่อสารกับคุณ',
    nicknameLabel: 'ชื่อเล่น (ให้ AI เรียก)',
    nicknameHelper: 'เราจะใช้ชื่อนี้เรียกคุณ',
    birthdateLabel: 'วันเกิด',
    birthdateHelper: 'เลือกวันเกิดของคุณเพื่อคำนวณอายุ',
    ageLabel: 'อายุ (ปี)',
    genderLabel: 'เพศ',
    genderHelper: 'ระบุเพศของคุณ',
    male: 'ชาย',
    female: 'หญิง',
    other: 'อื่นๆ/ไม่ระบุ',
    step2Title: 'เป้าหมายและไลฟ์สไตล์',
    goalLabel: 'เป้าหมายสุขภาพ',
    goalHelper: 'เลือกเป้าหมายหลักของคุณ',
    goalOptions: {
      weight_loss: 'ลดน้ำหนัก',
      weight_gain: 'เพิ่มน้ำหนัก',
      muscle_gain: 'เพิ่มกล้ามเนื้อ',
      maintenance: 'รักษาน้ำหนัก',
      general_health: 'ปรับสมดุลสุขภาพทั่วไป',
    },
    activityLevelLabel: 'ระดับกิจกรรม',
    activityLevelHelper: 'คุณเคลื่อนไหวร่างกายมากน้อยแค่ไหนในแต่ละวัน?',
    activityLevelOptions: {
      sedentary: 'ไม่ออกกำลังกาย (นั่งทำงาน)',
      light: 'เบา (ออกกำลังกาย 1-2 วัน/สัปดาห์)',
      moderate: 'ปานกลาง (ออกกำลังกาย 3-5 วัน/สัปดาห์)',
      active: 'หนัก (ออกกำลังกาย 6-7 วัน/สัปดาห์)',
      very_active: 'หนักมาก (ทำงานใช้แรงงาน / ออกกำลังกาย 2 ครั้ง/วัน)',
    },
    dietTypeLabel: 'รูปแบบการทานอาหาร',
    dietTypeHelper: 'คุณมีรูปแบบการทานอาหารแบบใดเป็นพิเศษหรือไม่?',
    dietTypeOptions: {
      normal: 'ทั่วไป (Normal)',
      if_16_8: 'IF 16/8',
      if_5_2: 'IF 5:2',
      keto: 'คีโต (Keto)',
      low_carb: 'Low-carb',
      paleo: 'Paleo',
      vegetarian: 'มังสวิรัติ (Vegetarian)',
      vegan: 'เจ / วีแกน (Vegan)',
      mediterranean: 'เมดิเตอร์เรเนียน',
      high_protein: 'โปรตีนสูง',
    },
    step3Title: 'สุขภาพและข้อจำกัด',
    healthConditionsLabel: 'โรคประจำตัว (เลือกได้หลายข้อ ถ้ามี)',
    foodAllergiesLabel: 'แพ้อาหาร / ข้อจำกัดด้านอาหาร (เลือกได้หลายข้อ ถ้ามี)',
    step4Title: 'ข้อมูลเพิ่มเติม',
    ethicalConsiderationsLabel: 'ศาสนา / แนวทางจริยธรรม (เลือกได้หลายข้อ)',
    pregnancyStatusLabel: 'การตั้งครรภ์ / ให้นมบุตร',
    pregnancyStatusHelper: 'กรุณาระบุหากคุณกำลังตั้งครรภ์หรือให้นมบุตร',
    pregnancyOptions: {
      not_applicable: 'ไม่ใช่ / ไม่ระบุ',
      pregnant: 'กำลังตั้งครรภ์',
      lactating: 'ให้นมบุตร',
    },
    preferredCuisineLabel: 'วัฒนธรรมอาหารที่ชอบ (เลือกได้หลายข้อ)',
    preferredFlavorProfilesLabel: 'รสชาติที่ชอบ (เลือกได้หลายข้อ)',
    step5Title: 'ข้อมูลทางกายภาพ',
    weightLabel: 'น้ำหนัก (กก.)',
    weightHelper: 'ระบุน้ำหนักปัจจุบันของคุณ',
    heightLabel: 'ส่วนสูง (ซม.)',
    heightHelper: 'ระบุส่วนสูงปัจจุบันของคุณ',
    bmiLabel: 'BMI',
    bmiCalculatedLabel: 'BMI ของคุณคือ {bmiValue} ({status})',
    step6Title: 'สรุปและบันทึก',
    summaryTitle: 'สรุปข้อมูลของคุณ',
    targetWeightLabel: 'น้ำหนักเป้าหมาย (กก.)',
    calculatedCaloriesLabel: 'แคลอรี่ที่แนะนำต่อวัน',
    profileUpdatedSuccess: 'อัปเดตโปรไฟล์สำเร็จ!',
  },
  en: {
    appName: 'AI Nutritionist Health Profile',
    userProfileTitle: 'User Profile',
    loadingLiff: 'Initializing LIFF...',
    loadingProfile: 'Loading profile data...',
    saveChangesButton: 'Save Changes',
    editProfileButton: 'Edit Profile',
    nextButton: 'Next',
    backButton: 'Back',
    cancelButton: 'Cancel',
    stepOutOf: 'Step {current} of {total}',
    liffIdMissingError: 'Configuration error: LIFF ID is missing.',
    liffInitError: 'LIFF Initialization failed: {message}',
    apiFetchError: 'Failed to load app profile: {message}',
    apiSaveError: 'Failed to save profile: {message}',
    idTokenMissingError: 'Cannot save: ID Token is missing.',
    welcomeMessage: 'Welcome, {name}!',
    lineUserIdLabel: 'LINE User ID',
    idTokenLabel: 'ID Token (start)',
    apiProfileDataTitle: 'API Profile Data (from /api/users/me):',
    noApiProfileData: 'No profile data loaded from API yet or API call failed.',
    step1Title: 'Personal Info',
    languageLabel: 'Response Language',
    languageHelper: 'Select the language for AI responses.',
    nicknameLabel: 'Nickname (for AI)',
    nicknameHelper: 'How should we call you?',
    birthdateLabel: 'Birthdate',
    birthdateHelper: 'Select your birthdate to calculate age.',
    ageLabel: 'Age (Years)',
    genderLabel: 'Gender',
    genderHelper: 'Specify your gender.',
    male: 'Male',
    female: 'Female',
    other: 'Other/Prefer not to say',
    step2Title: 'Goals & Lifestyle',
    goalLabel: 'Health Goal',
    goalHelper: 'Choose your primary health goal.',
    goalOptions: {
      weight_loss: 'Weight Loss',
      weight_gain: 'Weight Gain',
      muscle_gain: 'Muscle Gain',
      maintenance: 'Weight Maintenance',
      general_health: 'General Health Improvement',
    },
    activityLevelLabel: 'Activity Level',
    activityLevelHelper: 'How active are you on a daily basis?',
    activityLevelOptions: {
      sedentary: 'Sedentary (office job)',
      light: 'Light (exercise 1-2 days/week)',
      moderate: 'Moderate (exercise 3-5 days/week)',
      active: 'Active (exercise 6-7 days/week)',
      very_active: 'Very Active (hard physical work / exercise 2x/day)',
    },
    dietTypeLabel: 'Dietary Pattern',
    dietTypeHelper: 'Do you follow any specific dietary pattern?',
    dietTypeOptions: {
      normal: 'Normal',
      if_16_8: 'IF 16/8',
      if_5_2: 'IF 5:2',
      keto: 'Keto',
      low_carb: 'Low-carb',
      paleo: 'Paleo',
      vegetarian: 'Vegetarian',
      vegan: 'Vegan',
      mediterranean: 'Mediterranean',
      high_protein: 'High Protein',
    },
    step3Title: 'Health & Restrictions',
    healthConditionsLabel: 'Health Conditions (select multiple if any)',
    foodAllergiesLabel:
      'Food Allergies / Restrictions (select multiple if any)',
    step4Title: 'Additional Preferences',
    ethicalConsiderationsLabel:
      'Ethical/Religious Food Considerations (select multiple)',
    pregnancyStatusLabel: 'Pregnancy / Lactation Status',
    pregnancyStatusHelper: 'Please specify if you are pregnant or lactating.',
    pregnancyOptions: {
      not_applicable: 'Not Applicable / Prefer not to say',
      pregnant: 'Pregnant',
      lactating: 'Lactating',
    },
    preferredCuisineLabel: 'Preferred Cuisines (select multiple)',
    preferredFlavorProfilesLabel: 'Preferred Flavor Profiles (select multiple)',
    step5Title: 'Physical Information',
    weightLabel: 'Weight (kg)',
    weightHelper: 'Enter your current weight.',
    heightLabel: 'Height (cm)',
    heightHelper: 'Enter your current height.',
    bmiLabel: 'BMI',
    bmiCalculatedLabel: 'Your BMI is {bmiValue} ({status})',
    step6Title: 'Summary & Save',
    summaryTitle: 'Your Profile Summary',
    targetWeightLabel: 'Target Weight (kg)',
    calculatedCaloriesLabel: 'Recommended Daily Calories',
    profileUpdatedSuccess: 'Profile updated successfully!',
  },
}

// Helper function to render profile items
const ProfileListItem: React.FC<{
  label: string
  value?: string | string[] | number | null
}> = ({ label, value }) => {
  if (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return null // Don't render if value is not set or an empty array
  }
  const displayValue = Array.isArray(value) ? value.join(', ') : String(value)
  return (
    <>
      <ListItem>
        <ListItemText primary={label} secondary={displayValue || 'N/A'} />
      </ListItem>
      <Divider component="li" />
    </>
  )
}

// Define options for multi-select fields
const healthConditionOptions = [
  { value: 'diabetes', labelTh: 'เบาหวาน', labelEn: 'Diabetes' },
  {
    value: 'hypertension',
    labelTh: 'ความดันโลหิตสูง',
    labelEn: 'Hypertension',
  },
  { value: 'kidney_disease', labelTh: 'โรคไต', labelEn: 'Kidney Disease' },
  { value: 'heart_disease', labelTh: 'โรคหัวใจ', labelEn: 'Heart Disease' },
  {
    value: 'hyperlipidemia',
    labelTh: 'ไขมันในเลือดสูง',
    labelEn: 'Hyperlipidemia',
  },
  { value: 'gerd', labelTh: 'โรคกรดไหลย้อน', labelEn: 'GERD' },
  { value: 'ibs', labelTh: 'โรคลำไส้แปรปรวน', labelEn: 'IBS' },
  { value: 'gout', labelTh: 'โรคเกาต์', labelEn: 'Gout' },
  // { value: 'none', label: 'ไม่มี' }
]

const foodAllergyOptions = [
  { value: 'peanut', labelTh: 'ถั่วลิสง', labelEn: 'Peanut' },
  { value: 'tree_nuts', labelTh: 'ถั่วเปลือกแข็งอื่นๆ', labelEn: 'Tree Nuts' },
  { value: 'dairy', labelTh: 'นมวัว', labelEn: 'Dairy' },
  { value: 'gluten', labelTh: 'กลูเตน', labelEn: 'Gluten' },
  {
    value: 'seafood_shellfish',
    labelTh: 'อาหารทะเล (กุ้ง, หอย, ปู)',
    labelEn: 'Seafood (Shellfish)',
  },
  {
    value: 'seafood_fish',
    labelTh: 'อาหารทะเล (ปลา)',
    labelEn: 'Seafood (Fish)',
  },
  { value: 'egg', labelTh: 'ไข่', labelEn: 'Egg' },
  { value: 'soy', labelTh: 'ถั่วเหลือง', labelEn: 'Soy' },
  { value: 'sesame', labelTh: 'งา', labelEn: 'Sesame' },
  { value: 'mustard', labelTh: 'มัสตาร์ด', labelEn: 'Mustard' },
  { value: 'celery', labelTh: 'ขึ้นฉ่ายฝรั่ง (Celery)', labelEn: 'Celery' },
  {
    value: 'sulfites',
    labelTh: 'ซัลไฟต์ (สารกันบูดในไวน์, ผลไม้แห้ง)',
    labelEn: 'Sulfites',
  },
  // { value: 'none', label: 'ไม่มีแพ้ / ไม่มีข้อจำกัด' }
]

const ethicalConsiderationOptions = [
  {
    value: 'vegetarian_jain',
    labelTh: 'ทานอาหารเจ',
    labelEn: 'Jain Vegetarian',
  },
  { value: 'halal', labelTh: 'ฮาลาล', labelEn: 'Halal' },
  { value: 'no_beef', labelTh: 'ไม่ทานเนื้อวัว', labelEn: 'No Beef' },
]

const cuisineOptions = [
  { value: 'thai', labelTh: 'ไทย', labelEn: 'Thai' },
  { value: 'japanese', labelTh: 'ญี่ปุ่น', labelEn: 'Japanese' },
  { value: 'western', labelTh: 'ตะวันตก', labelEn: 'Western' },
  { value: 'chinese', labelTh: 'จีน', labelEn: 'Chinese' },
  {
    value: 'indian_arabic',
    labelTh: 'อินเดีย / อาหรับ',
    labelEn: 'Indian / Arabic',
  },
  {
    value: 'other_cuisine',
    labelTh: 'อื่นๆ (โปรดระบุในรายละเอียดเพิ่มเติม หากจำเป็น)',
    labelEn: 'Other Cuisine (Please specify in additional details if needed)',
  }, // Simple "Other"
]

const flavorProfileOptions = [
  { value: 'spicy_hot', labelTh: 'เผ็ดจัด', labelEn: 'Very Spicy' },
  { value: 'mild_flavor', labelTh: 'รสกลาง', labelEn: 'Mild Flavor' },
  { value: 'bland', labelTh: 'จืด', labelEn: 'Bland' },
  {
    value: 'low_sugar_salt',
    labelTh: 'หวานน้อย / เค็มน้อย',
    labelEn: 'Low Sugar / Low Salt',
  },
  {
    value: 'non_oily_fried',
    labelTh: 'ไม่ชอบมัน / ของทอด',
    labelEn: 'Non-Oily / Non-Fried',
  },
]

// Helper function to get localized option label
const getLocalizedOptionLabel = (
  option: { value: string; labelTh: string; labelEn: string },
  lang: 'th' | 'en',
) => {
  return lang === 'th' ? option.labelTh : option.labelEn
}

function App() {
  const [lineLiffProfile, setLineLiffProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLiffInitialized, setIsLiffInitialized] = useState(false)
  const [userProfileFromApi, setUserProfileFromApi] =
    useState<SharedUserProfileDto | null>(null)
  const [isLoadingApi, setIsLoadingApi] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentLang, setCurrentLang] = useState<'th' | 'en'>('th')
  const T = useMemo(() => translations[currentLang], [currentLang])

  const initialFormData: Partial<SharedUserProfileDto> = {
    language: 'th',
    gender: 'not_specified' as Gender,
    goal: 'maintenance' as SharedUserProfileDto['goal'],
    activityLevel: 'moderate' as ActivityLevel,
    dietType: 'normal' as DietType,
    healthConditions: [],
    foodAllergies: [],
    ethicalFoodConsiderations: [],
    pregnancyLactationStatus: 'not_applicable' as PregnancyLactationStatus,
    preferredCuisine: [],
    preferredFlavorProfiles: [],
  }
  const [formData, setFormData] =
    useState<Partial<SharedUserProfileDto>>(initialFormData)
  const [birthDate, setBirthDate] = useState<Date | null>(null)

  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 6

  // Helper function for API calls with token refresh and retry logic
  const fetchWithTokenRetry = async (
    url: string,
    options: RequestInit = {},
    retryCount = 0,
    maxRetries = 1, // Only retry once for token expiry
  ): Promise<Response> => {
    const currentIdToken = liff.getIDToken()
    if (!currentIdToken) {
      // This case should ideally be handled before calling, e.g. by ensuring liff.isLoggedIn()
      // and that liff.getIDToken() is available.
      throw new Error('LIFF ID Token is not available.')
    }
    console.log('Current ID Token (raw) for fetch:', currentIdToken)
    console.log('Decoded ID Token for fetch:', parseJwt(currentIdToken))

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-LINE-ID-TOKEN': currentIdToken,
      },
    })

    if (!response.ok) {
      const errorText = await response.text() // Read error text once
      if (
        (response.status === 401 || response.status === 403) &&
        errorText.toLowerCase().includes('expired') && // More robust check for expiry
        retryCount < maxRetries
      ) {
        console.warn(
          `ID Token expired for ${options.method || 'GET'} ${url}. Retrying (attempt ${retryCount + 1}).`,
        )
        await new Promise((resolve) => setTimeout(resolve, 250)) // Small delay before retry
        return fetchWithTokenRetry(url, options, retryCount + 1, maxRetries)
      }
      // For other errors, or if max retries reached, throw the original error info
      throw new Error(
        `API Error ${response.status}: ${errorText || response.statusText}`,
      )
    }
    return response
  }

  useEffect(() => {
    const initializeLiffAndLoadProfile = async () => {
      try {
        console.log(
          'LIFF_ID inside initializeLiffAndLoadProfile before init:',
          LIFF_ID,
        ) // Log it again here
        if (!LIFF_ID) {
          setError(T.liffIdMissingError)
          setIsLiffInitialized(true)
          return
        }
        await liff.init({ liffId: LIFF_ID })
        setIsLiffInitialized(true)

        if (!liff.isLoggedIn()) {
          liff.login()
          return // liff.login() will redirect
        }

        const liffProfileData = await liff.getProfile()
        setLineLiffProfile(liffProfileData)

        // Fetch user profile from API
        setIsLoadingApi(true)
        try {
          const backendApiUrl = 'http://localhost:3001/api/users/me'
          // Log token before this specific fetch too
          const tokenForProfileFetch = liff.getIDToken()
          console.log(
            'ID Token (raw) before /api/users/me:',
            tokenForProfileFetch,
          )
          console.log(
            'Decoded ID Token before /api/users/me:',
            parseJwt(tokenForProfileFetch),
          )

          const response = await fetchWithTokenRetry(backendApiUrl, {
            method: 'GET',
          })
          const data: SharedUserProfileDto = await response.json()

          setUserProfileFromApi(data)
          setFormData({
            ...initialFormData,
            ...data,
            healthConditions: data.healthConditions || [],
            foodAllergies: data.foodAllergies || [],
            ethicalFoodConsiderations: data.ethicalFoodConsiderations || [],
            preferredCuisine: data.preferredCuisine || [],
            preferredFlavorProfiles: data.preferredFlavorProfiles || [],
          })
          if (data.language) setCurrentLang(data.language as 'th' | 'en')
          if (data.birthDate) setBirthDate(new Date(data.birthDate))
          setError(null) // Clear previous errors on successful load
        } catch (apiError: any) {
          setError(T.apiFetchError.replace('{message}', apiError.message))
        } finally {
          setIsLoadingApi(false)
        }
      } catch (e: any) {
        setError(T.liffInitError.replace('{message}', e.message))
        if (!isLiffInitialized) setIsLiffInitialized(true) // Ensure loading state is cleared if init fails early
      }
    }
    // if (!isLiffInitialized) { // This condition might be too restrictive if LIFF can de-initialize
    initializeLiffAndLoadProfile()
    // }
  }, []) // Removed T from dependency array to prevent re-fetch on language change in UI before save
  // which is handled separately. Consider if there are other scenarios for re-init.

  const calculatedAge = useMemo(() => {
    if (!birthDate) return formData.age || null
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }, [birthDate, formData.age])

  const calculatedBmi = useMemo(() => {
    if (formData.weightKg && formData.heightCm) {
      const heightInMeters = formData.heightCm / 100
      if (heightInMeters > 0) {
        return (formData.weightKg / (heightInMeters * heightInMeters)).toFixed(
          2,
        )
      }
    }
    return null
  }, [formData.weightKg, formData.heightCm])

  const getBmiStatus = (
    bmi: number | null | string,
    lang: 'th' | 'en',
  ): string => {
    if (bmi === null) return ''
    const bmiNum = parseFloat(bmi as string)
    if (lang === 'th') {
      if (bmiNum < 18.5) return 'น้ำหนักน้อย'
      if (bmiNum < 23) return 'ปกติ'
      if (bmiNum < 25) return 'ท้วม'
      if (bmiNum < 30) return 'อ้วนระดับ 1'
      return 'อ้วนระดับ 2'
    } else {
      if (bmiNum < 18.5) return 'Underweight'
      if (bmiNum < 25) return 'Normal' // Standard BMI range
      if (bmiNum < 30) return 'Overweight'
      return 'Obese'
    }
  }

  const getGenderDisplay = (genderKey?: Gender): string | undefined => {
    if (!genderKey) return undefined
    if (genderKey === 'male') return T.male
    if (genderKey === 'female') return T.female
    // For 'not_specified', 'other', and any 'lgbtq_' values, use T.other
    if (
      genderKey === 'not_specified' ||
      genderKey === 'other' ||
      genderKey.startsWith('lgbtq_')
    ) {
      return T.other
    }
    return T.other // Fallback
  }

  const calculatedCalories = useMemo(() => {
    if (
      !formData.weightKg ||
      !formData.heightCm ||
      !calculatedAge ||
      !formData.gender ||
      !formData.activityLevel
    ) {
      return null
    }
    // Mifflin-St Jeor Equation for BMR
    let bmr
    if (formData.gender === 'male') {
      bmr =
        10 * formData.weightKg +
        6.25 * formData.heightCm -
        5 * calculatedAge +
        5
    } else if (formData.gender === 'female') {
      bmr =
        10 * formData.weightKg +
        6.25 * formData.heightCm -
        5 * calculatedAge -
        161
    } else {
      // For 'other' or 'not_specified', use an average or a method less dependent on binary gender
      // Using average of male and female for simplicity, or could prompt for biological sex for calculation
      bmr =
        10 * formData.weightKg +
        6.25 * formData.heightCm -
        5 * calculatedAge -
        78 // Average offset
    }

    let activityMultiplier = 1.2 // Default for sedentary
    switch (formData.activityLevel) {
      case 'light':
        activityMultiplier = 1.375
        break
      case 'moderate':
        activityMultiplier = 1.55
        break
      case 'active':
        activityMultiplier = 1.725
        break
      case 'very_active':
        activityMultiplier = 1.9
        break
    }
    const tdee = bmr * activityMultiplier

    // Adjust TDEE based on goal
    let calorieGoal = tdee
    switch (formData.goal) {
      case 'weight_loss':
        calorieGoal -= 500
        break // Typical deficit
      case 'weight_gain':
        calorieGoal += 500
        break // Typical surplus
      case 'muscle_gain':
        calorieGoal += 300
        break // Smaller surplus for lean gain
      // case 'maintenance': // No change
      // case 'general_health': // No change, focus on quality
    }
    return Math.round(calorieGoal)
  }, [
    formData.weightKg,
    formData.heightCm,
    calculatedAge,
    formData.gender,
    formData.activityLevel,
    formData.goal,
  ])

  const handleEditToggle = () => {
    if (!isEditMode && userProfileFromApi) {
      setFormData({
        ...initialFormData,
        ...userProfileFromApi,
        healthConditions: userProfileFromApi.healthConditions || [],
        foodAllergies: userProfileFromApi.foodAllergies || [],
        ethicalFoodConsiderations:
          userProfileFromApi.ethicalFoodConsiderations || [],
        preferredCuisine: userProfileFromApi.preferredCuisine || [],
        preferredFlavorProfiles:
          userProfileFromApi.preferredFlavorProfiles || [],
      })
      if (userProfileFromApi.language)
        setCurrentLang(userProfileFromApi.language as 'th' | 'en')
      if (userProfileFromApi.birthDate)
        setBirthDate(new Date(userProfileFromApi.birthDate))
    } else if (isEditMode) {
      setFormData(
        userProfileFromApi
          ? {
              ...initialFormData,
              ...userProfileFromApi,
              healthConditions: userProfileFromApi.healthConditions || [],
              foodAllergies: userProfileFromApi.foodAllergies || [],
              ethicalFoodConsiderations:
                userProfileFromApi.ethicalFoodConsiderations || [],
              preferredCuisine: userProfileFromApi.preferredCuisine || [],
              preferredFlavorProfiles:
                userProfileFromApi.preferredFlavorProfiles || [],
            }
          : initialFormData,
      )
      if (userProfileFromApi?.language)
        setCurrentLang(userProfileFromApi.language as 'th' | 'en')
      if (userProfileFromApi?.birthDate)
        setBirthDate(new Date(userProfileFromApi.birthDate))
    }
    setCurrentStep(1)
    setIsEditMode(!isEditMode)
  }

  const handleInputChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }
    >,
  ) => {
    const target = event.target as HTMLInputElement
    const { name, value } = target
    setFormData((prev) => ({ ...prev, [name as string]: value }))
  }

  const handleGenderChange = (
    event: React.MouseEvent<HTMLElement>,
    newGender: string | null,
  ) => {
    if (newGender !== null) {
      setFormData((prev) => ({ ...prev, gender: newGender as Gender }))
    }
  }

  const handleSelectChange = (event: any) => {
    const { name, value } = event.target
    if (name === 'language') {
      setCurrentLang(value as 'th' | 'en')
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleMultipleCheckboxChange = (
    fieldName: string,
    newValues: string[],
  ) => {
    setFormData((prev) => ({ ...prev, [fieldName]: newValues }))
  }

  const handleSave = async () => {
    // No need to get token here, fetchWithTokenRetry will do it
    const profileToSave: Partial<SharedUserProfileDto> = {
      ...formData,
      age: calculatedAge !== null ? calculatedAge : undefined,
      birthDate: birthDate ? birthDate.toISOString().split('T')[0] : undefined,
    }

    // Log token before save
    const tokenForSave = liff.getIDToken()
    console.log('ID Token (raw) before PUT /api/users/me:', tokenForSave)
    console.log(
      'Decoded ID Token before PUT /api/users/me:',
      parseJwt(tokenForSave),
    )

    setIsLoadingApi(true)
    try {
      const backendApiUrl = 'http://localhost:3001/api/users/me'
      const response = await fetchWithTokenRetry(backendApiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileToSave),
      })
      const updatedProfile: SharedUserProfileDto = await response.json()

      setUserProfileFromApi(updatedProfile)
      setFormData({
        ...initialFormData,
        ...updatedProfile,
        healthConditions: updatedProfile.healthConditions || [],
        foodAllergies: updatedProfile.foodAllergies || [],
        ethicalFoodConsiderations:
          updatedProfile.ethicalFoodConsiderations || [],
        preferredCuisine: updatedProfile.preferredCuisine || [],
        preferredFlavorProfiles: updatedProfile.preferredFlavorProfiles || [],
      })
      if (updatedProfile.language)
        setCurrentLang(updatedProfile.language as 'th' | 'en')
      if (updatedProfile.birthDate)
        setBirthDate(new Date(updatedProfile.birthDate))
      setIsEditMode(false)
      setCurrentStep(1)
      setError(null) // Clear error on success
      alert(T.profileUpdatedSuccess)
    } catch (apiError: any) {
      setError(T.apiSaveError.replace('{message}', apiError.message))
    } finally {
      setIsLoadingApi(false)
    }
  }

  const handleNextStep = () => setCurrentStep((prev) => prev + 1)
  const handlePrevStep = () => setCurrentStep((prev) => prev - 1)

  // --- Render Logic ---
  if (error) {
    return (
      <ThemeProvider theme={theme}>
        {' '}
        <CssBaseline />
        <Container sx={{ textAlign: 'center', mt: 4 }}>
          {' '}
          <Alert severity="error">{error}</Alert>{' '}
        </Container>
      </ThemeProvider>
    )
  }

  if (
    !isLiffInitialized ||
    (liff.isLoggedIn() && isLoadingApi && !userProfileFromApi)
  ) {
    // Show loading if API call is in progress after LIFF init
    return (
      <ThemeProvider theme={theme}>
        {' '}
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
          }}
        >
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>
            {!isLiffInitialized ? T.loadingLiff : T.loadingProfile}
          </Typography>
        </Box>
      </ThemeProvider>
    )
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Personal Info
        return (
          <>
            <Typography variant="h5" gutterBottom>
              {T.step1Title}
            </Typography>
            <FormControl fullWidth margin="normal">
              <InputLabel id="language-select-label">
                {T.languageLabel}
              </InputLabel>
              <Select
                labelId="language-select-label"
                name="language"
                value={formData.language || 'th'}
                label={T.languageLabel}
                onChange={handleSelectChange}
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
            <DatePicker
              label={T.birthdateLabel}
              value={birthDate}
              onChange={(newValue) => setBirthDate(newValue)}
              sx={{ width: '100%', mt: 2, mb: 1 }}
            />
            <FormHelperText sx={{ ml: 1.5 }}>
              {T.birthdateHelper}
            </FormHelperText>
            {calculatedAge !== null && (
              <Typography variant="body1" sx={{ mt: 1 }}>
                {T.ageLabel}: {calculatedAge}
              </Typography>
            )}

            <FormControl component="fieldset" margin="normal" fullWidth>
              <Typography variant="subtitle1" gutterBottom>
                {T.genderLabel}
              </Typography>
              <ToggleButtonGroup
                value={formData.gender}
                exclusive
                onChange={handleGenderChange}
                aria-label="gender"
                fullWidth
              >
                <ToggleButton value={'female' as Gender} aria-label="female">
                  {T.female}
                </ToggleButton>
                <ToggleButton value={'male' as Gender} aria-label="male">
                  {T.male}
                </ToggleButton>
                <ToggleButton
                  value={'not_specified' as Gender}
                  aria-label="other"
                >
                  {T.other}
                </ToggleButton>
              </ToggleButtonGroup>
              <FormHelperText>{T.genderHelper}</FormHelperText>
            </FormControl>
          </>
        )
      case 2: // Goals & Lifestyle
        return (
          <>
            <Typography variant="h5" gutterBottom>
              {T.step2Title}
            </Typography>
            <FormControl fullWidth margin="normal">
              <InputLabel id="goal-select-label">{T.goalLabel}</InputLabel>
              <Select
                labelId="goal-select-label"
                name="goal"
                value={formData.goal || 'maintenance'}
                label={T.goalLabel}
                onChange={handleSelectChange}
              >
                {Object.entries(T.goalOptions).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{T.goalHelper}</FormHelperText>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel id="activity-level-select-label">
                {T.activityLevelLabel}
              </InputLabel>
              <Select
                labelId="activity-level-select-label"
                name="activityLevel"
                value={formData.activityLevel || 'moderate'}
                label={T.activityLevelLabel}
                onChange={handleSelectChange}
              >
                {Object.entries(T.activityLevelOptions).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{T.activityLevelHelper}</FormHelperText>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel id="diet-type-select-label">
                {T.dietTypeLabel}
              </InputLabel>
              <Select
                labelId="diet-type-select-label"
                name="dietType"
                value={formData.dietType || 'normal'}
                label={T.dietTypeLabel}
                onChange={handleSelectChange}
              >
                {Object.entries(T.dietTypeOptions).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{T.dietTypeHelper}</FormHelperText>
            </FormControl>
          </>
        )
      case 3: // Health & Restrictions
        return (
          <>
            <Typography variant="h5" gutterBottom>
              {T.step3Title}
            </Typography>
            <MultipleCheckboxWithOther
              formControlLabel={T.healthConditionsLabel}
              name="healthConditions"
              options={healthConditionOptions.map((opt) => ({
                value: opt.value,
                label: getLocalizedOptionLabel(opt, currentLang),
              }))}
              currentSelectedValues={formData.healthConditions || []}
              onValuesChange={handleMultipleCheckboxChange}
            />
            <MultipleCheckboxWithOther
              formControlLabel={T.foodAllergiesLabel}
              name="foodAllergies"
              options={foodAllergyOptions.map((opt) => ({
                value: opt.value,
                label: getLocalizedOptionLabel(opt, currentLang),
              }))}
              currentSelectedValues={formData.foodAllergies || []}
              onValuesChange={handleMultipleCheckboxChange}
            />
          </>
        )
      case 4: // Additional Preferences
        return (
          <>
            <Typography variant="h5" gutterBottom>
              {T.step4Title}
            </Typography>
            <MultipleCheckboxWithOther
              formControlLabel={T.ethicalConsiderationsLabel}
              name="ethicalFoodConsiderations"
              options={ethicalConsiderationOptions.map((opt) => ({
                value: opt.value,
                label: getLocalizedOptionLabel(opt, currentLang),
              }))}
              currentSelectedValues={formData.ethicalFoodConsiderations || []}
              onValuesChange={handleMultipleCheckboxChange}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel id="pregnancy-status-select-label">
                {T.pregnancyStatusLabel}
              </InputLabel>
              <Select
                labelId="pregnancy-status-select-label"
                name="pregnancyLactationStatus"
                value={formData.pregnancyLactationStatus || 'not_applicable'}
                label={T.pregnancyStatusLabel}
                onChange={handleSelectChange}
              >
                {Object.entries(T.pregnancyOptions).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{T.pregnancyStatusHelper}</FormHelperText>
            </FormControl>
            <MultipleCheckboxWithOther
              formControlLabel={T.preferredCuisineLabel}
              name="preferredCuisine"
              options={cuisineOptions.map((opt) => ({
                value: opt.value,
                label: getLocalizedOptionLabel(opt, currentLang),
              }))}
              currentSelectedValues={formData.preferredCuisine || []}
              onValuesChange={handleMultipleCheckboxChange}
            />
            <MultipleCheckboxWithOther
              formControlLabel={T.preferredFlavorProfilesLabel}
              name="preferredFlavorProfiles"
              options={flavorProfileOptions.map((opt) => ({
                value: opt.value,
                label: getLocalizedOptionLabel(opt, currentLang),
              }))}
              currentSelectedValues={formData.preferredFlavorProfiles || []}
              onValuesChange={handleMultipleCheckboxChange}
            />
          </>
        )
      case 5: // Physical Info
        return (
          <>
            <Typography variant="h5" gutterBottom>
              {T.step5Title}
            </Typography>
            <TextField
              label={T.weightLabel}
              name="weightKg"
              type="number"
              value={formData.weightKg || ''}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              helperText={T.weightHelper}
              InputProps={{ inputProps: { step: 0.1 } }}
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
            />
            {calculatedBmi && (
              <Typography variant="body1" sx={{ mt: 1 }}>
                {T.bmiCalculatedLabel
                  .replace('{bmiValue}', calculatedBmi)
                  .replace(
                    '{status}',
                    getBmiStatus(calculatedBmi, currentLang),
                  )}
              </Typography>
            )}
          </>
        )
      case 6: // Summary & Save
        return (
          <>
            <Typography variant="h5" gutterBottom>
              {T.step6Title}
            </Typography>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6">{T.summaryTitle}</Typography>
                <ProfileListItem
                  label={T.nicknameLabel}
                  value={formData.displayName}
                />
                <ProfileListItem
                  label={T.ageLabel}
                  value={calculatedAge ?? undefined}
                />
                <ProfileListItem
                  label={T.genderLabel}
                  value={
                    formData.gender
                      ? getGenderDisplay(formData.gender)
                      : undefined
                  }
                />
                <ProfileListItem
                  label={T.weightLabel}
                  value={formData.weightKg}
                />
                <ProfileListItem
                  label={T.heightLabel}
                  value={formData.heightCm}
                />
                {userProfileFromApi &&
                  userProfileFromApi.weightKg &&
                  userProfileFromApi.heightCm &&
                  (() => {
                    const bmiVal = (
                      userProfileFromApi.weightKg! /
                      (userProfileFromApi.heightCm! / 100) ** 2
                    ).toFixed(2)
                    return (
                      <ProfileListItem
                        label={T.bmiLabel}
                        value={`${bmiVal} (${getBmiStatus(bmiVal, currentLang)})`}
                      />
                    )
                  })()}
                <ProfileListItem
                  label={T.goalLabel}
                  value={
                    formData.goal ? T.goalOptions[formData.goal] : undefined
                  }
                />
                <ProfileListItem
                  label={T.activityLevelLabel}
                  value={
                    formData.activityLevel
                      ? T.activityLevelOptions[formData.activityLevel]
                      : undefined
                  }
                />
                <ProfileListItem
                  label={T.dietTypeLabel}
                  value={
                    formData.dietType
                      ? T.dietTypeOptions[formData.dietType]
                      : undefined
                  }
                />
                <ProfileListItem
                  label={T.healthConditionsLabel}
                  value={formData.healthConditions}
                />
                <ProfileListItem
                  label={T.foodAllergiesLabel}
                  value={formData.foodAllergies}
                />
                <ProfileListItem
                  label={T.ethicalConsiderationsLabel}
                  value={formData.ethicalFoodConsiderations}
                />
                <ProfileListItem
                  label={T.pregnancyStatusLabel}
                  value={
                    formData.pregnancyLactationStatus
                      ? T.pregnancyOptions[formData.pregnancyLactationStatus]
                      : undefined
                  }
                />
                <ProfileListItem
                  label={T.preferredCuisineLabel}
                  value={formData.preferredCuisine}
                />
                <ProfileListItem
                  label={T.preferredFlavorProfilesLabel}
                  value={formData.preferredFlavorProfiles}
                />
                {calculatedCalories && (
                  <ProfileListItem
                    label={T.calculatedCaloriesLabel}
                    value={`${calculatedCalories} kcal`}
                  />
                )}
              </CardContent>
            </Card>
          </>
        )
      default:
        return null
    }
  }

  return (
    <LocalizationProvider
      dateAdapter={AdapterDateFns}
      adapterLocale={currentLang === 'th' ? th : enUS}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container maxWidth="sm" sx={{ mt: 2, mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            {T.userProfileTitle}
          </Typography>

          {lineLiffProfile && (
            <Box sx={{ mb: 2, textAlign: 'center' }}>
              {lineLiffProfile.pictureUrl && (
                <img
                  src={lineLiffProfile.pictureUrl}
                  alt="LINE Profile"
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    marginBottom: '10px',
                  }}
                />
              )}
              <Typography variant="h6">
                {T.welcomeMessage.replace(
                  '{name}',
                  lineLiffProfile.displayName,
                )}
              </Typography>
            </Box>
          )}

          <Box sx={{ p: 2, border: '1px dashed grey', mt: 2, borderRadius: 2 }}>
            {isEditMode ? (
              <Box
                component="form"
                sx={{ mt: 1, mb: 1 }}
                noValidate
                autoComplete="off"
              >
                <Typography variant="subtitle1" align="center" gutterBottom>
                  {T.stepOutOf
                    .replace('{current}', String(currentStep))
                    .replace('{total}', String(totalSteps))}
                </Typography>
                {renderStepContent()}
              </Box>
            ) : userProfileFromApi ? (
              <>
                <Typography align="center" gutterBottom variant="subtitle1">
                  {T.userProfileTitle}
                </Typography>
                <List
                  dense
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: '4px',
                    border: '1px solid #e0e0e0',
                  }}
                >
                  <ProfileListItem
                    label={T.languageLabel}
                    value={
                      userProfileFromApi.language === 'th'
                        ? 'ภาษาไทย'
                        : 'English'
                    }
                  />
                  <ProfileListItem
                    label={T.nicknameLabel}
                    value={userProfileFromApi.displayName}
                  />
                  <ProfileListItem
                    label={T.ageLabel}
                    value={userProfileFromApi.age}
                  />
                  <ProfileListItem
                    label={T.genderLabel}
                    value={
                      userProfileFromApi.gender
                        ? getGenderDisplay(userProfileFromApi.gender)
                        : undefined
                    }
                  />
                  <ProfileListItem
                    label={T.weightLabel}
                    value={userProfileFromApi.weightKg}
                  />
                  <ProfileListItem
                    label={T.heightLabel}
                    value={userProfileFromApi.heightCm}
                  />
                  {userProfileFromApi.weightKg &&
                    userProfileFromApi.heightCm &&
                    (() => {
                      const bmiVal = (
                        userProfileFromApi.weightKg! /
                        (userProfileFromApi.heightCm! / 100) ** 2
                      ).toFixed(2)
                      return (
                        <ProfileListItem
                          label={T.bmiLabel}
                          value={`${bmiVal} (${getBmiStatus(bmiVal, currentLang)})`}
                        />
                      )
                    })()}
                  <ProfileListItem
                    label={T.goalLabel}
                    value={
                      userProfileFromApi.goal
                        ? T.goalOptions[userProfileFromApi.goal]
                        : undefined
                    }
                  />
                  <ProfileListItem
                    label={T.activityLevelLabel}
                    value={
                      userProfileFromApi.activityLevel
                        ? T.activityLevelOptions[
                            userProfileFromApi.activityLevel
                          ]
                        : undefined
                    }
                  />
                  <ProfileListItem
                    label={T.dietTypeLabel}
                    value={
                      userProfileFromApi.dietType
                        ? T.dietTypeOptions[userProfileFromApi.dietType]
                        : undefined
                    }
                  />
                  <ProfileListItem
                    label={T.healthConditionsLabel}
                    value={userProfileFromApi.healthConditions}
                  />
                  <ProfileListItem
                    label={T.foodAllergiesLabel}
                    value={userProfileFromApi.foodAllergies}
                  />
                  <ProfileListItem
                    label={T.ethicalConsiderationsLabel}
                    value={userProfileFromApi.ethicalFoodConsiderations}
                  />
                  <ProfileListItem
                    label={T.pregnancyStatusLabel}
                    value={
                      userProfileFromApi.pregnancyLactationStatus
                        ? T.pregnancyOptions[
                            userProfileFromApi.pregnancyLactationStatus
                          ]
                        : undefined
                    }
                  />
                  <ProfileListItem
                    label={T.preferredCuisineLabel}
                    value={userProfileFromApi.preferredCuisine}
                  />
                  <ProfileListItem
                    label={T.preferredFlavorProfilesLabel}
                    value={userProfileFromApi.preferredFlavorProfiles}
                  />
                </List>
              </>
            ) : (
              <Typography align="center" color="textSecondary">
                {T.noApiProfileData}
              </Typography>
            )}
          </Box>

          <Stack
            direction="row"
            spacing={2}
            justifyContent="center"
            sx={{ mt: 3 }}
          >
            {isEditMode ? (
              <>
                {currentStep > 1 && (
                  <Button
                    variant="outlined"
                    onClick={handlePrevStep}
                    disabled={isLoadingApi}
                  >
                    {T.backButton}
                  </Button>
                )}
                {currentStep < totalSteps ? (
                  <Button
                    variant="contained"
                    onClick={handleNextStep}
                    disabled={isLoadingApi}
                  >
                    {T.nextButton}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSave}
                    disabled={isLoadingApi}
                  >
                    {isLoadingApi ? (
                      <CircularProgress size={24} />
                    ) : (
                      T.saveChangesButton
                    )}
                  </Button>
                )}
                <Button
                  variant="text"
                  onClick={handleEditToggle}
                  disabled={isLoadingApi}
                  sx={{ ml: currentStep === 1 ? 'auto' : undefined }}
                >
                  {T.cancelButton}
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                onClick={handleEditToggle}
                disabled={isLoadingApi}
              >
                {T.editProfileButton}
              </Button>
            )}
          </Stack>

          {liff.isInClient() && (
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <button
                onClick={() => liff.closeWindow()}
                style={{ padding: '10px 20px', fontSize: '16px' }}
              >
                Close LIFF App
              </button>
            </Box>
          )}
        </Container>
      </ThemeProvider>
    </LocalizationProvider>
  )
}

export default App
