'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || 'default-liff-id'

// Create LIFF Context
const LiffContext = createContext<LiffContextType | null>(null)

export const useLiff = () => {
  const context = useContext(LiffContext)
  if (!context) {
    throw new Error('useLiff must be used within a LiffProvider')
  }
  return context
}

interface LiffProviderProps {
  children: React.ReactNode
}

export const LiffProvider: React.FC<LiffProviderProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<any | null>(null) // Use any for now
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<'th' | 'en'>('th')
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [liffInstance, setLiffInstance] = useState<Liff | null>(null)

  const checkLiffAvailability = useCallback(() => {
    if (typeof window === 'undefined') return

    const win = window as any
    if (win.liff && typeof win.liff.init === 'function') {
      setLiffInstance(win.liff)
      setIsReady(true)
      console.log('[LIFF] SDK loaded and ready')
    } else {
      setTimeout(checkLiffAvailability, 100)
    }
  }, [])

  const initializeLiff = useCallback(async () => {
    if (!liffInstance || !LIFF_ID) return

    try {
      await liffInstance.init({ liffId: LIFF_ID })
      setIsLoggedIn(liffInstance.isLoggedIn())

      if (liffInstance.isLoggedIn()) {
        const token = liffInstance.getIDToken()
        setIdToken(token)

        try {
          const profile = await liffInstance.getProfile()
          setProfile(profile)
          setUserId(profile.userId)
        } catch (profileError) {
          console.warn('Could not get profile:', profileError)
        }

        setLanguage(liffInstance.getLanguage() === 'th' ? 'th' : 'en')
      }
    } catch (error) {
      console.error('LIFF initialization failed:', error)
      setError('Failed to initialize LIFF')
    }
  }, [liffInstance])

  const logout = useCallback(() => {
    if (liffInstance && typeof liffInstance.logout === 'function') {
      liffInstance.logout()
      setIsLoggedIn(false)
      setUserId(null)
      setIdToken(null)
      setProfile(null)
      console.log('[LIFF] User logged out')
    }
  }, [liffInstance])

  const reload = useCallback(() => {
    window.location.reload()
  }, [])

  // Check for LIFF availability after script loads
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkScript = () => {
        const win = window as any
        if (win.liff) {
          setIsScriptLoaded(true)
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
    liff: liffInstance,
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
