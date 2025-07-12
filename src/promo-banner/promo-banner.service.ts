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
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { PromoBannerDto } from './shared/dto/promo-banner.dto';
import { UpdatePromoBannerDto } from './shared/dto/updatepromo_banner.dto';
import { I18nContext } from 'nestjs-i18n';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';

@Injectable()
export class PromoBannerService {
  constructor(
    @InjectModel(PromoBanner.name)
    private promoBannerModel: Model<PromoBannerDocument>,
    protected readonly i18n: CustomI18nService,
  ) {}
  private getCurrentLang(): string {
    const lang =
      I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
    return lang;
  }
  //
  // This method is used to localize the document
  localize(data: PromoBanner | PromoBanner[]): PromoBanner | PromoBanner[] {
    const toJSONLocalizedOnly = this.promoBannerModel.schema.methods
      ?.toJSONLocalizedOnly as
      | ((data: PromoBanner | PromoBanner[], lang: string) => PromoBanner)
      | undefined;

    const localizedDoc =
      typeof toJSONLocalizedOnly === 'function'
        ? toJSONLocalizedOnly(data as PromoBanner, this.getCurrentLang())
        : data;
    return localizedDoc;
  }
  //
  // localize(data: PromoBanner): PromoBanner {
  //   const toJSONLocalizedOnly = this.promoBannerModel.schema.methods
  //     ?.toJSONLocalizedOnly as
  //     | ((data: PromoBanner, lang: string) => PromoBanner)
  //     | undefined;

  //   const localizedDoc =
  //     typeof toJSONLocalizedOnly === 'function'
  //       ? toJSONLocalizedOnly(data, this.getCurrentLang())
  //       : data;
  //   return localizedDoc;
  // }
  async getActiveBanner(): Promise<any> {
    const promo = await this.promoBannerModel
      .findOne({ isActive: true })
      .exec();
    if (!promo) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    return {
      status: 'success',
      message: this.i18n.translate('success.found_SUCCESS'),
      data: this.localize(promo),
    };
  }

  async findAllDoc(queryString: QueryString): Promise<{
    status: string;
    results: number;
    pagination: any;
    data: PromoBanner[];
  }> {
    const total = await this.promoBannerModel.countDocuments();

    const features = new ApiFeatures(this.promoBannerModel.find(), queryString)
      .filter()
      .search(PromoBanner.name)
      .sort()
      .limitFields()
      .paginate(total);

    const data = await features.getQuery();
    if (!data) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }

    const localizedDoc = this.localize(data);
    return {
      status: 'success',
      results: data.length,
      pagination: features.getPagination(),
      data: localizedDoc as PromoBanner[],
    };
  }
  //
  async getBanner(id: string): Promise<any> {
    const promo = await this.promoBannerModel.findById(id).exec();
    if (!promo) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    return {
      status: 'success',
      message: this.i18n.translate('success.found_SUCCESS'),
      data: this.localize(promo),
    };
  }
  async createBanner(
    promoBannerDto: PromoBannerDto,
  ): Promise<{ data: PromoBanner; status: string }> {
    const data = await this.promoBannerModel.create(promoBannerDto);
    return {
      status: 'success',
      data: data,
    };
  }

  async update(
    id: string,
    promoBannerDto: UpdatePromoBannerDto,
  ): Promise<{ data: PromoBanner; status: string }> {
    const banner = await this.promoBannerModel.findByIdAndUpdate(
      id,
      { $set: promoBannerDto },
      { new: true, runValidators: true },
    );
    if (!banner) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    return {
      status: 'success',
      data: banner,
    };
  }
  async deleteBanner(id: string): Promise<void> {
    await this.promoBannerModel.findByIdAndDelete(id);
    return;
  }
}
