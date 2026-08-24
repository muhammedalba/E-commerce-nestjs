import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PromoBanner,
  PromoBannerSchema,
} from './shared/schema/promo-banner.schema';
import { PromoBannerService } from './promo-banner.service';
import { PromoBannerController } from './promo-banner.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PromoBanner.name, schema: PromoBannerSchema },
    ]),
  ],
  controllers: [PromoBannerController],
  providers: [PromoBannerService],
})
export class PromoBannerModule {}
