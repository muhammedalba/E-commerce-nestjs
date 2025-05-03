import {
  I18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
} from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

export const I18nConfig = I18nModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    fallbackLanguage: configService.getOrThrow('DEFAULT_LANGUAGE'),
    loaderOptions: {
      path: path.join(__dirname, '..', '..', 'i18n'),
      watch: true,
    },
  }),
  resolvers: [
    { use: QueryResolver, options: ['lang'] },
    AcceptLanguageResolver,
    new HeaderResolver(['x-lang']),
  ],
  inject: [ConfigService],
});
