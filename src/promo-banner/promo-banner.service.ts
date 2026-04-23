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
import { I18nHelper } from 'src/shared/utils/i18n/i18n-helper';

@Injectable()
export class PromoBannerService {
  constructor(
    @InjectModel(PromoBanner.name)
    private promoBannerModel: Model<PromoBannerDocument>,
    protected readonly i18n: CustomI18nService,
  ) {}

  async getActiveBanner(): Promise<any> {
    const promo = await this.promoBannerModel
      .findOne({ isActive: true })
      .exec();
    if (!promo) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    return I18nHelper.localize(promo);
  }

  async findAllDoc(
    queryString: QueryString,
    allLangs: boolean = false,
  ): Promise<{
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

    return I18nHelper.localize(data, allLangs);
  }
  //
  async getBanner(id: string, allLangs: boolean = false): Promise<any> {
    const promo = await this.promoBannerModel.findById(id).exec();
    if (!promo) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    return I18nHelper.localize(promo, allLangs);
  }
  async createBanner(
    promoBannerDto: PromoBannerDto,
  ): Promise<{ data: PromoBanner; status: string }> {
    const data = await this.promoBannerModel.create(promoBannerDto);
    return I18nHelper.localize(data);
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
    return I18nHelper.localize(banner);
  }
  async deleteBanner(id: string): Promise<void> {
    await this.promoBannerModel.findByIdAndDelete(id);
    return;
  }
}
