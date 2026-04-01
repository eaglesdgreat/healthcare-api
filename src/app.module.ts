import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes the configuration available globally
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT as string) || 3306,
      username: process.env.MYSQL_USER || 'root',
      password:
        process.env.MYSQL_PASSWORD ||
        process.env.MYSQL_ROOT_PASSWORD ||
        'password',
      database: process.env.MYSQL_DATABASE || 'healthcare_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false, // Set to false in production!
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
