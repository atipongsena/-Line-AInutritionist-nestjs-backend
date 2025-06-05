import { Injectable, Logger } from '@nestjs/common'
import { format } from 'date-fns'

interface TimezoneConversionCache {
  result: Date
  timestamp: number
}

interface DayBoundsCacheEntry {
  startOfDay: number
  endOfDay: number
  timestamp: number
}

@Injectable()
export class TimezoneService {
  private readonly logger = new Logger(TimezoneService.name)

  // Cache สำหรับ timezone conversions
  private conversionCache = new Map<string, TimezoneConversionCache>()
  private dayBoundsCache = new Map<string, DayBoundsCacheEntry>()
  private readonly CONVERSION_CACHE_TTL = 60 * 1000 // 1 minute

  // Performance metrics
  private cacheHits = 0
  private cacheMisses = 0

  /**
   * แปลงเวลาจาก client timezone เป็น UTC สำหรับเก็บใน database
   */
  convertToUtc(localTime: Date | string, timezone: string): Date {
    const startTime = performance.now()
    const date = typeof localTime === 'string' ? new Date(localTime) : localTime

    // Create cache key
    const cacheKey = `${date.getTime()}_${timezone}_toUtc`
    const cached = this.conversionCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.CONVERSION_CACHE_TTL) {
      this.cacheHits++
      const duration = performance.now() - startTime
      this.logger.debug(
        `convertToUtc cache HIT (${duration.toFixed(2)}ms) for ${timezone}`,
      )
      return new Date(cached.result.getTime())
    }

    this.cacheMisses++
    try {
      // ใช้ Intl.DateTimeFormat เพื่อแปลง timezone
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })

      const parts = formatter.formatToParts(date)
      const localString = `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}-${parts.find((p) => p.type === 'day')?.value}T${parts.find((p) => p.type === 'hour')?.value}:${parts.find((p) => p.type === 'minute')?.value}:${parts.find((p) => p.type === 'second')?.value}`

      // คำนวณ offset แล้วแปลงเป็น UTC
      const localDate = new Date(localString)
      const offset = date.getTime() - localDate.getTime()
      const result = new Date(date.getTime() - offset)

      // Cache the result
      this.conversionCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      })

      const duration = performance.now() - startTime
      this.logger.debug(
        `convertToUtc cache MISS (${duration.toFixed(2)}ms) for ${timezone}`,
      )
      return result
    } catch (e) {
      const duration = performance.now() - startTime
      const errorMessage = e instanceof Error ? e.message : String(e)
      this.logger.warn(
        `convertToUtc ERROR (${duration.toFixed(2)}ms) for ${timezone}: ${errorMessage}`,
      )
      // Fallback: return original date if conversion fails
      return date
    }
  }

  /**
   * แปลงเวลาจาก UTC เป็น timezone ของ user สำหรับแสดงผล
   */
  convertFromUtc(utcTime: Date | string, timezone: string): Date {
    const startTime = performance.now()
    const date = typeof utcTime === 'string' ? new Date(utcTime) : utcTime

    // Create cache key
    const cacheKey = `${date.getTime()}_${timezone}_fromUtc`
    const cached = this.conversionCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.CONVERSION_CACHE_TTL) {
      this.cacheHits++
      const duration = performance.now() - startTime
      this.logger.debug(
        `convertFromUtc cache HIT (${duration.toFixed(2)}ms) for ${timezone}`,
      )
      return new Date(cached.result.getTime())
    }

    this.cacheMisses++
    try {
      // สร้าง Date object ใน timezone ที่ต้องการ
      const result = new Date(
        date.toLocaleString('en-US', { timeZone: timezone }),
      )

      // Cache the result
      this.conversionCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      })

      const duration = performance.now() - startTime
      this.logger.debug(
        `convertFromUtc cache MISS (${duration.toFixed(2)}ms) for ${timezone}`,
      )
      return result
    } catch (e) {
      const duration = performance.now() - startTime
      const errorMessage = e instanceof Error ? e.message : String(e)
      this.logger.warn(
        `convertFromUtc ERROR (${duration.toFixed(2)}ms) for ${timezone}: ${errorMessage}`,
      )
      // Fallback: return original date if conversion fails
      return date
    }
  }

  /**
   * ได้เวลาปัจจุบันตาม timezone ของ user
   */
  getNowInTimezone(timezone: string): Date {
    return this.convertFromUtc(new Date(), timezone)
  }

  /**
   * Format เวลาตาม timezone ของ user
   */
  formatInTimezone(
    time: Date | string,
    timezone: string,
    formatStr: string = 'yyyy-MM-dd HH:mm:ss',
  ): string {
    const date = typeof time === 'string' ? new Date(time) : time
    const zonedTime = this.convertFromUtc(date, timezone)
    return format(zonedTime, formatStr)
  }

  /**
   * ตรวจสอบ timezone ที่ใช้ได้ (with caching)
   */
  private validTimezoneCache = new Map<string, boolean>()

  isValidTimezone(timezone: string): boolean {
    // Check cache first
    if (this.validTimezoneCache.has(timezone)) {
      return this.validTimezoneCache.get(timezone)!
    }

    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone })
      this.validTimezoneCache.set(timezone, true)
      return true
    } catch {
      this.validTimezoneCache.set(timezone, false)
      return false
    }
  }

  /**
   * ได้ start และ end ของวันตาม timezone ของ user (optimized)
   */
  getDayBounds(
    date: Date | string,
    timezone: string,
  ): { startOfDay: Date; endOfDay: Date } {
    const startTime = performance.now()
    const targetDate = typeof date === 'string' ? new Date(date) : date

    // Create cache key for day bounds
    const dateKey = targetDate.toDateString()
    const cacheKey = `dayBounds_${dateKey}_${timezone}`
    const cached = this.dayBoundsCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.CONVERSION_CACHE_TTL) {
      const duration = performance.now() - startTime
      this.logger.debug(
        `getDayBounds cache HIT (${duration.toFixed(2)}ms) for ${timezone}`,
      )
      return {
        startOfDay: new Date(cached.startOfDay),
        endOfDay: new Date(cached.endOfDay),
      }
    }

    // แปลงเวลาไปยัง timezone ของ user
    const localDate = this.convertFromUtc(targetDate, timezone)

    // สร้างเวลาเริ่มต้นของวัน (00:00:00) ใน local time
    const startOfDayLocal = new Date(localDate)
    startOfDayLocal.setHours(0, 0, 0, 0)

    // สร้างเวลาสิ้นสุดของวัน (23:59:59.999) ใน local time
    const endOfDayLocal = new Date(localDate)
    endOfDayLocal.setHours(23, 59, 59, 999)

    // แปลงกลับเป็น UTC สำหรับ query database
    const startOfDay = this.convertToUtc(startOfDayLocal, timezone)
    const endOfDay = this.convertToUtc(endOfDayLocal, timezone)

    // Cache the result (store as special object)
    this.dayBoundsCache.set(cacheKey, {
      startOfDay: startOfDay.getTime(),
      endOfDay: endOfDay.getTime(),
      timestamp: Date.now(),
    })

    const duration = performance.now() - startTime
    this.logger.debug(
      `getDayBounds cache MISS (${duration.toFixed(2)}ms) for ${timezone}`,
    )
    return { startOfDay, endOfDay }
  }

  /**
   * รายการ timezone ที่รองรับ
   */
  getSupportedTimezones(): string[] {
    return [
      'Asia/Bangkok', // Thailand
      'Asia/Jakarta', // Indonesia
      'Asia/Singapore', // Singapore
      'Asia/Manila', // Philippines
      'Asia/Ho_Chi_Minh', // Vietnam
      'Asia/Kuala_Lumpur', // Malaysia
      'Asia/Tokyo', // Japan
      'Asia/Seoul', // South Korea
      'UTC',
      'America/New_York',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
    ]
  }

  /**
   * Clear conversion cache
   */
  clearCache(): void {
    this.conversionCache.clear()
    this.dayBoundsCache.clear()
    this.validTimezoneCache.clear()
    this.logger.log('All timezone related caches cleared.')
    this.cacheHits = 0
    this.cacheMisses = 0
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    conversions: number
    dayBounds: number
    validTimezones: number
    cacheHits: number
    cacheMisses: number
    hitRate: string
  } {
    const totalRequests = this.cacheHits + this.cacheMisses
    const hitRate =
      totalRequests > 0
        ? ((this.cacheHits / totalRequests) * 100).toFixed(2)
        : '0.00'

    return {
      conversions: this.conversionCache.size,
      dayBounds: this.dayBoundsCache.size,
      validTimezones: this.validTimezoneCache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: `${hitRate}%`,
    }
  }

  /**
   * Log performance statistics
   */
  logPerformanceStats(): void {
    const stats = this.getCacheStats()
    this.logger.log(
      `Timezone Performance Stats - Cache Hit Rate: ${stats.hitRate}, Hits: ${stats.cacheHits}, Misses: ${stats.cacheMisses}, Cache Size: ${stats.conversions}`,
    )
  }
}
