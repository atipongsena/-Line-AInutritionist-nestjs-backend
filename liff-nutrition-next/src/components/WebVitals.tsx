'use client'

import { useEffect } from 'react'
import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  const reportWebVitals = useReportWebVitals((metric) => {
    // ลดการ log ใน development mode
    if (process.env.NODE_ENV === 'production') {
      console.log('[WebVitals]', metric)
      // Send to analytics service in production
      // gtag('event', metric.name, {
      //   value: Math.round(metric.value),
      //   event_label: metric.id,
      //   non_interaction: true,
      // })
    } else {
      // ใน development แสดงแค่ metrics ที่มีปัญหา
      if (metric.name === 'LCP' && metric.value > 2500) {
        console.warn('[WebVitals] Poor LCP:', `${metric.value}ms`, metric)
      } else if (metric.name === 'FID' && metric.value > 100) {
        console.warn('[WebVitals] Poor FID:', `${metric.value}ms`, metric)
      } else if (metric.name === 'CLS' && metric.value > 0.25) {
        console.warn('[WebVitals] Poor CLS:', metric.value, metric)
      }
      // ไม่ log metrics ที่ปกติ
    }
  })

  // Monitor additional performance metrics
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'production'
    ) {
      // เฉพาะ production เท่านั้น
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'resource') {
            // Log slow resources (แค่ที่ช้ามาก)
            if (entry.duration > 3000) {
              console.warn(
                '[Performance] Slow resource:',
                entry.name,
                `${entry.duration}ms`,
              )
            }
          }

          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming
            const loadTime = navEntry.loadEventEnd - navEntry.loadEventStart
            // แสดงแค่เมื่อมีปัญหา
            if (loadTime > 3000) {
              console.log('[Performance] Slow navigation timing:', {
                domContentLoaded:
                  navEntry.domContentLoadedEventEnd -
                  navEntry.domContentLoadedEventStart,
                loadComplete: loadTime,
                ttfb: navEntry.responseStart - navEntry.requestStart,
              })
            }
          }
        })
      })

      try {
        observer.observe({ entryTypes: ['resource', 'navigation'] })
      } catch (e) {
        // Performance observer not supported
      }

      return () => {
        observer.disconnect()
      }
    }
  }, [])

  // Component is for monitoring only, renders nothing
  return null
}
