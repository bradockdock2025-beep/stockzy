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
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { buildAuditContext } from '../../common/audit/audit-context';
import { SellerSubmissionsService } from './seller-submissions.service';
import { QuerySellerSubmissionDto } from './dto/query-seller-submission.dto';
import { UpdateSellerSubmissionDto } from './dto/update-seller-submission.dto';
import { ApproveSellerSubmissionDto } from './dto/approve-seller-submission.dto';
import { RejectSellerSubmissionDto } from './dto/reject-seller-submission.dto';
import { ReorderSellerSubmissionImagesDto } from './dto/reorder-seller-submission-images.dto';

type ReqWithAuth = { user?: unknown; headers?: Record<string, unknown>; ip?: string };

@Controller('admin/seller-submissions')
@Roles(user_role.admin, user_role.manager)
export class SellerSubmissionsAdminController {
  constructor(private readonly sellerSubmissionsService: SellerSubmissionsService) {}

  @Get()
  findAll(@Query() query: QuerySellerSubmissionDto) {
    return this.sellerSubmissionsService.findAllForAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.sellerSubmissionsService.findOneForAdmin(id);
  }

  /**
   * Edição completa — item e dados do vendedor — enquanto a submissão ainda não foi
   * decidida. O admin tem acesso total pra corrigir o que o vendedor colocou errado.
   */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSellerSubmissionDto,
    @Req() req: ReqWithAuth,
  ) {
    return this.sellerSubmissionsService.updateForAdmin(id, dto, buildAuditContext(req));
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
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  addImages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: ReqWithAuth,
  ) {
    return this.sellerSubmissionsService.addImages(id, files, buildAuditContext(req));
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @Req() req: ReqWithAuth,
  ) {
    return this.sellerSubmissionsService.removeImage(id, imageId, buildAuditContext(req));
  }

  @Patch(':id/images/reorder')
  reorderImages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReorderSellerSubmissionImagesDto,
    @Req() req: ReqWithAuth,
  ) {
    return this.sellerSubmissionsService.reorderImages(id, dto.images, buildAuditContext(req));
  }

  @Patch(':id/start-review')
  startReview(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: ReqWithAuth) {
    return this.sellerSubmissionsService.startReview(id, buildAuditContext(req));
  }

  @Patch(':id/approve')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveSellerSubmissionDto,
    @Req() req: ReqWithAuth,
  ) {
    return this.sellerSubmissionsService.approve(id, dto, buildAuditContext(req));
  }

  @Patch(':id/reject')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectSellerSubmissionDto,
    @Req() req: ReqWithAuth,
  ) {
    return this.sellerSubmissionsService.reject(id, dto, buildAuditContext(req));
  }

  @Patch(':id/publish')
  publish(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: ReqWithAuth) {
    return this.sellerSubmissionsService.publish(id, buildAuditContext(req));
  }
}
