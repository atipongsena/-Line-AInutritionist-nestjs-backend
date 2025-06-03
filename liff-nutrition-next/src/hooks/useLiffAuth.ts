import { useState, useEffect } from 'react'

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
  const [isReady, setIsReady] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<LiffProfile | null>(null)
  const [language, setLanguage] = useState<'th' | 'en'>('th')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeLiff = async () => {
      try {
        // Check if LIFF is available
        if (typeof window === 'undefined' || !(window as any).liff) {
          setError('LIFF SDK not available')
          return
        }

        const liff = (window as any).liff

        // Wait for LIFF to be ready
        await liff.ready

        setIsReady(true)
        setLanguage(liff.getLanguage() === 'th' ? 'th' : 'en')

        if (liff.isLoggedIn()) {
          setIsLoggedIn(true)

          try {
            const userProfile = await liff.getProfile()
            setProfile(userProfile)
            setUserId(userProfile.userId)

            const token = liff.getIDToken()
            setIdToken(token)
            console.log('ID Token:', token ? 'Available' : 'Not available')
          } catch (profileError) {
            console.error('Failed to get profile:', profileError)
            setError('Failed to get user profile')
          }
        }
      } catch (initError) {
        console.error('LIFF initialization failed:', initError)
        setError('LIFF initialization failed')
      }
    }

    initializeLiff()
  }, [])

  const logout = () => {
    const liff = (window as any).liff
    if (liff && liff.isLoggedIn()) {
      liff.logout()
      setIsLoggedIn(false)
      setUserId(null)
      setIdToken(null)
      setProfile(null)
    }
  }

  return {
    isReady,
    isLoggedIn,
    userId,
    idToken,
    profile,
    language,
    error,
    logout,
  }
}
