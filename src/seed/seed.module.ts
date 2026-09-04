import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { SettingsModule } from '../settings/settings.module';
import { LocationsModule } from '../locations/locations.module';
import { ShippingModule } from '../shipping/shipping.module';
import { PaymentsModule } from '../payments/payments.module';
import { TaxesModule } from '../taxes/taxes.module';
import { RolesModule } from '../roles/roles.module';
import { Controller, Get } from '@nestjs/common';
import { UsersModule } from 'src/users/users.module';
// http://localhost:4000/api/v1/seed
// http://localhost:4000/api/v1/seed/ksa

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  async seed() {
    await this.seedService.runSeed();
    return { message: ' seeded successfully' };
  }

  @Get('ksa')
  async seedKSA() {
    await this.seedService.seedKSA();
    return { message: 'KSA locations seeded successfully' };
  }

  @Get('weber-products')
  async seedWeberProducts() {
    const res = await this.seedService.seedWeberProducts();
    return {
      message: 'Weber products seeded successfully',
      data: res,
    };
  }
}

@Module({
  imports: [
    SettingsModule,
    LocationsModule,
    ShippingModule,
    PaymentsModule,
    TaxesModule,
    RolesModule,
    UsersModule,
  ],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
