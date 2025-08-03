import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Query,
  UploadedFiles,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './shared/dto/create-order.dto';
import { UpdateOrderDto } from './shared/dto/update-order.dto';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { ParseFileFieldsPipe } from 'src/shared/files/ParseFileFieldsPipe';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Order')
@Controller('order')
@UseGuards(AuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}
  private static readonly imageSize = [
    { name: 'transferReceiptImg', maxCount: 1 },
    { name: 'InvoicePdf', maxCount: 1 },
    { name: 'DeliveryReceiptImage', maxCount: 1 },
  ];
  @Get('statistics')
  @ApiOperation({ summary: 'Get order statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Order statistics retrieved successfully.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  async OrdersStatistics() {
    return await this.orderService.OrdersStatistics();
  }
  @Post('PaymentByBankTransfer')
  @ApiOperation({ summary: 'Checkout by bank transfer' })
  @ApiResponse({ status: 201, description: 'Order created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        transferReceiptImg: {
          type: 'string',
          format: 'binary',
        },
        dto: {
          $ref: '#/components/schemas/CreateOrderDto',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('transferReceiptImg'))
  async checkoutByBankTransfer(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], true))
    file: MulterFileType,
    @Req() req: { user: JwtPayload },
    @Body() dto: CreateOrderDto,
  ) {
    return await this.orderService.PaymentByBankTransfer(
      req.user.user_id,
      req.user.email,
      dto,
      file,
    );
  }
  // This endpoint is used to apply a coupon to an order

  @Post('applyCoupon')
  @ApiOperation({ summary: 'Apply a coupon to an order' })
  @ApiResponse({ status: 200, description: 'Coupon applied successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid coupon or order.' })
  async applyCoupon(
    @Req() req: { user: JwtPayload },
    @Body() dto: CreateOrderDto,
  ) {
    return await this.orderService.applyCoupon(req.user.user_id, dto);
  }
  @Get()
  @ApiOperation({ summary: 'Get all orders for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit the number of results',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset the results for pagination',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sort order (e.g., -createdAt)',
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    type: String,
    description: 'Filter results (e.g., status=completed)',
  })
  findAll(@Req() req: { user: JwtPayload }, @Query() queryString: QueryString) {
    return this.orderService.findAll(req.user, queryString);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order by ID' })
  @ApiParam({ name: 'id', description: 'ID of the order to retrieve' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async findOne(@Param() idParamDto: IdParamDto) {
    return await this.orderService.findOne(idParamDto.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an order by ID (Admin and Manager only)' })
  @ApiResponse({ status: 200, description: 'Order updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  @ApiParam({ name: 'id', description: 'ID of the order to update' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        transferReceiptImg: {
          type: 'string',
          format: 'binary',
        },
        DeliveryReceiptImage: {
          type: 'string',
          format: 'binary',
        },
        InvoicePdf: {
          type: 'string',
          format: 'binary',
        },
        // Add other properties from UpdateOrderDto here if they are part of the multipart form
      },
    },
  })
  @Roles(roles.ADMIN, roles.MANAGER)
  @UseInterceptors(FileFieldsInterceptor(OrderController.imageSize))
  async update(
    @UploadedFiles(
      new ParseFileFieldsPipe(
        '1MB',
        ['png', 'jpeg', 'webp', 'pdf'],
        [
          { name: 'transferReceiptImg', required: false },
          { name: 'DeliveryReceiptImage', required: false },
          { name: 'InvoicePdf', required: false },
        ],
      ),
    ) // @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], true))
    files: {
      transferReceiptImg: MulterFileType;
      DeliveryReceiptImage: MulterFileType;
      InvoicePdf: MulterFileType;
    },
    @Param() idParamDto: IdParamDto,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return await this.orderService.update(idParamDto, updateOrderDto, files);
  }

  @Delete(':id')
  @Roles(roles.ADMIN, roles.MANAGER)
  async remove(@Param() idParamDto: IdParamDto) {
    return await this.orderService.remove(idParamDto);
  }
}
