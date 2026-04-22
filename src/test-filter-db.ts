import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ProductQueryService } from './products/services/products-query.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ProductQueryService);
  
  const res = await service.findAllWithFilters({ limit: 10 } as any, { soldMin: 0, soldMax: 20000 });
  console.log('Result length:', res.data.length);
  console.log('Total:', res.total);
  if (res.data.length > 0) {
    console.log('Prices of first product variants:', res.data[0].variants.map((v: any) => v.price));
  }
  
  await app.close();
}
bootstrap();
