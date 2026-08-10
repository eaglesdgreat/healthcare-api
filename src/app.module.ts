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
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('MYSQL_HOST'),
        port: Number(configService.get('MYSQL_PORT')) || 3306,
        username: configService.get('MYSQL_USER'),
        password: configService.get('MYSQL_PASSWORD'),
        database: configService.get('MYSQL_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // Set to false in production!
        // Schema migrations are handled by db-migrate (see shell/run-db-migration.sh
        // and shell/start-dev.sh), which runs before the app boots. TypeORM's own
        // migration runner is intentionally NOT used here because our migration
        // files are written in db-migrate's format (exports.setup/up/down), not
        // TypeORM's MigrationInterface format. Enabling migrationsRun here causes
        // TypeORM to try to instantiate those files as its own migration classes,
        // which fails with "Cannot read properties of undefined (reading 'dbmigrate')".
      }),
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
