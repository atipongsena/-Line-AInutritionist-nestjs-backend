import { useState, useEffect } from 'react'

export interface UseUrlParametersReturn {
  logId: string | null
  date: string | null
  mealType: string | null
  userId: string | null
  tab: string | null
  [key: string]: string | null
}

export const useUrlParameters = (): UseUrlParametersReturn => {
  const [parameters, setParameters] = useState<UseUrlParametersReturn>({
    logId: null,
    date: null,
    mealType: null,
    userId: null,
    tab: null,
  })

  useEffect(() => {
    const extractParameters = () => {
      if (typeof window === 'undefined') return

      const searchParams = new URLSearchParams(window.location.search)
      const pathname = window.location.pathname

      // Extract logId from URL path (e.g., /liff-food-log/[logId])
      const pathParts = pathname.split('/')
      const logIdFromPath = pathParts[pathParts.length - 1]

      // Extract common LIFF parameters
      const newParams: UseUrlParametersReturn = {
        logId:
          logIdFromPath !== 'liff-food-log'
            ? logIdFromPath
            : searchParams.get('logId'),
        date: searchParams.get('date'),
        mealType: searchParams.get('mealType'),
        userId: searchParams.get('userId'),
        tab: searchParams.get('tab'),
      }

      // Add any additional query parameters
      searchParams.forEach((value, key) => {
        if (!Object.prototype.hasOwnProperty.call(newParams, key)) {
          newParams[key] = value
        }
      })

      setParameters(newParams)

      console.log('[useUrlParameters] Extracted parameters:', newParams)
    }

    extractParameters()

    // Listen for URL changes (if using client-side routing)
    const handlePopState = () => {
      extractParameters()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  return parameters
}
