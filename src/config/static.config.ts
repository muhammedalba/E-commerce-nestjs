import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';

export const StaticConfig = ServeStaticModule.forRootAsync({
  useFactory: () => {
    const uploadsFolder = (process.env.UPLOADS_FOLDER || 'uploads').trim();
    const uploadsPath = path.join(process.cwd(), uploadsFolder);

    return [
      {
        rootPath: uploadsPath,
        serveRoot: (process.env.UPLOADS_ROUTE || '/uploads').trim(),
        serveStaticOptions: {
          index: false, // Prevent looking for index.html
        },
      },
    ];
  },
});
