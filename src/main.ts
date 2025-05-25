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
  const isProduction = configService.get<string>('NODE_ENV') === 'production'

  app.enableCors({
    origin: [
      // Development origins
      'http://localhost:3000', // Frontend dev server
      'http://localhost:3001', // LIFF dev server
      // ❌ ลบ development HTTPS (Azure จัดการ HTTPS อัตโนมัติ)
      // 'https://localhost:3000',
      // 'https://localhost:3001',

      // Production origins (Azure Static Web Apps)
      ...(frontendUrl ? [frontendUrl] : []),
      ...(isProduction
        ? [
            // Azure Static Web Apps HTTPS URLs (อัปเดตตาม deployment จริง)
            'https://ai-nutritionist-frontend.*.z23.web.core.windows.net',
          ]
        : []),
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-LINE-ID-TOKEN',
      'Origin',
      'X-Requested-With',
    ],
    credentials: true,
    // เปิดใช้ preflight caching สำหรับ performance
    maxAge: 86400, // 24 hours
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
