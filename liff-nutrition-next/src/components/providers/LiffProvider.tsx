'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import Script from 'next/script'
import type { Liff } from '@liff/liff-types'

// Define LiffContextType locally instead of importing
export interface LiffContextType {
  isReady: boolean
  isLoggedIn: boolean
  userId: string | null
  idToken: string | null
  profile: any | null
  error: string | null
  language: 'th' | 'en'
  logout: () => void
  reload: () => void
  liff: any | null
  isInLineApp: boolean
  isFallbackMode: boolean
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID

// Validate LIFF_ID
const isValidLiffId = (liffId: string | undefined): boolean => {
  if (!liffId || liffId === 'default-liff-id') {
    return false
  }
  // LIFF ID format: xxxxxxxxx-xxxxxxxx
  const liffIdPattern = /^\d{10}-\w{8}$/
  return liffIdPattern.test(liffId)
}

// Create LIFF Context
const LiffContext = createContext<LiffContextType>({
  isReady: false,
  isLoggedIn: false,
  userId: null,
  profile: null,
  idToken: null,
  language: 'th',
  error: null,
  logout: () => {},
  reload: () => {},
  liff: null,
  isInLineApp: false,
  isFallbackMode: false,
})

export const useLiff = (): LiffContextType => {
  const context = useContext(LiffContext)
  if (!context) {
    throw new Error('useLiff must be used within a LiffProvider')
  }
  return context
}

interface LiffProviderProps {
  children: ReactNode
}

export const LiffProvider: React.FC<LiffProviderProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [language, setLanguage] = useState<'th' | 'en'>('th')
  const [error, setError] = useState<string | null>(null)
  const [isInLineApp, setIsInLineApp] = useState(false)
  const [isFallbackMode, setIsFallbackMode] = useState(false)

  const checkLiffAvailability = useCallback(() => {
    if (typeof window === 'undefined') return

    const win = window as any
    if (win.liff && typeof win.liff.init === 'function') {
      setIsReady(true)
      console.log('[LIFF] SDK loaded and ready')
    } else {
      setTimeout(checkLiffAvailability, 100)
    }
  }, [])

  const initializeLiff = useCallback(async () => {
    if (typeof window === 'undefined') return

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID

    if (!liffId) {
      console.error('[LIFF] LIFF ID is not configured')
      setError('LIFF ID is not configured')

      // ✅ เข้าสู่ fallback mode
      setIsFallbackMode(true)
      setIsReady(true)
      setIsLoggedIn(false)
      setUserId('demo-user-' + Date.now())
      setProfile({
        userId: 'demo-user-' + Date.now(),
        displayName: 'Demo User',
        pictureUrl: null,
      })
      setIdToken('demo-token-' + Date.now())
      setLanguage('th')
      setIsInLineApp(false)
      return
    }

    try {
      console.log('[LIFF] Initializing with ID:', liffId)
      const liff = (window as any).liff

      if (!liff) {
        throw new Error('LIFF SDK is not loaded')
      }

      await liff.init({
        liffId,
        withLoginOnExternalBrowser: true,
      })

      console.log('[LIFF] LIFF initialized successfully')
      setIsReady(true)
      setIsInLineApp(liff.isInClient())

      if (liff.isLoggedIn()) {
        setIsLoggedIn(true)

        // Get user profile
        const userProfile = await liff.getProfile()
        setProfile(userProfile)
        setUserId(userProfile.userId)

        // Get ID token
        const token = liff.getIDToken()
        setIdToken(token)

        // Get language
        const lang = liff.getLanguage()
        setLanguage(lang === 'en' ? 'en' : 'th')

        console.log('[LIFF] User logged in:', {
          userId: userProfile.userId,
          displayName: userProfile.displayName,
          language: lang,
        })
      } else {
        console.log('[LIFF] User not logged in')
        setIsLoggedIn(false)

        // ✅ เข้าสู่ fallback mode สำหรับการทดสอบ
        setIsFallbackMode(true)
        setUserId('demo-user-' + Date.now())
        setProfile({
          userId: 'demo-user-' + Date.now(),
          displayName: 'Demo User (Not Logged In)',
          pictureUrl: null,
        })
        setIdToken('demo-token-' + Date.now())
      }
    } catch (error: any) {
      console.error('[LIFF] LIFF initialization failed:', error)
      setError(error.message)

      // ✅ เข้าสู่ fallback mode เมื่อ LIFF ล้มเหลว
      setIsFallbackMode(true)
      setIsReady(true)
      setIsLoggedIn(false)
      setUserId('demo-user-' + Date.now())
      setProfile({
        userId: 'demo-user-' + Date.now(),
        displayName: 'Demo User (LIFF Failed)',
        pictureUrl: null,
      })
      setIdToken('demo-token-' + Date.now())
      setLanguage('th')
      setIsInLineApp(false)
    }
  }, [])

  const logout = useCallback(() => {
    if (typeof window === 'undefined') return

    const liff = (window as any).liff
    if (liff && typeof liff.logout === 'function') {
      liff.logout()
      setIsLoggedIn(false)
      setUserId(null)
      setIdToken(null)
      setProfile(null)
      console.log('[LIFF] User logged out')
    }
  }, [])

  const reload = useCallback(() => {
    window.location.reload()
  }, [])

  // Check for LIFF availability after script loads
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkScript = () => {
        const win = window as any
        if (win.liff) {
          checkLiffAvailability()
        } else {
          setTimeout(checkScript, 100)
        }
      }
      checkScript()
    }
  }, [checkLiffAvailability])

  useEffect(() => {
    if (isReady) {
      initializeLiff()
    }
  }, [isReady, initializeLiff])

  const contextValue: LiffContextType = {
    isReady,
    isLoggedIn,
    userId,
    idToken,
    profile,
    error,
    language,
    logout,
    reload,
    liff: typeof window === 'undefined' ? null : (window as any).liff,
    isInLineApp,
    isFallbackMode,
  }

  return (
    <>
      <Script
        src="https://static.line-scdn.net/liff/edge/2.1/sdk.js"
        strategy="afterInteractive"
      />
      <LiffContext.Provider value={contextValue}>
        {children}
      </LiffContext.Provider>
    </>
  )
}
