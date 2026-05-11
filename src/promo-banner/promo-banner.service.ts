import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PromoBanner,
  PromoBannerDocument,
} from './shared/schema/promo-banner.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { PromoBannerDto } from './shared/dto/promo-banner.dto';
import { UpdatePromoBannerDto } from './shared/dto/updatepromo_banner.dto';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';

@Injectable()
export class PromoBannerService {
  constructor(
    @InjectModel(PromoBanner.name)
    private promoBannerModel: Model<PromoBannerDocument>,
    protected readonly i18n: CustomI18nService,
  ) {}
  // ----------------------------------------------------------------
  // -----------------GET ALL BANNERS--------------------------------
  async findAllDoc(
    queryString: QueryString,
    allLangs: boolean = false,
  ): Promise<{
    results: number;
    pagination: any;
    data: PromoBanner[];
  }> {
    const features = new ApiFeatures(this.promoBannerModel.find(), queryString)
      .filter()
      .search(PromoBanner.name);

    const filter = features.getQuery().getFilter();
    const total = await this.promoBannerModel.countDocuments(filter);
    features.sort().limitFields().paginate(total);
    const data = await features.getQuery();

    if (!data) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }
    console.log('pag', features.getPagination());
    return {
      results: data.length,
      pagination: features.getPagination(),
      data: this.i18n.localize(data, allLangs),
    };
  }

  // ----------------------------------------------------------------
  // -----------------GET ACTIVE BANNER--------------------------------

  async getActiveBanner(): Promise<any> {
    const promo = await this.promoBannerModel
      .findOne({ isActive: true })
      .exec();
    if (!promo) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    return this.i18n.localize(promo);
  }
  // ----------------------------------------------------------------

  // ----------------------------------------------------------------
  // -----------------GET BANNER BY ID--------------------------------

  async getBanner(id: string, allLangs: boolean = false): Promise<any> {
    const promo = await this.promoBannerModel.findById(id).exec();
    if (!promo) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    return this.i18n.localize(promo, allLangs);
  }

  // ----------------------------------------------------------------
  // -----------------CREATE BANNER--------------------------------

  async createBanner(
    promoBannerDto: PromoBannerDto,
  ): Promise<{ data: PromoBanner }> {
    // check if there is active banner
    if (promoBannerDto.isActive === true) {
      const isBannerExist = await this.promoBannerModel.exists({
        isActive: true,
      });
      if (isBannerExist) {
        throw new BadRequestException(
          this.i18n.translate('exception.ACTIVE_BANNER_ALREADY_EXISTS'),
        );
      }
    }
    const data = await this.promoBannerModel.create(promoBannerDto);
    return this.i18n.localize(data);
  }

  // ----------------------------------------------------------------
  // -----------------UPDATE BANNER---------------------------------
  // ---------------------------------------------------------------

  async update(
    id: string,
    promoBannerDto: UpdatePromoBannerDto,
  ): Promise<{ data: PromoBanner; status: string }> {
    // 1)get the banner
    const banner = await this.promoBannerModel.findById(id).exec();
    if (!banner) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }

    // 2) check if the banner is active
    if (promoBannerDto.isActive === true && banner.isActive !== true) {
      const isAnotherActive = await this.promoBannerModel.exists({
        isActive: true,
        _id: { $ne: id },
      });

      if (isAnotherActive) {
        throw new BadRequestException(
          this.i18n.translate('exception.ACTIVE_BANNER_ALREADY_EXISTS'),
        );
      }
    }

    // 3) update the fields directly on the document that we fetched
    Object.assign(banner, promoBannerDto);

    // 4) save the document (Mongoose will automatically run the validators when using save)
    const updatedBanner = await banner.save();

    return this.i18n.localize(updatedBanner);
  }

  // ----------------------------------------------------------------
  // -----------------DELETE BANNER--------------------------------

  async deleteBanner(id: string): Promise<void> {
    await this.promoBannerModel.findByIdAndDelete(id);
    return;
  }
}
