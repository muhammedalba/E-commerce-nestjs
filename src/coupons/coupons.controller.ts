import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './shared/dto/create-coupon.dto';
import { UpdateCouponDto } from './shared/dto/update-coupon.dto';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';

@Controller('coupons')
@UseGuards(AuthGuard, PermissionsGuard)
@UseInterceptors(ClearCacheInterceptor)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}
  // ------------ =============================== ---------- //
  // ------------ ======  CREATE COUPON   ====== ---------- //
  // ------------ =============================== ---------- //
  @Post()
  @RequirePermission(Permissions.CREATE_COUPON)
  @ClearCache('coupons')
  create(@Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.create(createCouponDto);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  GET ALL COUPONS   ====== ---------- //
  // ------------ =============================== ---------- //
  @Get()
  @RequirePermission(Permissions.VIEW_COUPONS)
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  findAll(@Query() queryString: QueryString) {
    return this.couponsService.findAll(queryString);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  GET COUPON BY ID   ====== ---------- //
  // ------------ =============================== ---------- //
  @Get(':id')
  @RequirePermission(Permissions.VIEW_COUPONS)
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  findOne(@Param() idParamDto: IdParamDto) {
    return this.couponsService.findOne(idParamDto);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  UPDATE COUPON   ====== ---------- //
  // ------------ =============================== ---------- //
  @Patch(':id')
  @RequirePermission(Permissions.UPDATE_COUPON)
  @ClearCache('coupons')
  update(
    @Param() idParamDto: IdParamDto,
    @Body() updateCouponDto: UpdateCouponDto,
  ) {
    return this.couponsService.update(idParamDto, updateCouponDto);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  DELETE COUPON   ====== ---------- //
  // ------------ =============================== ---------- //
  @Delete(':id')
  @RequirePermission(Permissions.DELETE_COUPON)
  @ClearCache('coupons')
  remove(@Param() idParamDto: IdParamDto) {
    return this.couponsService.remove(idParamDto);
  }
}
