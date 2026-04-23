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
import { CacheTTL } from '@nestjs/cache-manager';
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
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';

@Controller('supplier')
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
@UseInterceptors(ClearCacheInterceptor)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}
  // ------------ =============================== ---------- //
  // ------------ ======  GET statistics  ====== ---------- //
  // ------------ =============================== ---------- //
  @Get('statistics')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(300000) // 5 minutes
  async suppliers_statistics(): Promise<any> {
    return await this.supplierService.suppliers_statistics();
  }
  // ------------ =============================== ---------- //
  // ------------ ======  CREATE SUPPLIER   ====== ---------- //
  // ------------ =============================== ---------- //
  @Post()
  @UseInterceptors(FileInterceptor('avatar'))
  create(
    @Body() createSupplierDto: CreateSupplierDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ) {
    return this.supplierService.create_Supplier(createSupplierDto, file);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  GET ALL SUPPLIERS  ====== ---------- //
  // ------------ =============================== ---------- //
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async findAll(@Query() queryString: QueryString): Promise<any> {
    return await this.supplierService.get_Suppliers(queryString);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  GET SUPPLIER BY ID  ====== ---------- //
  // ------------ =============================== ---------- //
  @Get(':id')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async findOne(@Param() id: IdParamDto): Promise<any> {
    return await this.supplierService.get_Supplier(id);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  UPDATE SUPPLIER  ====== ---------- //
  // ------------ =============================== ---------- //
  @Patch(':id')
  @UseInterceptors(FileInterceptor('avatar'))
  update(
    @Param() id: IdParamDto,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ) {
    return this.supplierService.update__Supplier(id, updateSupplierDto, file);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  DELETE SUPPLIER  ====== ---------- //
  // ------------ =============================== ---------- //
  @Delete(':id')
  remove(@Param() id: IdParamDto) {
    return this.supplierService.delete_Supplier(id);
  }
}
