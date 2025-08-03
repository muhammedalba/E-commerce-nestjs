import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './shared/dto/create-coupon.dto';
import { UpdateCouponDto } from './shared/dto/update-coupon.dto';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Coupon } from './shared/Schemas/coupons.schema';

@ApiTags('Coupons')
@Controller('coupons')
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
@ApiBearerAuth()
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new coupon (Admin only)' })
  @ApiBody({ type: CreateCouponDto })
  @ApiCreatedResponse({
    description: 'The coupon has been successfully created.',
    type: Coupon,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request. Invalid input data.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have admin role.',
  })
  create(@Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.create(createCouponDto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Get all coupons with optional filtering and pagination (Admin only)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sort order (e.g., -name)',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    type: String,
    description:
      'Comma-separated list of fields to include (e.g., name,discount)',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    type: String,
    description: 'Search keyword for coupons',
  })
  @ApiOkResponse({ description: 'Return all coupons.', type: [Coupon] })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have admin role.',
  })
  findAll(@Param() queryString: QueryString) {
    return this.couponsService.findAll(queryString);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a coupon by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'ID of the coupon to retrieve',
    type: String,
  })
  @ApiOkResponse({ description: 'Return a single coupon.', type: Coupon })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Coupon not found.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have admin role.',
  })
  findOne(@Param() idParamDto: IdParamDto) {
    return this.couponsService.findOne(idParamDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing coupon by ID (Admin only)' })
  @ApiBody({ type: UpdateCouponDto })
  @ApiParam({
    name: 'id',
    description: 'ID of the coupon to update',
    type: String,
  })
  @ApiOkResponse({
    description: 'The coupon has been successfully updated.',
    type: Coupon,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request. Invalid input data.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have admin role.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Coupon not found.',
  })
  update(
    @Param() idParamDto: IdParamDto,
    @Body() updateCouponDto: UpdateCouponDto,
  ) {
    return this.couponsService.update(idParamDto, updateCouponDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a coupon by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'ID of the coupon to delete',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The coupon has been successfully deleted.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have admin role.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Coupon not found.',
  })
  remove(@Param() idParamDto: IdParamDto) {
    return this.couponsService.remove(idParamDto);
  }
}
