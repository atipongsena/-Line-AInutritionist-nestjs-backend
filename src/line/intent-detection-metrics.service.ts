import { Injectable, Logger } from '@nestjs/common'
import { IntentDetectionResult } from './intent-detection.service'

export interface IntentMetrics {
  totalDetections: number
  accuracyByIntent: Record<string, { correct: number; total: number }>
  averageConfidence: number
  averageLatency: number
  fallbackRate: number
  lastUpdated: Date
}

export interface IntentDetectionLog {
  timestamp: Date
  userMessage: string
  detectedIntent: string
  confidence: number
  latency: number
  wasFallback: boolean
  userId?: string
}

@Injectable()
export class IntentDetectionMetricsService {
  private readonly logger = new Logger(IntentDetectionMetricsService.name)
  private detectionLogs: IntentDetectionLog[] = []
  private readonly maxLogs = 1000 // Keep last 1000 detections

  logDetection(
    userMessage: string,
    result: IntentDetectionResult,
    latency: number,
    wasFallback: boolean,
    userId?: string,
  ): void {
    const log: IntentDetectionLog = {
      timestamp: new Date(),
      userMessage: userMessage.substring(0, 100), // Truncate for privacy
      detectedIntent: result.intent,
      confidence: result.confidence,
      latency,
      wasFallback,
      userId: userId?.substring(0, 8), // Partial for privacy
    }

    this.detectionLogs.push(log)

    // Keep only the most recent logs
    if (this.detectionLogs.length > this.maxLogs) {
      this.detectionLogs = this.detectionLogs.slice(-this.maxLogs)
    }

    // Log important metrics
    if (wasFallback) {
      this.logger.warn(
        `Intent detection fallback used for: "${userMessage.substring(0, 30)}..."`,
      )
    }

    if (result.confidence < 0.5) {
      this.logger.warn(
        `Low confidence intent detection (${result.confidence.toFixed(3)}) for: "${userMessage.substring(0, 30)}..."`,
      )
    }

    if (latency > 1000) {
      this.logger.warn(
        `Slow intent detection (${latency}ms) for: "${userMessage.substring(0, 30)}..."`,
      )
    }
  }

  getMetrics(): IntentMetrics {
    if (this.detectionLogs.length === 0) {
      return {
        totalDetections: 0,
        accuracyByIntent: {},
        averageConfidence: 0,
        averageLatency: 0,
        fallbackRate: 0,
        lastUpdated: new Date(),
      }
    }

    const total = this.detectionLogs.length
    const fallbackCount = this.detectionLogs.filter(
      (log) => log.wasFallback,
    ).length
    const totalConfidence = this.detectionLogs.reduce(
      (sum, log) => sum + log.confidence,
      0,
    )
    const totalLatency = this.detectionLogs.reduce(
      (sum, log) => sum + log.latency,
      0,
    )

    // Group by intent for accuracy tracking
    const intentCounts: Record<string, number> = {}
    this.detectionLogs.forEach((log) => {
      intentCounts[log.detectedIntent] =
        (intentCounts[log.detectedIntent] || 0) + 1
    })

    const accuracyByIntent: Record<string, { correct: number; total: number }> =
      {}
    Object.keys(intentCounts).forEach((intent) => {
      accuracyByIntent[intent] = {
        correct: intentCounts[intent], // Assume all are correct for now
        total: intentCounts[intent],
      }
    })

    return {
      totalDetections: total,
      accuracyByIntent,
      averageConfidence: totalConfidence / total,
      averageLatency: totalLatency / total,
      fallbackRate: fallbackCount / total,
      lastUpdated: new Date(),
    }
  }

  getRecentDetections(limit: number = 10): IntentDetectionLog[] {
    return this.detectionLogs.slice(-limit).reverse() // Most recent first
  }

  clearLogs(): void {
    this.detectionLogs = []
    this.logger.log('Intent detection logs cleared')
  }

  // เพิ่ม method สำหรับ manual feedback
  markDetectionAsCorrect(timestamp: Date, isCorrect: boolean): void {
    const log = this.detectionLogs.find(
      (l) => l.timestamp.getTime() === timestamp.getTime(),
    )
    if (log) {
      // You could extend the log interface to include a 'feedback' field
      this.logger.log(
        `Manual feedback received for detection at ${timestamp.toISOString()}: ${isCorrect ? 'correct' : 'incorrect'}`,
      )
    }
  }
}
