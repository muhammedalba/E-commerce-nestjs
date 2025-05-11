import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './shared/dto/create-coupon.dto';
import { UpdateCouponDto } from './shared/dto/update-coupon.dto';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { Roles } from 'src/auth/shared/decorators/rolesdecorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';

@Controller('coupons')
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  create(@Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.create(createCouponDto);
  }

  @Get()
  findAll(@Param() queryString: QueryString) {
    return this.couponsService.findAll(queryString);
  }

  @Get(':id')
  findOne(@Param() idParamDto: IdParamDto) {
    return this.couponsService.findOne(idParamDto);
  }

  @Patch(':id')
  update(
    @Param() idParamDto: IdParamDto,
    @Body() updateCouponDto: UpdateCouponDto,
  ) {
    return this.couponsService.update(idParamDto, updateCouponDto);
  }

  @Delete(':id')
  remove(@Param() idParamDto: IdParamDto) {
    return this.couponsService.remove(idParamDto);
  }
}
