import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';

export const StaticConfig = ServeStaticModule.forRootAsync({
  useFactory: () => {
    const uploadsFolder = process.env.UPLOADS_FOLDER || 'uploads';
    const uploadsPath = path.join(__dirname, '..', '..', uploadsFolder);

    if (!path.isAbsolute(uploadsPath)) {
      console.warn(`⚠️ UPLOADS_FOLDER is not an absolute path: ${uploadsPath}`);
    }

    return [
      {
        rootPath: uploadsPath,
        serveRoot: process.env.UPLOADS_ROUTE || '/uploads',
      },
    ];
  },
});
