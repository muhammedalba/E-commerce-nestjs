import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesController } from './roles.controller';
import { RolesService } from './services/roles.service';
import { RolesSeederService } from './services/roles-seeder.service';
import { Role, RoleSchema } from './shared/schemas/role.schema';
import { User, UserSchema } from '../auth/shared/schema/user.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
    // No own CacheModule: this module is @Global, so exporting one created a
    // second global CACHE_MANAGER and cache clears could hit the wrong instance.
    // Uses the app-wide cache (AppModule); every set() passes an explicit TTL.
  ],
  controllers: [RolesController],
  providers: [RolesService, RolesSeederService],
  exports: [RolesService, RolesSeederService, MongooseModule],
})
export class RolesModule {}
