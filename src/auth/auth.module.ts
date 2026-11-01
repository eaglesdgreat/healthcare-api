import { Module } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { UsersModule } from '@/users/user.module'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule } from '@nestjs/config'
import { ConfigService } from '@nestjs/config'
import { AuthGuard } from './auth.guards'
import { APP_GUARD } from '@nestjs/core/constants'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '@/users/entities/user.entity'
import { EventBusModule } from '@/common/event-bus.module'
import { RefreshToken } from './entities/refresh-token.entity'
import { GoogleAuthService } from './google-auth.service'
import { MetricsModule } from '@/common/metrics/metrics.module'
import { NotificationClientService } from './notification-client.service'

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    AuthService,
    GoogleAuthService,
    NotificationClientService,
  ],
  imports: [
    ConfigModule,
    EventBusModule,
    MetricsModule,
    TypeOrmModule.forFeature([User, RefreshToken]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.getOrThrow<string>('JWT_SECRET')
        if (Buffer.byteLength(secret, 'utf8') < 32) {
          throw new Error('JWT_SECRET must be at least 32 bytes')
        }
        return {
          secret,
          signOptions: { expiresIn: '24h' },
        }
      },
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
