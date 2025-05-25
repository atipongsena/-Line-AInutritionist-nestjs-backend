import { useEffect } from 'react'
import { sanitizeDate, isValidDateString } from '../utils/dateValidation'

interface UseUrlParametersProps {
  onDateChange: (date: string) => void
  onLogIdFound: (logId: string) => void
  selectedDate: string
}

export const useUrlParameters = ({
  onDateChange,
  onLogIdFound,
  selectedDate,
}: UseUrlParametersProps) => {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const queryLogId = params.get('logId')
      const queryDate = params.get('date')

      console.log('[URL QueryParams] logId:', queryLogId, 'date:', queryDate)

      // Handle date parameter
      if (queryDate && queryDate !== selectedDate) {
        if (isValidDateString(queryDate)) {
          const sanitizedDate = sanitizeDate(queryDate)
          onDateChange(sanitizedDate)
        } else {
          console.warn('[URL QueryParams] Invalid date format:', queryDate)
        }
      }

      // Handle logId parameter
      if (queryLogId) {
        console.log('[URL QueryParams] Found logId:', queryLogId)
        onLogIdFound(queryLogId)
      }
    } catch (err) {
      console.error('Error processing URL parameters:', err)
    }
  }, [onDateChange, onLogIdFound, selectedDate])
}
