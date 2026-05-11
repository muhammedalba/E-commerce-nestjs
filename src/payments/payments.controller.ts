import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { PaymentsService } from './payments.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';

@Controller('payments')
@UseInterceptors(ClearCacheInterceptor)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /* ================================================ */
  /*  GET ACTIVE METHODS - Public (للـ Checkout)       */
  /* ================================================ */
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(3600000)
  getActiveMethods() {
    return this.paymentsService.getActiveMethods();
  }

  /* ================================================ */
  /*  ADMIN: GET ALL (including inactive)              */
  /* ================================================ */
  @Get('all')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  findAll() {
    return this.paymentsService.findAll();
  }

  /* ================================================ */
  /*  CREATE - Admin Only                              */
  /* ================================================ */
  @Post()
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('payments')
  create(@Body() body: any) {
    return this.paymentsService.create(body);
  }

  /* ================================================ */
  /*  UPDATE - Admin Only                              */
  /* ================================================ */
  @Patch(':id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('payments')
  update(@Param() { id }: IdParamDto, @Body() body: any) {
    return this.paymentsService.update(id, body);
  }

  /* ================================================ */
  /*  DELETE - Admin Only                              */
  /* ================================================ */
  @Delete(':id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('payments')
  remove(@Param() { id }: IdParamDto) {
    return this.paymentsService.remove(id);
  }
}
