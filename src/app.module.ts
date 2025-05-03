import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { MongooseConfig } from './config/db/mongoose.config';
import { I18nConfig } from './config/i18n/i18n.config';
import { StaticConfig } from './config/static.config';
import { JwtConfig } from './config/jwt/jwt.config';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),

    I18nConfig,
    MongooseConfig,
    StaticConfig,
    JwtConfig,
    AuthModule,
    UsersModule,
    BrandsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
