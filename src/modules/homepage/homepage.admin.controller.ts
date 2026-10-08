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
  Req,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { buildAuditContext } from '../../common/audit/audit-context';
import { HomepageService } from './homepage.service';
import { UpdateHeroDto } from './dto/update-hero.dto';
import { CreateTileDto } from './dto/create-tile.dto';
import { UpdateTileDto } from './dto/update-tile.dto';
import { UpdateSocialConfigDto } from './dto/update-social-config.dto';
import { CreateSocialImageDto } from './dto/create-social-image.dto';
import { UpdateSocialImageDto } from './dto/update-social-image.dto';

type ReqWithAuth = { user?: unknown; headers?: Record<string, unknown>; ip?: string };

@Controller('admin/homepage')
@Roles(user_role.admin, user_role.manager)
export class HomepageAdminController {
  constructor(private readonly homepageService: HomepageService) {}

  // ── Hero ──────────────────────────────────────────────────────────────────

  @Get('hero')
  getHero() {
    return this.homepageService.getHeroForAdmin();
  }

  @Put('hero')
  upsertHero(@Body() dto: UpdateHeroDto, @Req() req: ReqWithAuth) {
    return this.homepageService.upsertHero(dto, buildAuditContext(req));
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
    files: { desktopImage?: Express.Multer.File[]; mobileImage?: Express.Multer.File[] } | undefined,
    @Req() req: ReqWithAuth,
  ) {
    return this.homepageService.uploadHeroImages(files ?? {}, buildAuditContext(req));
  }

  // ── Tiles ─────────────────────────────────────────────────────────────────

  @Get('tiles')
  getTiles(@Query('section') section?: string) {
    return this.homepageService.getTilesForAdmin(section);
  }

  @Post('tiles')
  createTile(@Body() dto: CreateTileDto, @Req() req: ReqWithAuth) {
    return this.homepageService.createTile(dto, buildAuditContext(req));
  }

  @Patch('tiles/:id')
  updateTile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTileDto,
    @Req() req: ReqWithAuth,
  ) {
    return this.homepageService.updateTile(id, dto, buildAuditContext(req));
  }

  @Delete('tiles/:id')
  removeTile(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: ReqWithAuth) {
    return this.homepageService.removeTile(id, buildAuditContext(req));
  }

  @Post('tiles/:id/image')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
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
  uploadTileImages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFiles()
    files: { image?: Express.Multer.File[]; mobileImage?: Express.Multer.File[] } | undefined,
    @Req() req: ReqWithAuth,
  ) {
    return this.homepageService.uploadTileImages(id, files, buildAuditContext(req));
  }

  // ── Social ────────────────────────────────────────────────────────────────

  @Get('social')
  getSocial() {
    return this.homepageService.getSocialForAdmin();
  }

  @Patch('social/config')
  upsertSocialConfig(@Body() dto: UpdateSocialConfigDto, @Req() req: ReqWithAuth) {
    return this.homepageService.upsertSocialConfig(dto, buildAuditContext(req));
  }

  @Post('social/images')
  createSocialImage(@Body() dto: CreateSocialImageDto, @Req() req: ReqWithAuth) {
    return this.homepageService.createSocialImage(dto, buildAuditContext(req));
  }

  @Patch('social/images/:id')
  updateSocialImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSocialImageDto,
    @Req() req: ReqWithAuth,
  ) {
    return this.homepageService.updateSocialImage(id, dto, buildAuditContext(req));
  }

  @Delete('social/images/:id')
  removeSocialImage(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: ReqWithAuth) {
    return this.homepageService.removeSocialImage(id, buildAuditContext(req));
  }

  @Post('social/images/:id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadSocialImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: ReqWithAuth,
  ) {
    return this.homepageService.uploadSocialImage(id, file, buildAuditContext(req));
  }
}
