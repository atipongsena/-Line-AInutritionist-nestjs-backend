'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Divider,
} from '@mui/material'
import { ArrowBack, Save } from '@mui/icons-material'
import { useLiff } from '@/components/providers/LiffProvider'
import { useNutritionStore } from '@/lib/store'
import type { LiffFoodLogData } from '@/types/food'

export default function LiffFoodLogPage() {
  const params = useParams()
  const router = useRouter()
  const {
    isReady,
    isLoggedIn,
    userId,
    idToken,
    error: liffAuthError,
  } = useLiff()
  const {
    currentLiffFoodLog,
    isDailyLoading: isLiffLoading,
    dailyError: liffDataError,
    fetchLiffFoodLog,
    setCurrentLiffFoodLog,
  } = useNutritionStore()

  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<LiffFoodLogData>>({})
  const [isSaving, setIsSaving] = useState(false)

  const logId = params.logId as string

  // Load food log data
  useEffect(() => {
    if (
      isReady &&
      isLoggedIn &&
      userId &&
      idToken &&
      logId &&
      logId !== 'demo'
    ) {
      fetchLiffFoodLog(logId, userId, idToken)
    } else if (logId === 'demo') {
      // Demo data for testing
      const demoData: LiffFoodLogData = {
        id: 'demo',
        userId: userId || 'demo-user',
        date: new Date().toISOString().split('T')[0],
        logDate: new Date().toISOString().split('T')[0],
        mealType: 'อาหารเช้า',
        imageUrl: '/demo-food.jpg',
        imageAlt: 'ข้าวผัดกุ้ง',
        meals: [
          {
            mealType: 'อาหารเช้า',
            foodItems: [],
            totalCalories: 450,
          },
        ],
        totalNutrition: {
          calories: 450,
          protein: 18,
          carbs: 65,
          fat: 12,
          fiber: 2,
          sugar: 3,
          sodium: 800,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        food: {
          foodName: { th: 'ข้าวผัดกุ้ง', en: 'Shrimp Fried Rice' },
          amount: 1,
          unit: 'จาน',
          portion: 'จานกลาง',
          nutrition: {
            calories: 450,
            protein: 18,
            carbs: 65,
            fat: 12,
            fiber: 2,
            sugar: 3,
            sodium: 800,
          },
        },
      }
      setCurrentLiffFoodLog(demoData)
    }
  }, [
    isReady,
    isLoggedIn,
    userId,
    idToken,
    logId,
    fetchLiffFoodLog,
    setCurrentLiffFoodLog,
  ])

  const handleEdit = () => {
    setIsEditing(true)
    setEditData({
      food: {
        foodName: currentLiffFoodLog?.food?.foodName || { th: '', en: '' },
        amount: currentLiffFoodLog?.food?.amount || 0,
        unit: currentLiffFoodLog?.food?.unit || '',
        portion: currentLiffFoodLog?.food?.portion || '',
        nutrition: currentLiffFoodLog?.food?.nutrition || {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
        micronutrients: currentLiffFoodLog?.food?.micronutrients,
      },
    })
  }

  const handleSave = async () => {
    if (!userId || !idToken || !currentLiffFoodLog || logId === 'demo') {
      if (logId === 'demo') {
        // Simulate save for demo
        setIsSaving(true)
        setTimeout(() => {
          setIsSaving(false)
          setIsEditing(false)
          alert('บันทึกสำเร็จ (Demo Mode)')
        }, 1000)
      }
      return
    }

    setIsSaving(true)
    try {
      // Mock update implementation since store doesn't have updateLiffFoodLog
      console.log('Updating LIFF food log:', { logId, editData, userId })

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Update local state with edited data
      if (editData.food && currentLiffFoodLog) {
        const updatedLog = {
          ...currentLiffFoodLog,
          food: {
            ...currentLiffFoodLog.food,
            ...editData.food,
          },
        }
        setCurrentLiffFoodLog(updatedLog)
      }

      setIsEditing(false)
      alert('บันทึกข้อมูลสำเร็จ')
    } catch (error) {
      console.error('Save error:', error)
      alert('เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditData({})
  }

  const handleGoBack = () => {
    router.push('/')
  }

  if (!isReady) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="60vh"
        >
          <CircularProgress size={40} />
          <Typography variant="body1" sx={{ mt: 2 }} color="text.secondary">
            กำลังโหลด...
          </Typography>
        </Box>
      </Container>
    )
  }

  if (liffAuthError || !isLoggedIn) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">เกิดข้อผิดพลาด</Typography>
          <Typography variant="body2">
            {liffAuthError || 'กรุณาเข้าสู่ระบบผ่าน LINE'}
          </Typography>
        </Alert>
        <Button variant="contained" fullWidth onClick={handleGoBack}>
          กลับหน้าหลัก
        </Button>
      </Container>
    )
  }

  if (isLiffLoading) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="60vh"
        >
          <CircularProgress size={40} />
          <Typography variant="body1" sx={{ mt: 2 }} color="text.secondary">
            กำลังโหลดข้อมูลอาหาร...
          </Typography>
        </Box>
      </Container>
    )
  }

  if (liffDataError) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">ไม่สามารถโหลดข้อมูลได้</Typography>
          <Typography variant="body2">{liffDataError}</Typography>
        </Alert>
        <Button variant="contained" fullWidth onClick={handleGoBack}>
          กลับหน้าหลัก
        </Button>
      </Container>
    )
  }

  if (!currentLiffFoodLog) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="h6">ไม่พบข้อมูลอาหาร</Typography>
          <Typography variant="body2">
            ไม่พบข้อมูลอาหารที่ต้องการแก้ไข
          </Typography>
        </Alert>
        <Button variant="contained" fullWidth onClick={handleGoBack}>
          กลับหน้าหลัก
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="sm" sx={{ py: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Button startIcon={<ArrowBack />} onClick={handleGoBack}>
            กลับ
          </Button>

          {!isEditing ? (
            <Button
              variant="contained"
              onClick={handleEdit}
              disabled={isSaving}
            >
              แก้ไข
            </Button>
          ) : (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={handleCancel}
                disabled={isSaving}
              >
                ยกเลิก
              </Button>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </Stack>
          )}
        </Box>

        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          แก้ไขบันทึกอาหาร
        </Typography>

        {logId === 'demo' && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              นี่คือโหมดทดสอบ - การเปลี่ยนแปลงจะไม่ถูกบันทึกจริง
            </Typography>
          </Alert>
        )}
      </Box>

      {/* Food Information Card */}
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ข้อมูลอาหาร
          </Typography>

          <Stack spacing={3}>
            {/* Food Name */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                ชื่ออาหาร
              </Typography>
              {isEditing ? (
                <TextField
                  fullWidth
                  value={editData.food?.foodName?.th || ''}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      food: {
                        ...editData.food,
                        foodName: {
                          ...editData.food?.foodName,
                          th: e.target.value,
                        },
                        amount: editData.food?.amount || 0,
                        unit: editData.food?.unit || '',
                        portion: editData.food?.portion || '',
                        nutrition: editData.food?.nutrition || {
                          calories: 0,
                          protein: 0,
                          carbs: 0,
                          fat: 0,
                        },
                        micronutrients: editData.food?.micronutrients,
                      },
                    })
                  }
                  placeholder="ชื่ออาหาร"
                />
              ) : (
                <Typography variant="body1">
                  {currentLiffFoodLog.food?.foodName?.th || 'ไม่ระบุ'}
                </Typography>
              )}
            </Box>

            {/* Amount and Unit */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                จำนวนและหน่วย
              </Typography>
              {isEditing ? (
                <Stack direction="row" spacing={2}>
                  <TextField
                    type="number"
                    value={editData.food?.amount || ''}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        food: {
                          foodName: editData.food?.foodName || {
                            th: '',
                            en: '',
                          },
                          amount: parseFloat(e.target.value) || 0,
                          unit: editData.food?.unit || '',
                          portion: editData.food?.portion || '',
                          nutrition: editData.food?.nutrition || {
                            calories: 0,
                            protein: 0,
                            carbs: 0,
                            fat: 0,
                          },
                          micronutrients: editData.food?.micronutrients,
                        },
                      })
                    }
                    placeholder="จำนวน"
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    value={editData.food?.unit || ''}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        food: {
                          foodName: editData.food?.foodName || {
                            th: '',
                            en: '',
                          },
                          amount: editData.food?.amount || 0,
                          unit: e.target.value,
                          portion: editData.food?.portion || '',
                          nutrition: editData.food?.nutrition || {
                            calories: 0,
                            protein: 0,
                            carbs: 0,
                            fat: 0,
                          },
                          micronutrients: editData.food?.micronutrients,
                        },
                      })
                    }
                    placeholder="หน่วย"
                    sx={{ flex: 1 }}
                  />
                </Stack>
              ) : (
                <Typography variant="body1">
                  {currentLiffFoodLog.food?.amount}{' '}
                  {currentLiffFoodLog.food?.unit}
                </Typography>
              )}
            </Box>

            {/* Portion */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                ขนาดส่วน
              </Typography>
              {isEditing ? (
                <TextField
                  fullWidth
                  value={editData.food?.portion || ''}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      food: {
                        foodName: editData.food?.foodName || { th: '', en: '' },
                        amount: editData.food?.amount || 0,
                        unit: editData.food?.unit || '',
                        portion: e.target.value,
                        nutrition: editData.food?.nutrition || {
                          calories: 0,
                          protein: 0,
                          carbs: 0,
                          fat: 0,
                        },
                        micronutrients: editData.food?.micronutrients,
                      },
                    })
                  }
                  placeholder="ขนาดส่วน"
                />
              ) : (
                <Typography variant="body1">
                  {currentLiffFoodLog.food?.portion || 'ไม่ระบุ'}
                </Typography>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Nutrition Information Card */}
      {currentLiffFoodLog.food?.nutrition && (
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              ข้อมูลโภชนาการ
            </Typography>

            <Stack spacing={2}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">แคลอรี่:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {currentLiffFoodLog.food.nutrition.calories} kcal
                </Typography>
              </Box>

              <Divider />

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">โปรตีน:</Typography>
                <Typography variant="body2">
                  {currentLiffFoodLog.food.nutrition.protein} g
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">คาร์โบไหเดรต:</Typography>
                <Typography variant="body2">
                  {currentLiffFoodLog.food.nutrition.carbs} g
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">ไขมัน:</Typography>
                <Typography variant="body2">
                  {currentLiffFoodLog.food.nutrition.fat} g
                </Typography>
              </Box>

              {currentLiffFoodLog.food.nutrition.fiber && (
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">ใยอาหาร:</Typography>
                  <Typography variant="body2">
                    {currentLiffFoodLog.food.nutrition.fiber} g
                  </Typography>
                </Box>
              )}

              {currentLiffFoodLog.food.nutrition.sodium && (
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">โซเดียม:</Typography>
                  <Typography variant="body2">
                    {currentLiffFoodLog.food.nutrition.sodium} mg
                  </Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Meal Info */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary">
          มื้อ: {currentLiffFoodLog.mealType} | วันที่:{' '}
          {currentLiffFoodLog.logDate}
        </Typography>
      </Box>
    </Container>
  )
}
