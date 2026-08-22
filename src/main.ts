import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ValidationPipe } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Global Validation Config
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  )

  // Swagger documentation configuration
  const config = new DocumentBuilder()
    .setTitle('Healthcare Users Authentication & Authorization Service')
    .setDescription(
      'Authentication and authorization service for the Healthcare platform. It handles user signup, activation, login, token rotation, Google sign-in, and user management.',
    )
    .setVersion('3.2.0')
    .addTag('app', 'Service-level endpoints such as the health check.')
    .addTag(
      'users',
      'User management endpoints: list, retrieve, restore, soft delete, bulk operations, and permanent delete. Requires a bearer token.',
    )
    .addTag(
      'auths',
      'Authentication endpoints: signup, login, token refresh, logout, Google sign-in, and account activation. Publicly accessible.',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Enter the JWT access token obtained from /login or /refresh.',
      },
      'access-token',
    )
    .build()
  const documentFactory = () => SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, documentFactory)

  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
  .then(() => {
    console.log('Application is running on port', process.env.PORT ?? 3000)
  })
  .catch((error) => {
    console.error('Error starting application:', error)
  })
