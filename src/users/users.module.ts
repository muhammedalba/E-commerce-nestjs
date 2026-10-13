import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/auth/shared/schema/user.schema';
import { UsersStatistics } from './users-helper/users-statistics.service';

import { Role, RoleSchema } from 'src/roles/shared/schemas/role.schema';
import { AuditModule } from 'src/audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersStatistics],
  exports: [UsersService],
})
export class UsersModule {}
