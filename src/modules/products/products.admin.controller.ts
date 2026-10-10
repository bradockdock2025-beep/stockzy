import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdatePresaleSettingsDto } from './dto/update-presale-settings.dto';
import { UpdateOfferSettingsDto } from './dto/update-offer-settings.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { ReorderProductsDto } from './dto/reorder-products.dto';
import { ReorderProductImagesDto } from './dto/reorder-product-images.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { user_role } from '@prisma/client';
import { buildAuditContext } from '../../common/audit/audit-context';

@Controller('admin/products')
@Roles(user_role.admin)
export class ProductsAdminController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * PENDENCIAS-BACKEND-GESTAO.md #2.5 — gestor lê, escrita continua só admin (herdado do
   * `@Roles(admin)` da classe).
   */
  @Get()
  @Roles(user_role.admin, user_role.manager)
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query, { allowAllStatuses: true });
  }

  @Get(':id')
  @Roles(user_role.admin, user_role.manager)
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: QueryProductDto,
  ) {
    return this.productsService.findOne(id, query, { allowAllStatuses: true });
  }

  @Post()
  create(
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(dto, buildAuditContext(req));
  }

  @Post(':id/images')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  uploadImages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('variantId') variantId?: string,
    @Req() req?: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.productsService.addImages(id, files, variantId, buildAuditContext(req));
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderProductsDto) {
    return this.productsService.reorder(dto.products);
  }

  @Patch(':id/images/reorder')
  reorderImages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReorderProductImagesDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.productsService.reorderImages(id, dto.images, buildAuditContext(req));
  }

  @Delete('images/:imageId')
  deleteImage(
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.productsService.deleteImage(imageId, buildAuditContext(req));
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.productsService.update(id, dto, buildAuditContext(req));
  }

  @Patch(':id/archive')
  archive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.productsService.remove(id, buildAuditContext(req));
  }

  @Patch('variants/:id/deactivate')
  deactivateVariant(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.productsService.deactivateVariant(id, buildAuditContext(req));
  }

  @Patch('variants/:id/presale')
  updatePresaleSettings(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePresaleSettingsDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.productsService.updatePresaleSettings(id, dto, buildAuditContext(req));
  }

  @Patch('variants/:id/offer')
  updateOfferSettings(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOfferSettingsDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.productsService.updateOfferSettings(id, dto, buildAuditContext(req));
  }

  @Get(':id/price-history')
  @Roles(user_role.admin, user_role.manager)
  priceHistory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.productsService.getPriceHistory(id);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.productsService.remove(id, buildAuditContext(req));
  }
}
