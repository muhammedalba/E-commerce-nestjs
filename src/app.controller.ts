import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { AllowAnyClient } from 'src/shared/decorators/allow-any-client.decorator';

@Controller()
@AllowAnyClient()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): object {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
