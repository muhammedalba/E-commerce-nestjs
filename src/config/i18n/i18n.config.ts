import {
  I18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
} from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

// Built: dist/src/config/i18n → dist/i18n (copied by the nest-cli asset).
// From source (e2e tests): src/config/i18n → src/i18n.
const BUILT_I18N_PATH = path.join(__dirname, '..', '..', '..', 'i18n');
const SOURCE_I18N_PATH = path.join(__dirname, '..', '..', 'i18n');
const I18N_PATH =
  !fs.existsSync(BUILT_I18N_PATH) && fs.existsSync(SOURCE_I18N_PATH)
    ? SOURCE_I18N_PATH
    : BUILT_I18N_PATH;

export const I18nConfig = I18nModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    fallbackLanguage: configService.getOrThrow('DEFAULT_LANGUAGE'),
    loaderOptions: {
      path: I18N_PATH,
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
