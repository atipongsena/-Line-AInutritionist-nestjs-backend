import type { Liff } from '@liff/liff-types' // Import official Liff type

// LIFF Type Definitions
export interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

export interface LiffContext {
  type: 'utou' | 'room' | 'group' | 'square_chat'
  viewType: 'compact' | 'tall' | 'full'
  userId?: string
  utouId?: string
  roomId?: string
  groupId?: string
  endpointUrl: string
  // Add other properties from official LiffContext if needed, or use official LiffContext type directly
}

export interface LiffData {
  language: string
  context: LiffContext
}

export interface LiffMessage {
  type: string
  text?: string
  [key: string]: unknown
}

// LiffObject is now an alias or extension of the official Liff type
// If LiffObject was meant to be a subset or a specific version, this needs careful review
// For now, let's align it closely with the official Liff type or use Liff directly where possible
export type LiffObject = Liff // Simplest approach: alias official Liff type
// Or, if you have custom methods/properties, extend it:
// export interface LiffObject extends Liff {
//   customMethod?: () => void;
// }

// Alternative interface for compatibility - review if this is still needed
// If LiffObject now aligns with Liff, LiffType might be redundant or can also align with Liff
export type LiffType = Liff // Use type alias instead of empty interface

export interface WindowWithLiff extends Window {
  liff?: Liff // Use the official Liff type (optional)
}

// Global declaration for window.liff
declare global {
  interface Window {
    liff?: Liff
  }
}

export function isLiffAvailable(liffInstance: unknown): liffInstance is Liff {
  if (typeof liffInstance !== 'object' || liffInstance === null) {
    // console.warn('[LIFF] Type guard: liffObject is not an object')
    return false
  }

  const potentialLiff = liffInstance as Record<string, unknown>
  // Check for a few key methods from the official Liff type
  const requiredMethods = [
    'init',
    'isLoggedIn',
    'login',
    'getIDToken',
    'getProfile',
    'closeWindow',
    'getOS', // Example of a method from official Liff type
  ]

  for (const method of requiredMethods) {
    if (typeof potentialLiff[method] !== 'function') {
      // console.warn(`[LIFF] Type guard: Missing or invalid method: ${method}`)
      return false
    }
  }
  return true
}

// Helper function to safely get LIFF instance
export function getLiffInstance(): Liff | null {
  const win = window as Window // Use Window instead of WindowWithLiff
  const liffInstance = win.liff

  if (!liffInstance || !isLiffAvailable(liffInstance)) {
    return null
  }
  return liffInstance
}

// Helper function to check if LIFF is ready and user is logged in
export function isLiffReady(): boolean {
  const liffInstance = getLiffInstance()
  // Ensure getIDToken is called as it might imply readiness/login state more accurately
  return (
    liffInstance !== null &&
    liffInstance.isLoggedIn() &&
    liffInstance.getIDToken() !== null
  )
}

// LIFF Context Hook Type
export interface LiffContextType {
  isReady: boolean
  isLoggedIn: boolean
  userId: string | null
  idToken: string | null
  profile: LiffProfile | null // LiffProfile remains custom, ensure it matches getProfile() response
  error: string | null
  language: string // Official getAppLanguage() returns string, or use custom 'th' | 'en' based on app logic
  logout: () => void
  reload: () => void
  liff: Liff | null // Expose the liff instance itself if needed by components
}

export {}
