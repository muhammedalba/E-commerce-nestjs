import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { SettingsModule } from '../settings/settings.module';
import { LocationsModule } from '../locations/locations.module';
import { ShippingModule } from '../shipping/shipping.module';
import { PaymentsModule } from '../payments/payments.module';
import { TaxesModule } from '../taxes/taxes.module';
import { RolesModule } from '../roles/roles.module';
import {
  CanActivate,
  Controller,
  Get,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { UsersModule } from 'src/users/users.module';
// http://localhost:4000/api/v1/seed
// http://localhost:4000/api/v1/seed/ksa
// http://localhost:4000/api/v1/seed/weber-products
// http://localhost:4000/api/v1/seed/full-catalog

/**
 * Seed routes have no auth: hide them in production. Checked per request,
 * since NODE_ENV may come from .env, loaded after this module is evaluated.
 */
class NotInProductionGuard implements CanActivate {
  canActivate(): boolean {
    if (process.env.NODE_ENV === 'production') throw new NotFoundException();
    return true;
  }
}

@Controller('seed')
@UseGuards(NotInProductionGuard)
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

  @Get('full-catalog')
  async seedFullCatalog() {
    const res = await this.seedService.seedFullCatalog();
    return {
      message: 'Full catalog seeded successfully',
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
