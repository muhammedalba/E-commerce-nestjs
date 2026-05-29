import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SeedService } from './seed/seed.service';

async function bootstrap() {
  console.log('Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const seedService = app.get(SeedService);
  try {
    await seedService.runSeed();
    console.log('Seeded successfully!');
  } catch (err: any) {
    console.error('*** Seed error stack trace ***');
    console.error(err.stack || err);
  } finally {
    await app.close();
  }
}
bootstrap();
