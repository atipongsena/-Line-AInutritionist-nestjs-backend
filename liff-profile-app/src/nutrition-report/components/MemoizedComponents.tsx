import React, { memo } from 'react'
import { Box, Typography, Paper, CircularProgress } from '@mui/material'
import { LinearProgressWithLabel } from './LinearProgressWithLabel'

// Memoized Loading Component
export const MemoizedLoadingSpinner = memo<{
  message?: string
  size?: number
}>(({ message = 'กำลังโหลด...', size = 40 }) => (
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
    <CircularProgress size={size} thickness={4} />
    <Typography sx={{ mt: 2 }}>{message}</Typography>
  </Box>
))

MemoizedLoadingSpinner.displayName = 'MemoizedLoadingSpinner'

// Memoized Nutrient Progress Component
export const MemoizedNutrientProgress = memo<{
  label: string
  consumed: number
  goal: number
  unit: string
  isMaxGoal?: boolean
  color?: string
}>(({ label, consumed, goal, unit, isMaxGoal, color }) => (
  <Box sx={{ mb: 1.5 }}>
    <Typography variant="subtitle2" gutterBottom>
      {label}
    </Typography>
    <LinearProgressWithLabel
      value={goal > 0 ? (consumed / goal) * 100 : 0}
      consumed={consumed}
      goal={goal}
      unit={unit}
      isMaxGoal={isMaxGoal}
      color={color}
    />
  </Box>
))

MemoizedNutrientProgress.displayName = 'MemoizedNutrientProgress'

// Memoized Summary Card Component
export const MemoizedSummaryCard = memo<{
  title: string
  summary: string
  insights?: string[]
  tip?: string
  borderColor?: string
}>(({ title, summary, insights, tip, borderColor = '#4caf50' }) => (
  <Paper
    elevation={2}
    sx={{ p: 2, mb: 2, borderLeft: `4px solid ${borderColor}` }}
  >
    <Typography variant="h6" gutterBottom>
      {title}
    </Typography>
    <Typography variant="body1" sx={{ mb: 2 }}>
      {summary}
    </Typography>
    {insights && insights.length > 0 && (
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
          💡 ข้อสังเกต:
        </Typography>
        <ul>
          {insights.map((insight: string, index: number) => (
            <li key={index}>
              <Typography variant="body2">{insight}</Typography>
            </li>
          ))}
        </ul>
      </Box>
    )}
    {tip && (
      <Box>
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 'bold', mt: 2, mb: 0.5 }}
        >
          💡 คำแนะนำ:
        </Typography>
        <Typography variant="body2">{tip}</Typography>
      </Box>
    )}
  </Paper>
))

MemoizedSummaryCard.displayName = 'MemoizedSummaryCard'

// Memoized Calorie Display Component
export const MemoizedCalorieDisplay = memo<{
  consumed: number
  goal: number
  label?: string
}>(({ consumed, goal, label = 'แคลอรี่' }) => (
  <Box sx={{ textAlign: 'center' }}>
    <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
      {consumed}
    </Typography>
    <Typography variant="body2" color="textSecondary">
      / {goal} kcal
    </Typography>
    <Typography variant="caption" color="textSecondary">
      {label}
    </Typography>
  </Box>
))

MemoizedCalorieDisplay.displayName = 'MemoizedCalorieDisplay'

// Memoized Food Item Row Component
export const MemoizedFoodItemRow = memo<{
  itemName: string
  servingInfo: string
  calories: number
  macros: string
  onEdit?: () => void
  onDelete?: () => void
}>(({ itemName, servingInfo, calories, macros, onEdit, onDelete }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      py: 1,
      borderBottom: '1px solid #eee',
    }}
  >
    <Box>
      <Typography variant="body1" sx={{ fontWeight: '500' }}>
        {itemName}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {servingInfo} - {calories} kcal
      </Typography>
      <Typography variant="caption" color="textSecondary">
        {macros}
      </Typography>
    </Box>
    {(onEdit || onDelete) && (
      <Box sx={{ flexShrink: 0, display: 'flex', gap: 0.5 }}>
        {onEdit && (
          <button
            onClick={onEdit}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
            }}
            aria-label="แก้ไข"
          >
            ✏️
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
            }}
            aria-label="ลบ"
          >
            🗑️
          </button>
        )}
      </Box>
    )}
  </Box>
))

MemoizedFoodItemRow.displayName = 'MemoizedFoodItemRow'

// Memoized Error Display Component
export const MemoizedErrorDisplay = memo<{
  error: string
  onRetry?: () => void
  title?: string
}>(({ error, onRetry, title = 'เกิดข้อผิดพลาด' }) => (
  <Paper elevation={2} sx={{ p: 3, textAlign: 'center', bgcolor: '#ffebee' }}>
    <Typography variant="h6" color="error" gutterBottom>
      {title}
    </Typography>
    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
      {error}
    </Typography>
    {onRetry && (
      <button
        onClick={onRetry}
        style={{
          padding: '8px 16px',
          backgroundColor: '#1976d2',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        ลองใหม่
      </button>
    )}
  </Paper>
))

MemoizedErrorDisplay.displayName = 'MemoizedErrorDisplay'

// Memoized No Data Display Component
export const MemoizedNoDataDisplay = memo<{
  message: string
  subtitle?: string
  icon?: string
}>(({ message, subtitle, icon = '📊' }) => (
  <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
    <Typography variant="h4" sx={{ mb: 1 }}>
      {icon}
    </Typography>
    <Typography variant="subtitle1" gutterBottom>
      {message}
    </Typography>
    {subtitle && (
      <Typography variant="body2" color="textSecondary">
        {subtitle}
      </Typography>
    )}
  </Paper>
))

MemoizedNoDataDisplay.displayName = 'MemoizedNoDataDisplay'
