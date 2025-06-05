import { Injectable, Logger } from '@nestjs/common'
// Remove direct import of FoodAnalysisData if aiming for a generic cache
// import { FoodAnalysisData } from '../line/flex.messages'

interface CacheEntry<T = unknown> {
  // Use Generic T, default to unknown for broad compatibility
  data: T
  expiryTime: number
}

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

@Injectable()
export class AnalysisCacheService {
  private readonly cache = new Map<string, CacheEntry<unknown>>() // Store CacheEntry with 'unknown' type for data
  private readonly logger = new Logger(AnalysisCacheService.name)

  set<T = unknown>( // Method is generic
    key: string,
    value: T, // Value is of generic type T
    ttlMs: number = DEFAULT_TTL_MS,
  ): void {
    if (!key) {
      this.logger.warn('Attempted to set cache with an empty key.')
      return
    }
    const expiryTime = Date.now() + ttlMs
    this.cache.set(key, { data: value, expiryTime })
    this.logger.log(`Cached data for key: ${key}, TTL: ${ttlMs / 1000}s`)
    this.cleanupExpiredEntries() // Optional: cleanup on set
  }

  get<T = unknown>(key: string): T | undefined {
    // Method is generic, returns T or undefined
    if (!key) {
      this.logger.warn('Attempted to get cache with an empty key.')
      return undefined
    }
    const entry = this.cache.get(key) as CacheEntry<T> | undefined // Cast entry to specific generic type if found
    if (!entry) {
      this.logger.log(`Cache miss for key: ${key}`)
      return undefined
    }

    if (Date.now() > entry.expiryTime) {
      this.logger.log(`Cache expired for key: ${key}`)
      this.cache.delete(key)
      return undefined
    }

    this.logger.log(`Cache hit for key: ${key}`)
    return entry.data // Data is of type T
  }

  delete(key: string): void {
    if (!key) {
      this.logger.warn('Attempted to delete cache with an empty key.')
      return
    }
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.logger.log(`Deleted cache for key: ${key}`)
    }
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now()
    let cleanedCount = 0
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiryTime) {
        this.cache.delete(key)
        cleanedCount++
      }
    }
    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired cache entries.`)
    }
  }

  // Optional: run cleanup periodically if needed, e.g., with NestJS Schedule
  // constructor() {
  //   setInterval(() => this.cleanupExpiredEntries(), DEFAULT_TTL_MS); // Example: cleanup every 5 mins
  // }
}
