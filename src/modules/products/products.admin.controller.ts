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
import { QueryProductDto } from './dto/query-product.dto';
import { ReorderProductsDto } from './dto/reorder-products.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { user_role } from '@prisma/client';
import { buildAuditContext } from '../../common/audit/audit-context';

@Controller('admin/products')
@Roles(user_role.admin)
export class ProductsAdminController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: QueryProductDto,
  ) {
    return this.productsService.findOne(id, query);
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

  @Patch('variants/:id/presale')
  updatePresaleSettings(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePresaleSettingsDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.productsService.updatePresaleSettings(id, dto, buildAuditContext(req));
  }

  @Get(':id/price-history')
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
