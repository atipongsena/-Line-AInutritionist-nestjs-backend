import { useState, useEffect } from 'react'
import { WindowWithLiff, isLiffAvailable } from '../types/liff'

export interface UseLiffAuthReturn {
  userId: string | null
  idToken: string | null
  isReady: boolean
  error: string | null
}

export const useLiffAuth = (): UseLiffAuthReturn => {
  const [userId, setUserId] = useState<string | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initLiffAuth = async () => {
      try {
        const win = window as WindowWithLiff
        const localLiff = win.liff

        if (!localLiff || !isLiffAvailable(localLiff)) {
          setError('ไม่สามารถเข้าถึง LIFF SDK ได้')
          setIsReady(true)
          return
        }

        if (localLiff.isLoggedIn()) {
          const profile = await localLiff.getProfile()
          setUserId(profile.userId)
          setIdToken(localLiff.getIDToken())
          setError(null)
        } else {
          setError('กรุณาเข้าสู่ระบบก่อนใช้งาน')
        }
      } catch (err) {
        console.error('Error in LIFF authentication:', err)
        setError(
          err instanceof Error
            ? err.message
            : 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้',
        )
      } finally {
        setIsReady(true)
      }
    }

    void initLiffAuth()
  }, [])

  return { userId, idToken, isReady, error }
}
