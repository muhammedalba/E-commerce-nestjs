import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateBrandDto } from './dto/create-brand.dto';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { Brand } from './schemas/brand.schema';
import { Model } from 'mongoose';
import { I18nContext } from 'nestjs-i18n';
import { MulterFile } from 'src/shared/utils/interfaces/fileInterface';

@Injectable()
export class BrandsService {
  constructor(
    @InjectModel(Brand.name) private brandModel: Model<Brand>,
    private readonly fileUploadService: FileUploadService,
  ) {}
  // get current language
  private getCurrentLang(): string {
    const lang =
      I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
    return lang;
  }
  async create(
    createBrandDto: CreateBrandDto,
    file: MulterFile,
  ): Promise<Brand> {
    // const brand = await this.brandModel.create(createBrandDto);
    //2) file upload service (save image in disk storage)
    let filePath = `/${process.env.UPLOADS_FOLDER}/brands/image.png`;
    if (file) {
      try {
        filePath = await this.fileUploadService.saveFileToDisk(
          file,
          `./${process.env.UPLOADS_FOLDER}/brands`,
        );
      } catch (error) {
        console.error('File upload failed:', error);
      }
    }

    //3) save user to db with avatar path
    createBrandDto.image = filePath;
    const new_brand = await this.brandModel.create(createBrandDto);
    //4) update avatar url
    new_brand.image = `${process.env.BASE_URL}${filePath}`;

    const toJSONLocalizedOnly = this.brandModel.schema.methods
      .toJSONLocalizedOnly as (new_brand: Brand, lang: string) => Brand;
    const localize_brand = toJSONLocalizedOnly(
      new_brand,
      this.getCurrentLang(),
    );
    return localize_brand;
  }

  async findAll(): Promise<Brand[]> {
    const brands = await this.brandModel.find();
    if (!brands) {
      throw new BadRequestException('Brands not found');
    }
    const toJSONLocalizedOnly = this.brandModel.schema.methods
      .toJSONLocalizedOnly as (brands: Brand[], lang: string) => Brand[];
    const localize_brand = toJSONLocalizedOnly(brands, this.getCurrentLang());
    return localize_brand;
  }

  async findOne(id: string) {
    const brand = await this.brandModel.findById(id);
    if (!brand) {
      throw new BadRequestException('Brand not found');
    }
    const toJSONLocalizedOnly = this.brandModel.schema.methods
      .toJSONLocalizedOnly as (brand: Brand, lang: string) => Brand[];
    const localize_brand = toJSONLocalizedOnly(brand, this.getCurrentLang());
    return localize_brand;
  }

  remove(id: number) {
    return `This action removes a #${id} brand`;
  }
}
