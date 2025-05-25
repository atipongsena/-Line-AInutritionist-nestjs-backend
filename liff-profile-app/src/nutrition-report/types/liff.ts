export interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

export interface LiffType {
  init(config: { liffId: string }): Promise<void>
  isLoggedIn(): boolean
  login(): void
  getIDToken(): string | null
  getProfile(): Promise<LiffProfile>
  getLanguage(): string
  closeWindow(): void
}

export interface WindowWithLiff extends Window {
  liff?: LiffType
}

// Enhanced type guard with better error handling
export function isLiffAvailable(liffObject: unknown): liffObject is LiffType {
  if (typeof liffObject !== 'object' || liffObject === null) {
    console.warn('[LIFF] Type guard: liffObject is not an object')
    return false
  }

  const potentialLiff = liffObject as Record<string, unknown>
  const requiredMethods = [
    'init',
    'isLoggedIn',
    'login',
    'getIDToken',
    'getProfile',
    'getLanguage',
    'closeWindow',
  ]

  for (const method of requiredMethods) {
    if (typeof potentialLiff[method] !== 'function') {
      console.warn(`[LIFF] Type guard: Missing or invalid method: ${method}`)
      return false
    }
  }

  return true
}

// Helper function to safely get LIFF instance
export function getLiffInstance(): LiffType | null {
  const win = window as WindowWithLiff
  const liff = win.liff

  if (!liff || !isLiffAvailable(liff)) {
    return null
  }

  return liff
}

// Helper function to check if LIFF is ready and user is logged in
export function isLiffReady(): boolean {
  const liff = getLiffInstance()
  return liff !== null && liff.isLoggedIn()
}
