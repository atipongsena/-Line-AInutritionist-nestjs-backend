interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  backoffFactor?: number
  retryCondition?: (error: any) => boolean
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

interface ErrorWithResponse {
  response?: {
    status: number
    statusText?: string
  }
  message?: string
}

const defaultRetryCondition = (error: ErrorWithResponse): boolean => {
  // Retry on network errors, timeouts, and 5xx server errors
  if (!error.response) {
    // Network error, timeout, etc.
    return true
  }

  const status = error.response.status
  // Retry on server errors (5xx) but not on client errors (4xx)
  return status >= 500 && status < 600
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export async function apiWithRetry<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  options: RetryOptions = {},
): Promise<ApiResponse<T>> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    retryCondition = defaultRetryCondition,
  } = options

  let lastError: ErrorWithResponse | null = null

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`[API Retry] Attempt ${attempt}/${maxRetries + 1}`)

      const result = await apiCall()

      if (result.success) {
        if (attempt > 1) {
          console.log(`[API Retry] ✅ Success on attempt ${attempt}`)
        }
        return result
      }

      // If the API call returns unsuccessful but doesn't throw, create an error for retry logic
      const apiError: ErrorWithResponse = {
        message: result.error || 'API returned unsuccessful response',
      }

      if (attempt <= maxRetries && retryCondition(apiError)) {
        const delay = calculateDelayWithJitter(attempt - 1, baseDelay, maxDelay)
        console.log(`[API Retry] ⏳ Waiting ${delay}ms before retry...`)
        await sleep(delay)
        continue
      }

      return result // Return the unsuccessful result if no more retries
    } catch (error) {
      lastError = error as ErrorWithResponse
      console.error(
        `[API Retry] ❌ Attempt ${attempt} failed:`,
        lastError.message,
      )

      if (attempt <= maxRetries && retryCondition(lastError)) {
        const delay = calculateDelayWithJitter(attempt - 1, baseDelay, maxDelay)
        console.log(`[API Retry] ⏳ Waiting ${delay}ms before retry...`)
        await sleep(delay)
        continue
      }

      break // Exit loop if no more retries or retry condition not met
    }
  }

  // If we get here, all retries failed
  console.error(`[API Retry] 🚫 All ${maxRetries + 1} attempts failed`)

  return {
    success: false,
    error:
      lastError?.message || 'Network error occurred after multiple retries',
  }
}

// Helper function for common API patterns
export function createRetryableApi<T>(
  baseApiCall: () => Promise<ApiResponse<T>>,
  customOptions?: RetryOptions,
) {
  return () => apiWithRetry(baseApiCall, customOptions)
}

// Exponential backoff with jitter to prevent thundering herd
export function calculateDelayWithJitter(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 10000,
  jitterFactor: number = 0.1,
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  const cappedDelay = Math.min(exponentialDelay, maxDelay)
  const jitter = cappedDelay * jitterFactor * Math.random()
  return Math.round(cappedDelay + jitter)
}
