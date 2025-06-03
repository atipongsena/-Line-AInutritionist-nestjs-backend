'use client'

import React from 'react'
import { LinearProgress, Typography, Box } from '@mui/material'

export interface LinearProgressWithLabelProps {
  _value: number
  consumed: number
  goal: number
  unit: string
  isMaxGoal?: boolean // If true, goal is a maximum limit
  _color?: string
}

export const LinearProgressWithLabel: React.FC<
  LinearProgressWithLabelProps
> = ({
  _value,
  consumed,
  goal,
  unit,
  isMaxGoal = false,
  _color = 'primary',
}) => {
  const percentage = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0
  const isOverGoal = consumed > goal

  // Color logic for different scenarios
  const getProgressColor = () => {
    if (isMaxGoal) {
      // For maximum limits (like sodium, sugar), red if over
      if (isOverGoal) return 'error'
      if (percentage > 80) return 'warning'
      return 'success'
    } else {
      // For targets (like protein, calories), green when reached
      if (percentage >= 100) return 'success'
      if (percentage > 70) return 'primary'
      return 'warning'
    }
  }

  const progressColor = getProgressColor() as
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning'

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Box sx={{ width: '100%', mr: 1 }}>
          <LinearProgress
            variant="determinate"
            value={percentage}
            color={progressColor}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
            }}
          />
        </Box>
        <Box sx={{ minWidth: 35 }}>
          <Typography variant="body2" color="text.secondary">
            {Math.round(percentage)}%
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {consumed.toFixed(1)} {unit}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {isMaxGoal ? 'สูงสุด' : 'เป้าหมาย'}: {goal.toFixed(1)} {unit}
        </Typography>
      </Box>
      {isOverGoal && (
        <Typography
          variant="caption"
          color="error"
          sx={{ display: 'block', mt: 0.5 }}
        >
          {isMaxGoal ? 'เกินขีดจำกัด' : 'เกินเป้าหมาย'} +
          {(consumed - goal).toFixed(1)} {unit}
        </Typography>
      )}
    </Box>
  )
}
