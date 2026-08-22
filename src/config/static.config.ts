import { ServeStaticModule } from '@nestjs/serve-static';
import { getUploadsRoot } from 'src/shared/utils/upload-path.util';

export const StaticConfig = ServeStaticModule.forRootAsync({
  useFactory: () => {
    // getUploadsRoot() resolves UPLOADS_ROOT env var (or falls back to the
    // legacy UPLOADS_FOLDER inside process.cwd() for local development).
    // This decouples the static file serving from the project directory so
    // Hostinger redeployments no longer wipe uploaded files.
    const uploadsPath = getUploadsRoot();

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
