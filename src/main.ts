import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'
import { ValidationPipe, Logger } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true })
  const configService = app.get(ConfigService)
  const logger = new Logger('Bootstrap')

  // Enable CORS with specific options for production
  const frontendUrl = configService.get<string>('FRONTEND_URL')
  // const isProduction = configService.get<string>('NODE_ENV') === 'production' // isProduction ไม่ได้ถูกใช้ใน logic ใหม่โดยตรง แต่ยังเก็บไว้เผื่อกรณีอื่น

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowedOrigins = [
        // Development origins
        'http://localhost:3000', // Frontend dev server
        'http://localhost:3001', // LIFF dev server
        // Production/Staging Frontend URL from environment variable
        ...(frontendUrl ? [frontendUrl.replace(/\/$/, '')] : []), // Ensure no trailing slash for comparison
        // Current Azure Static Web Apps (เผื่อยังมีการใช้งาน หรือต้องการ fallback)
        // ควรตรวจสอบ URL เหล่านี้ให้ถูกต้องกับ deployment ปัจจุบันของคุณ
        'https://salmon-pond-09f432200.6.azurestaticapps.net',
        // 'https://ai-nutritionist-frontend.*.z23.web.core.windows.net', // Regex-like string needs careful handling or separate regex
      ]

      // Regex for Vercel preview and production *.vercel.app domains
      const vercelRegex = /\.vercel\.app$/
      // Regex for ngrok-free.app domains
      const ngrokRegex = /.*\.ngrok-free\.app$/
      // Regex for one of the Azure SWA patterns if needed as a regex
      const azureSwaRegex =
        /ai-nutritionist-frontend\.[^.]*\.z23\.web\.core\.windows\.net$/

      if (!origin) {
        // Allow requests with no origin (like mobile apps or curl requests if desired, or server-to-server)
        callback(null, true)
        return
      }

      // Now, origin is definitely a string
      if (
        allowedOrigins.includes(origin) ||
        vercelRegex.test(origin) ||
        ngrokRegex.test(origin) ||
        azureSwaRegex.test(origin)
      ) {
        callback(null, true)
      } else {
        logger.warn(`CORS: Denied origin - ${origin}`)
        callback(new Error('Not allowed by CORS'))
      }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-LINE-ID-TOKEN',
      'X-Line-User-ID',
      'Origin',
      'X-Requested-With',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
      'ngrok-skip-browser-warning',
    ],
    credentials: true,
    // เปิดใช้ preflight caching สำหรับ performance
    maxAge: 86400, // 24 hours
    // Explicit preflight handling
    preflightContinue: false,
    optionsSuccessStatus: 200,
  })

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove properties that are not in the DTO
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Allow conversion of path/query params to expected types
      },
    }),
  )

  const port = configService.get<number>('PORT') || 3001
  await app.listen(port)
  logger.log(`Application is running on: ${await app.getUrl()}`)
}

bootstrap().catch((err) => {
  const logger = new Logger('BootstrapError')
  logger.error('Error during application bootstrap:', err)
  process.exit(1)
})
