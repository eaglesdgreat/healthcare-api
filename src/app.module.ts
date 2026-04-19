import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { UsersModule } from '@/users/user.module'
import { AuthModule } from '@/auth/auth.module'
import { ConfigService } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core/constants'
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes the configuration available globally
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => {
        const configService = new ConfigService()
        return {
          type: 'mysql',
          host: configService.get('MYSQL_HOST'),
          port: configService.get('MYSQL_PORT'),
          username: configService.get('MYSQL_USER'),
          password: configService.get('MYSQL_PASSWORD'),
          database: configService.get('MYSQL_DATABASE'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: false, // Set to false in production!
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          migrationsRun: true,
          cli: {
            migrationsDir: '/migrations',
          },
        }
      },
    }),
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    AppService,
  ],
})
export class AppModule {}
