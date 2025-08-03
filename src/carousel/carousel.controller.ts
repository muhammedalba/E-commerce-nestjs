import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { CarouselService } from './carousel.service';
import { CreateCarouselDto } from './shared/dto/create-carousel.dto';
import { UpdateCarouselDto } from './shared/dto/update-carousel.dto';

import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { ParseFileFieldsPipe } from 'src/shared/files/ParseFileFieldsPipe';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { Request } from 'express';
import { MaxFileCount } from 'src/shared/files/constants/file-count.constants';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Carousel } from './shared/schemas/carousel.schema';
type file = Request['file'];

@ApiTags('Carousel')
@Controller('carousel')
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
export class CarouselController {
  constructor(private readonly carouselService: CarouselService) {}

  static readonly imageSize = [
    { name: 'carouselSm', maxCount: MaxFileCount.CAROUSEl },
    { name: 'carouselMd', maxCount: MaxFileCount.CAROUSEl },
    { name: 'carouselLg', maxCount: MaxFileCount.CAROUSEl },
  ];

  @Post()
  @UseInterceptors(FileFieldsInterceptor(CarouselController.imageSize))
  @ApiOperation({ summary: 'Create a new carousel item (Admin only)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateCarouselDto })
  @ApiCreatedResponse({
    description: 'The carousel item has been successfully created.',
    type: Carousel,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request. Invalid input data or missing images.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have admin role.',
  })
  async create(
    @Body()
    createCarouselDto: CreateCarouselDto,
    @UploadedFiles(
      new ParseFileFieldsPipe(
        '1MB',
        ['png', 'jpeg', 'webp'],
        [
          { name: 'carouselLg', required: true },
          { name: 'carouselMd', required: true },
          { name: 'carouselSm', required: true },
        ],
      ),
    )
    files: {
      carouselLg: file;
      carouselMd: file;
      carouselSm: file;
    },
  ) {
    if (!files.carouselLg || !files.carouselMd || !files.carouselSm) {
      throw new BadRequestException('All carousel images are required.');
    }
    return await this.carouselService.createCarousel(createCarouselDto, {
      carouselLg: files.carouselLg,
      carouselMd: files.carouselMd,
      carouselSm: files.carouselSm,
    });
  }

  @Get()
  @Roles(roles.USER, roles.ADMIN, roles.MANAGER)
  @ApiOperation({
    summary: 'Get all carousel items with optional filtering and pagination',
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
    description: 'Sort order (e.g., -createdAt)',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    type: String,
    description:
      'Comma-separated list of fields to include (e.g., description,carouselSm)',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    type: String,
    description: 'Search keyword for carousel items',
  })
  @ApiOkResponse({
    description: 'Return all carousel items.',
    type: [Carousel],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have required role.',
  })
  async findAll(@Query() queryString: QueryString) {
    return await this.carouselService.findAll(queryString);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a carousel item by ID' })
  @ApiParam({
    name: 'id',
    description: 'ID of the carousel item to retrieve',
    type: String,
  })
  @ApiOkResponse({
    description: 'Return a single carousel item.',
    type: Carousel,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Carousel item not found.',
  })
  async findOne(@Param() idParamDto: IdParamDto) {
    return await this.carouselService.findOne(idParamDto);
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor(CarouselController.imageSize))
  @ApiOperation({
    summary: 'Update an existing carousel item by ID (Admin only)',
  })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateCarouselDto })
  @ApiParam({
    name: 'id',
    description: 'ID of the carousel item to update',
    type: String,
  })
  @ApiOkResponse({
    description: 'The carousel item has been successfully updated.',
    type: Carousel,
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
    description: 'Carousel item not found.',
  })
  async update(
    @UploadedFiles(
      new ParseFileFieldsPipe(
        '1MB',
        ['png', 'jpeg', 'webp'],
        [
          { name: 'carouselLg', required: false },
          { name: 'carouselMd', required: false },
          { name: 'carouselSm', required: false },
        ],
      ),
    )
    files: {
      carouselLg?: MulterFileType;
      carouselMd?: MulterFileType;
      carouselSm?: MulterFileType;
    },
    @Param() idParamDto: IdParamDto,
    @Body() updateCarouselDto: UpdateCarouselDto,
  ): Promise<any> {
    return await this.carouselService.updateOne(
      idParamDto,
      updateCarouselDto,
      files,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a carousel item by ID (Admin only)' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    description: 'ID of the carousel item to delete',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The carousel item has been successfully deleted.',
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
    description: 'Carousel item not found.',
  })
  async remove(@Param() idParamDto: IdParamDto): Promise<void> {
    return await this.carouselService.remove(idParamDto);
  }
}
