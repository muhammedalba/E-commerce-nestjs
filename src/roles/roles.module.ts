import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { RolesController } from './controllers/roles.controller';
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
    CacheModule.register({
      ttl: 1000 * 60 * 60 * 12, // Default TTL 12 hours
    }),
  ],
  controllers: [RolesController],
  providers: [RolesService, RolesSeederService],
  exports: [RolesService, RolesSeederService, MongooseModule, CacheModule],
})
export class RolesModule {}
