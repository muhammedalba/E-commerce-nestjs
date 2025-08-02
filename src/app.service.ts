import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return `application ${process.env.APP_NAME}  is running with  ${process.env.BASE_URL}}`;
  }
}
