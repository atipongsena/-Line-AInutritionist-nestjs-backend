import { useLiff, LiffContextType } from '../components/providers/LiffProvider'

interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

interface UseLiffAuthReturn {
  isReady: boolean
  isLoggedIn: boolean
  userId: string | null
  idToken: string | null
  profile: LiffProfile | null
  language: 'th' | 'en'
  error: string | null
  logout: () => void
}

export function useLiffAuth(): UseLiffAuthReturn {
  const {
    isReady,
    isLoggedIn,
    userId,
    idToken,
    profile,
    language,
    error,
    logout,
  } = useLiff()

  const typedProfile: LiffProfile | null = profile as LiffProfile | null

  return {
    isReady,
    isLoggedIn,
    userId,
    idToken,
    profile: typedProfile,
    language,
    error,
    logout,
  }
}
