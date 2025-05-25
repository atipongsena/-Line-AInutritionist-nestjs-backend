import React from 'react'
import { Box, Typography, LinearProgress } from '@mui/material'

// Helper component for LinearProgress with value label
export interface LinearProgressWithLabelProps {
  value: number
  consumed: number
  goal: number
  unit: string
  isMaxGoal?: boolean // If true, goal is a maximum limit
  color?: string
  // mealId?: string; // Removed as it was not used directly here
}

export const LinearProgressWithLabel: React.FC<LinearProgressWithLabelProps> = (
  props,
) => {
  const { value, consumed, goal, unit, isMaxGoal, color } = props
  const displayValue = Math.min(value, 100) // Cap progress at 100%

  const safeConsumed = consumed ?? 0
  const safeGoal = goal ?? 0

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Box sx={{ width: '100%', mr: 1 }}>
        <LinearProgress
          variant="determinate"
          value={displayValue}
          color={
            value > 100 && !isMaxGoal
              ? 'warning'
              : value > 100 && isMaxGoal
                ? 'error'
                : 'primary'
          }
          sx={{
            '& .MuiLinearProgress-bar': {
              backgroundColor: color,
              transition: 'transform 1.2s ease-in-out',
            },
            height: 8,
            borderRadius: 4,
          }}
        />
      </Box>
      <Box sx={{ minWidth: 120, textAlign: 'right' }}>
        <Typography variant="body2" color="text.secondary">
          {`${safeConsumed}${unit} / ${isMaxGoal ? 'ไม่เกิน ' : ''}${safeGoal}${unit}`}
        </Typography>
      </Box>
    </Box>
  )
}

// export default LinearProgressWithLabel; // Exporting directly as named export
