import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { HomepageService } from './homepage.service';

@Controller('homepage')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Public()
  @Get('hero')
  getHero() {
    return this.homepageService.getHero();
  }

  @Public()
  @Get('tiles')
  getTiles(@Query('section') section?: string) {
    return this.homepageService.getTiles(section);
  }

  @Public()
  @Get('social')
  getSocial() {
    return this.homepageService.getSocial();
  }
}
