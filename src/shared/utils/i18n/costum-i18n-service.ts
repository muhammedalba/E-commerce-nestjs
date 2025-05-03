import { Injectable } from '@nestjs/common';
import { I18nContext, I18nService, TranslateOptions } from 'nestjs-i18n';

@Injectable()
export class CustomI18nService {
  constructor(private readonly i18n: I18nService) {}
  translate(key: string, options?: TranslateOptions): string {
    const lang = I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE;
    return this.i18n.translate(key, {
      lang,
      ...options,
    });
  }
}
