import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'stockzy-ecommerce-api',
    };
  }

  @Public()
  @Get('debug/error')
  triggerError() {
    const env = this.configService.get<string>('NODE_ENV') ?? 'development';
    if (env === 'production') {
      return {
        status: 'disabled',
      };
    }

    throw new Error('Sentry test error');
  }

}
