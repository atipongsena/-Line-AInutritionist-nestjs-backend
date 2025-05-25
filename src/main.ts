import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'
import { ValidationPipe, Logger } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true })
  const configService = app.get(ConfigService)
  const logger = new Logger('Bootstrap')

  // Enable CORS with specific options
  app.enableCors({
    origin: [
      'http://localhost:3001', // HTTP version
      'https://localhost:3001', // HTTPS version
      // Add other origins if needed (e.g., your production LIFF URL)
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      'Content-Type, Accept, Authorization, X-LINE-ID-TOKEN, ngrok-skip-browser-warning',
    credentials: true,
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
