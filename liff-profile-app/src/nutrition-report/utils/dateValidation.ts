export const isValidDateString = (dateString: string): boolean => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/
  if (!datePattern.test(dateString)) {
    return false
  }

  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

export const isDateInFuture = (dateString: string): boolean => {
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(23, 59, 59, 999) // Set to end of today
  return date > today
}

export const getCurrentDateString = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const sanitizeDate = (dateString: string): string => {
  if (!isValidDateString(dateString) || isDateInFuture(dateString)) {
    console.warn(
      `[DateValidation] Invalid or future date: ${dateString}, using today`,
    )
    return getCurrentDateString()
  }
  return dateString
}
