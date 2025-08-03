import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './shared/dto/create-supplier.dto';
import { UpdateSupplierDto } from './shared/dto/update-supplier.dto';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { FileInterceptor } from '@nestjs/platform-express';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Supplier')
@Controller('supplier')
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}
  @Get('statistics')
  @ApiOperation({ summary: 'Get supplier statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Supplier statistics retrieved successfully.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async suppliers_statistics(): Promise<any> {
    return await this.supplierService.suppliers_statistics();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new supplier (Admin only)' })
  @ApiResponse({ status: 201, description: 'Supplier created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string' },
        address: { type: 'string' },
        description: { type: 'string' },
        avatar: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['name', 'email', 'phone', 'address'],
    },
  })
  @UseInterceptors(FileInterceptor('avatar'))
  create(
    @Body() createSupplierDto: CreateSupplierDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ) {
    return this.supplierService.create_Supplier(createSupplierDto, file);
  }

  @Get()
  @ApiOperation({ summary: 'Get all suppliers (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Suppliers retrieved successfully.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term for filtering suppliers',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sort order (e.g., "name:asc", "createdAt:desc")',
  })
  async findAll(@Query() queryString: QueryString): Promise<any> {
    return await this.supplierService.get_Suppliers(queryString);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a supplier by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Supplier retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Supplier not found.' })
  @ApiParam({ name: 'id', description: 'ID of the supplier to retrieve' })
  async findOne(@Param() id: IdParamDto): Promise<any> {
    return await this.supplierService.get_Supplier(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a supplier by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Supplier updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Supplier not found.' })
  @ApiParam({ name: 'id', description: 'ID of the supplier to update' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string' },
        address: { type: 'string' },
        description: { type: 'string' },
        avatar: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('avatar'))
  update(
    @Param() id: IdParamDto,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ) {
    return this.supplierService.update__Supplier(id, updateSupplierDto, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a supplier by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Supplier deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Supplier not found.' })
  @ApiParam({ name: 'id', description: 'ID of the supplier to delete' })
  remove(@Param() id: IdParamDto) {
    return this.supplierService.delete_Supplier(id);
  }
}
