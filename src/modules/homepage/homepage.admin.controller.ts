import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { HomepageService } from './homepage.service';
import { UpdateHeroDto } from './dto/update-hero.dto';
import { CreateTileDto } from './dto/create-tile.dto';
import { UpdateTileDto } from './dto/update-tile.dto';
import { UpdateSocialConfigDto } from './dto/update-social-config.dto';
import { CreateSocialImageDto } from './dto/create-social-image.dto';
import { UpdateSocialImageDto } from './dto/update-social-image.dto';

@Controller('admin/homepage')
@Roles(user_role.admin, user_role.manager)
export class HomepageAdminController {
  constructor(private readonly homepageService: HomepageService) {}

  // ── Hero ──────────────────────────────────────────────────────────────────

  @Put('hero')
  upsertHero(@Body() dto: UpdateHeroDto) {
    return this.homepageService.upsertHero(dto);
  }

  @Post('hero/upload')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'desktopImage', maxCount: 1 },
        { name: 'mobileImage', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        fileFilter: (_req, file, cb) => {
          if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'), false);
          }
          cb(null, true);
        },
        limits: { fileSize: 5 * 1024 * 1024 },
      },
    ),
  )
  uploadHeroImages(
    @UploadedFiles()
    files?: { desktopImage?: Express.Multer.File[]; mobileImage?: Express.Multer.File[] },
  ) {
    return this.homepageService.uploadHeroImages(files ?? {});
  }

  // ── Tiles ─────────────────────────────────────────────────────────────────

  @Get('tiles')
  getTiles(@Query('section') section?: string) {
    return this.homepageService.getTilesForAdmin(section);
  }

  @Post('tiles')
  createTile(@Body() dto: CreateTileDto) {
    return this.homepageService.createTile(dto);
  }

  @Patch('tiles/:id')
  updateTile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTileDto,
  ) {
    return this.homepageService.updateTile(id, dto);
  }

  @Delete('tiles/:id')
  removeTile(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.homepageService.removeTile(id);
  }

  // ── Social ────────────────────────────────────────────────────────────────

  @Patch('social/config')
  upsertSocialConfig(@Body() dto: UpdateSocialConfigDto) {
    return this.homepageService.upsertSocialConfig(dto);
  }

  @Post('social/images')
  createSocialImage(@Body() dto: CreateSocialImageDto) {
    return this.homepageService.createSocialImage(dto);
  }

  @Patch('social/images/:id')
  updateSocialImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSocialImageDto,
  ) {
    return this.homepageService.updateSocialImage(id, dto);
  }

  @Delete('social/images/:id')
  removeSocialImage(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.homepageService.removeSocialImage(id);
  }
}
