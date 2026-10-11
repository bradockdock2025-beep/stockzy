import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Public } from '../../common/decorators/public.decorator';
import { SellerSubmissionsService } from './seller-submissions.service';
import { CreateSellerSubmissionDto } from './dto/create-seller-submission.dto';

/** Portal de venda — sem autenticação, mesmo padrão de guest checkout/oferta. */
@Public()
@Controller('seller/submissions')
export class SellerSubmissionsController {
  constructor(private readonly sellerSubmissionsService: SellerSubmissionsService) {}

  @Post()
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
  create(
    @Body() dto: CreateSellerSubmissionDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.sellerSubmissionsService.create(dto, files);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('token') token: string,
  ) {
    return this.sellerSubmissionsService.findForGuest(id, token);
  }
}
