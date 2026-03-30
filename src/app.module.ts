import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: 3306,
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: 'healthcare_db',
      autoLoadEntities: true, // Automatically finds your @Entity() files
      synchronize: true, // Set to false in production!
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
