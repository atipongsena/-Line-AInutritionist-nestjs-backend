'use client'

import React, { memo, useMemo } from 'react'
import { CircularProgress, Box } from '@mui/material'
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

// Chart wrapper components with loading states
export const ChartWrapper: React.FC<{
  children: React.ReactNode
  height?: number
  loading?: boolean
}> = memo(({ children, height = 300, loading = false }) => {
  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height={height}
      >
        <CircularProgress size={40} />
      </Box>
    )
  }

  return (
    <Box height={height} width="100%">
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </Box>
  )
})

ChartWrapper.displayName = 'ChartWrapper'

// Pre-configured chart components
export const NutritionPieChart: React.FC<{
  data: Array<{ name: string; value: number; color: string }>
  centerLabel?: string
  loading?: boolean
}> = memo(({ data, centerLabel, loading = false }) => {
  const chartData = useMemo(() => data, [data])

  return (
    <ChartWrapper loading={loading}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
          {centerLabel && (
            <Label
              value={centerLabel}
              position="center"
              className="recharts-pie-label-text"
              style={{
                fontSize: '14px',
                fontWeight: 'bold',
                fill: '#333',
              }}
            />
          )}
        </Pie>
        <Tooltip
          formatter={(value: any) => [
            `${Number(value).toFixed(1)}Kcal`,
            'Amount',
          ]}
        />
        <Legend />
      </PieChart>
    </ChartWrapper>
  )
})

NutritionPieChart.displayName = 'NutritionPieChart'

export const NutritionBarChart: React.FC<{
  data: Array<{ name: string; current: number; target: number }>
  loading?: boolean
}> = memo(({ data, loading = false }) => {
  const chartData = useMemo(() => data, [data])

  return (
    <ChartWrapper loading={loading} height={250}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12 }}
          interval={0}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: any, name: any) => [
            `${Number(value).toFixed(1)}g`,
            name === 'current' ? 'Current' : 'Target',
          ]}
        />
        <Legend />
        <Bar dataKey="current" fill="#8884d8" name="Current" />
        <Bar dataKey="target" fill="#82ca9d" name="Target" />
      </BarChart>
    </ChartWrapper>
  )
})

NutritionBarChart.displayName = 'NutritionBarChart'

// Chart component for meal calories with simple structure
export const MealCaloriesChart: React.FC<{
  data: Array<{ name: string; calories: number }>
  loading?: boolean
}> = memo(({ data, loading = false }) => {
  const chartData = useMemo(() => data, [data])

  return (
    <ChartWrapper loading={loading} height={250}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12 }}
          interval={0}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: any) => [
            `${Number(value).toFixed(0)} kcal`,
            'Calories',
          ]}
        />
        <Legend />
        <Bar
          dataKey="calories"
          fill="#8884d8"
          name="Calories"
          animationBegin={300}
          animationDuration={1200}
        />
      </BarChart>
    </ChartWrapper>
  )
})

MealCaloriesChart.displayName = 'MealCaloriesChart'

// Chart colors and themes
export const CHART_COLORS = {
  primary: '#8884d8',
  secondary: '#82ca9d',
  tertiary: '#ffc658',
  quaternary: '#ff7300',
  error: '#f44336',
  warning: '#ff9800',
  success: '#4caf50',
  macronutrients: {
    carbs: '#4caf50',
    protein: '#2196f3',
    fat: '#ff9800',
    fiber: '#9c27b0',
  },
  calories: {
    consumed: '#4caf50',
    remaining: '#e0e0e0',
    excess: '#f44336',
  },
} as const

export type ChartColors = typeof CHART_COLORS
