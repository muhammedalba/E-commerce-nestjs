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
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './shared/dto/create-coupon.dto';
import { UpdateCouponDto } from './shared/dto/update-coupon.dto';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';

@Controller('coupons')
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
@UseInterceptors(ClearCacheInterceptor)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}
  // ------------ =============================== ---------- //
  // ------------ ======  CREATE COUPON   ====== ---------- //
  // ------------ =============================== ---------- //
  @Post()
  @ClearCache('coupons')
  create(@Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.create(createCouponDto);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  GET ALL COUPONS   ====== ---------- //
  // ------------ =============================== ---------- //
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  findAll(@Param() queryString: QueryString) {
    return this.couponsService.findAll(queryString);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  GET COUPON BY ID   ====== ---------- //
  // ------------ =============================== ---------- //
  @Get(':id')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  findOne(@Param() idParamDto: IdParamDto) {
    return this.couponsService.findOne(idParamDto);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  UPDATE COUPON   ====== ---------- //
  // ------------ =============================== ---------- //
  @Patch(':id')
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
  @ClearCache('coupons')
  remove(@Param() idParamDto: IdParamDto) {
    return this.couponsService.remove(idParamDto);
  }
}
