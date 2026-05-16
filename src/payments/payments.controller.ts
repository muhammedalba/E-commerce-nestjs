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
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
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
  @RequirePermission(Permissions.VIEW_ORDERS)
  @UseGuards(AuthGuard, PermissionsGuard)
  findAll() {
    return this.paymentsService.findAll();
  }

  /* ================================================ */
  /*  CREATE - Admin Only                              */
  /* ================================================ */
  @Post()
  @RequirePermission(Permissions.VIEW_ORDERS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('payments')
  create(@Body() body: any) {
    return this.paymentsService.create(body);
  }

  /* ================================================ */
  /*  UPDATE - Admin Only                              */
  /* ================================================ */
  @Patch(':id')
  @RequirePermission(Permissions.VIEW_ORDERS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('payments')
  update(@Param() { id }: IdParamDto, @Body() body: any) {
    return this.paymentsService.update(id, body);
  }

  /* ================================================ */
  /*  DELETE - Admin Only                              */
  /* ================================================ */
  @Delete(':id')
  @RequirePermission(Permissions.VIEW_ORDERS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('payments')
  remove(@Param() { id }: IdParamDto) {
    return this.paymentsService.remove(id);
  }
}
