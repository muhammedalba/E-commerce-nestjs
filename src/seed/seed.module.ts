import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { SettingsModule } from '../settings/settings.module';
import { LocationsModule } from '../locations/locations.module';
import { ShippingModule } from '../shipping/shipping.module';
import { PaymentsModule } from '../payments/payments.module';
import { TaxesModule } from '../taxes/taxes.module';
import { RolesModule } from '../roles/roles.module';
import { Controller, Get } from '@nestjs/common';
// http://localhost:4000/api/v1/seed
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
}

@Module({
  imports: [
    SettingsModule,
    LocationsModule,
    ShippingModule,
    PaymentsModule,
    TaxesModule,
    RolesModule,
  ],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
