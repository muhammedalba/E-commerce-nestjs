import { Module } from '@nestjs/common';
import { CarouselService } from './carousel.service';
import { CarouselController } from './carousel.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Carousel, CarouselSchema } from './shared/schemas/carousel.schema';

import { AuthModule } from 'src/auth/auth.module';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Carousel.name, schema: CarouselSchema },
    ]),
    AuthModule,
  ],
  controllers: [CarouselController],
  providers: [CarouselService],
})
export class CarouselModule {}
