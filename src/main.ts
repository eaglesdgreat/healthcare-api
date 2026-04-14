import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const config = new DocumentBuilder()
    .setTitle('Healthcare Users Authentication & Authorization Service')
    .setDescription(
      'This is the authentication and authorization service where we get to know the user coming to the platform and what they are allow to access.',
    )
    .setVersion('1.0')
    .addTag('users')
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
