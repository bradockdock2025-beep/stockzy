import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { Prisma, seller_submission_status } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditContext } from '../../common/audit/audit-context';
import { applyAuditContext } from '../../common/audit/audit-context.db';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { extractStoragePath } from '../../common/storage/storage-path.util';
import { CreateSellerSubmissionDto } from './dto/create-seller-submission.dto';
import { UpdateSellerSubmissionDto } from './dto/update-seller-submission.dto';
import { QuerySellerSubmissionDto } from './dto/query-seller-submission.dto';
import { ApproveSellerSubmissionDto } from './dto/approve-seller-submission.dto';
import { RejectSellerSubmissionDto } from './dto/reject-seller-submission.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Mesmo retrato usado nas outras listagens/detalhe — nunca devolve o `guestToken` em si (só serve pra validar). */
const submissionSelect = {
  id: true,
  sellerName: true,
  sellerEmail: true,
  sellerPhone: true,
  categoryId: true,
  brand: true,
  modelName: true,
  size: true,
  condition: true,
  originalBox: true,
  quantity: true,
  askingPrice: true,
  additionalDetails: true,
  spreadsheetLink: true,
  status: true,
  rejectionReason: true,
  respondedAt: true,
  respondedBy: true,
  publishedAt: true,
  publishedBy: true,
  termsAcceptedAt: true,
  productId: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' as const } },
} satisfies Prisma.SellerSubmissionSelect;

@Injectable()
export class SellerSubmissionsService {
  private readonly logger = new Logger(SellerSubmissionsService.name);
  private supabaseClient: SupabaseClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLog: AuditLogService,
  ) {}

  private getSupabaseClient(): SupabaseClient {
    if (this.supabaseClient) {
      return this.supabaseClient;
    }
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new InternalServerErrorException(
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
    this.supabaseClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    return this.supabaseClient;
  }

  private getStorageSettings() {
    const bucket = this.configService.get<string>('SUPABASE_BUCKET') ?? 'product-images';
    const publicSetting = this.configService.get<string>('SUPABASE_STORAGE_PUBLIC');
    const isPublic = publicSetting ? publicSetting.toLowerCase() === 'true' : true;
    const ttlSetting = this.configService.get<string>('SUPABASE_SIGNED_URL_TTL');
    const parsedTtl = ttlSetting ? Number(ttlSetting) : 60 * 60 * 24 * 7;
    const signedTtl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 60 * 60 * 24;
    return { bucket, isPublic, signedTtl };
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ─── Portal de venda (público) ──────────────────────────────────────────

  async create(dto: CreateSellerSubmissionDto, files: Express.Multer.File[]) {
    if (dto.termsAccepted !== true) {
      throw new BadRequestException(
        'You must confirm you are the legitimate owner of this item and that the description is accurate.',
      );
    }
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one picture is required');
    }
    if (files.length > 10) {
      throw new BadRequestException('A maximum of 10 pictures is allowed');
    }

    for (const file of files) {
      const detected = await fileTypeFromBuffer(file.buffer);
      if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
        throw new BadRequestException(
          `Invalid file: ${file.originalname}. Only JPEG, PNG, WebP and GIF are allowed.`,
        );
      }
    }

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, isActive: true },
    });
    if (!category || !category.isActive) {
      throw new BadRequestException('Category not found');
    }

    const id = randomUUID();
    const guestToken = randomUUID();
    const supabase = this.getSupabaseClient();
    const { bucket, isPublic, signedTtl } = this.getStorageSettings();

    const imageData = await Promise.all(
      files.map(async (file, index) => {
        const ext = extname(file.originalname).toLowerCase();
        const path = `seller-submissions/${id}/${randomUUID()}${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
        if (uploadError) {
          throw new BadRequestException(`Upload failed: ${uploadError.message}`);
        }

        let url: string;
        if (isPublic) {
          url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        } else {
          const { data: signed, error: signedError } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, signedTtl);
          if (signedError || !signed?.signedUrl) {
            throw new BadRequestException(
              `Failed to generate signed URL: ${signedError?.message ?? 'unknown error'}`,
            );
          }
          url = signed.signedUrl;
        }

        return { url, position: index };
      }),
    );

    await this.prisma.sellerSubmission.create({
      data: {
        id,
        guestToken,
        sellerName: dto.sellerName,
        sellerEmail: dto.sellerEmail,
        sellerPhone: dto.sellerPhone,
        categoryId: dto.categoryId,
        brand: dto.brand,
        modelName: dto.modelName,
        size: dto.size,
        condition: dto.condition,
        originalBox: dto.originalBox ?? null,
        quantity: dto.quantity ?? 1,
        askingPrice: dto.askingPrice,
        additionalDetails: dto.additionalDetails ?? null,
        spreadsheetLink: dto.spreadsheetLink ?? null,
        termsAcceptedAt: new Date(),
        images: { createMany: { data: imageData } },
      },
    });

    void this.notificationsService.dispatchSellerSubmissionReceived(id);
    void this.notificationsService.dispatchSellerSubmissionInternal(id);
    void this.notificationsService.dispatchSellerSubmissionTermsAccepted(id);
    void this.notificationsService.dispatchSellerSubmissionTermsAcceptedInternal(id);

    return { id, guestToken };
  }

  async findForGuest(id: string, token: string) {
    if (!token) {
      throw new NotFoundException('Submission not found');
    }
    const submission = await this.prisma.sellerSubmission.findFirst({
      where: { id, guestToken: token },
      select: submissionSelect,
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    return submission;
  }

  // ─── Gestão (admin) ─────────────────────────────────────────────────────

  async findAllForAdmin(query: QuerySellerSubmissionDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const where: Prisma.SellerSubmissionWhereInput = query.status ? { status: query.status } : {};

    const [data, total] = await Promise.all([
      this.prisma.sellerSubmission.findMany({
        where,
        select: submissionSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sellerSubmission.count({ where }),
    ]);

    return {
      data,
      meta: { mode: 'offset' as const, total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Histórico mínimo, sem exigir conta de vendedor: outras submissões com o mesmo
   * e-mail ou telefone. Não é um "perfil" (não pega variações de contacto), mas já
   * resolve o caso mais comum — a equipa reconhecer um vendedor recorrente, ou um
   * contacto já rejeitado antes, no momento da revisão.
   */
  private async findRelatedSubmissions(id: string, sellerEmail: string, sellerPhone: string) {
    return this.prisma.sellerSubmission.findMany({
      where: {
        id: { not: id },
        OR: [{ sellerEmail }, { sellerPhone }],
      },
      select: {
        id: true,
        brand: true,
        modelName: true,
        status: true,
        rejectionReason: true,
        productId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForAdmin(id: string) {
    const submission = await this.prisma.sellerSubmission.findUnique({
      where: { id },
      select: submissionSelect,
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const relatedSubmissions = await this.findRelatedSubmissions(
      id,
      submission.sellerEmail,
      submission.sellerPhone,
    );

    return { ...submission, relatedSubmissions };
  }

  /**
   * O admin pode corrigir qualquer campo — inclusive os dados do vendedor (nome/e-mail/
   * telefone), que podem ter vindo errados no formulário. Permitido em `pending_review`,
   * `under_review` e `approved` — aprovar não cria o produto, então ainda há espaço pra
   * ajustar preço/fotos/categoria antes de publicar. Trava só depois de `published`
   * (já é um produto normal, edita-se por lá) ou `rejected` (definitivo).
   */
  private async assertEditable(id: string) {
    const submission = await this.prisma.sellerSubmission.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (
      submission.status === seller_submission_status.published ||
      submission.status === seller_submission_status.rejected
    ) {
      throw new BadRequestException({
        code: 'SUBMISSION_LOCKED',
        message: `Submission is already ${submission.status}; it can no longer be edited here.`,
      });
    }
  }

  async updateForAdmin(id: string, dto: UpdateSellerSubmissionDto, context?: AuditContext) {
    await this.assertEditable(id);
    const before = await this.prisma.sellerSubmission.findUnique({ where: { id } });

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { id: true, isActive: true },
      });
      if (!category || !category.isActive) {
        throw new BadRequestException('Category not found');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      return tx.sellerSubmission.update({
        where: { id },
        data: {
          ...(dto.sellerName !== undefined ? { sellerName: dto.sellerName } : {}),
          ...(dto.sellerEmail !== undefined ? { sellerEmail: dto.sellerEmail } : {}),
          ...(dto.sellerPhone !== undefined ? { sellerPhone: dto.sellerPhone } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
          ...(dto.modelName !== undefined ? { modelName: dto.modelName } : {}),
          ...(dto.size !== undefined ? { size: dto.size } : {}),
          ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
          ...(dto.originalBox !== undefined ? { originalBox: dto.originalBox } : {}),
          ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
          ...(dto.askingPrice !== undefined ? { askingPrice: dto.askingPrice } : {}),
          ...(dto.additionalDetails !== undefined ? { additionalDetails: dto.additionalDetails } : {}),
          ...(dto.spreadsheetLink !== undefined ? { spreadsheetLink: dto.spreadsheetLink } : {}),
        },
        select: submissionSelect,
      });
    });

    await this.auditLog.log({
      action: 'update',
      entity: 'seller_submission',
      entityId: id,
      before,
      after: updated,
      context,
    });

    return updated;
  }

  async addImages(id: string, files: Express.Multer.File[], context?: AuditContext) {
    await this.assertEditable(id);
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const existingCount = await this.prisma.sellerSubmissionImage.count({ where: { submissionId: id } });
    if (existingCount + files.length > 10) {
      throw new BadRequestException('A maximum of 10 pictures is allowed per submission');
    }

    for (const file of files) {
      const detected = await fileTypeFromBuffer(file.buffer);
      if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
        throw new BadRequestException(
          `Invalid file: ${file.originalname}. Only JPEG, PNG, WebP and GIF are allowed.`,
        );
      }
    }

    const positionBase =
      (
        await this.prisma.sellerSubmissionImage.aggregate({
          where: { submissionId: id },
          _max: { position: true },
        })
      )._max.position ?? -1;

    const supabase = this.getSupabaseClient();
    const { bucket, isPublic, signedTtl } = this.getStorageSettings();

    const imageData = await Promise.all(
      files.map(async (file, index) => {
        const ext = extname(file.originalname).toLowerCase();
        const path = `seller-submissions/${id}/${randomUUID()}${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
        if (uploadError) {
          throw new BadRequestException(`Upload failed: ${uploadError.message}`);
        }

        let url: string;
        if (isPublic) {
          url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        } else {
          const { data: signed, error: signedError } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, signedTtl);
          if (signedError || !signed?.signedUrl) {
            throw new BadRequestException(
              `Failed to generate signed URL: ${signedError?.message ?? 'unknown error'}`,
            );
          }
          url = signed.signedUrl;
        }

        return { submissionId: id, url, position: positionBase + index + 1 };
      }),
    );

    await this.prisma.sellerSubmissionImage.createMany({ data: imageData });

    await this.auditLog.log({
      action: 'update',
      entity: 'seller_submission_image',
      entityId: id,
      after: { added: imageData.length },
      context,
    });

    return this.findOneForAdmin(id);
  }

  async removeImage(id: string, imageId: string, context?: AuditContext) {
    await this.assertEditable(id);
    const image = await this.prisma.sellerSubmissionImage.findUnique({ where: { id: imageId } });
    if (!image || image.submissionId !== id) {
      throw new NotFoundException('Image not found');
    }

    await this.prisma.sellerSubmissionImage.delete({ where: { id: imageId } });

    try {
      const { bucket } = this.getStorageSettings();
      const path = extractStoragePath(image.url, bucket);
      if (path) {
        await this.getSupabaseClient().storage.from(bucket).remove([path]).catch(() => undefined);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to remove seller submission image ${imageId} from storage: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    await this.auditLog.log({
      action: 'delete',
      entity: 'seller_submission_image',
      entityId: imageId,
      before: image,
      after: null,
      context,
    });

    return this.findOneForAdmin(id);
  }

  async reorderImages(id: string, items: { id: string; position: number }[], context?: AuditContext) {
    await this.assertEditable(id);

    const ids = items.map((item) => item.id);
    const existing = await this.prisma.sellerSubmissionImage.findMany({ where: { id: { in: ids } } });
    if (existing.length !== ids.length || existing.some((image) => image.submissionId !== id)) {
      throw new BadRequestException('All images must belong to the submission');
    }

    await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      for (const item of items) {
        await tx.sellerSubmissionImage.update({ where: { id: item.id }, data: { position: item.position } });
      }
    });

    return this.findOneForAdmin(id);
  }

  /** `name` igual (sem diferenciar maiúsculas) já existente é reaproveitado; senão cria uma marca nova. */
  private async findOrCreateBrand(tx: Prisma.TransactionClient, name: string): Promise<string> {
    const trimmed = name.trim();
    const existing = await tx.brand.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const baseSlug = this.slugify(trimmed) || 'brand';
    let slug = baseSlug;
    let attempt = 0;
    while (await tx.brand.findUnique({ where: { slug }, select: { id: true } })) {
      attempt += 1;
      slug = `${baseSlug}-${attempt}`;
    }

    const created = await tx.brand.create({ data: { name: trimmed, slug, isActive: true } });
    return created.id;
  }

  /**
   * ANALISE-CONDICAO-PRODUTO-2026-10-11.md — facet `condition` já é criado pela
   * migration (New/Like New/Used – Good/Used – Fair), mas busca por `value` em vez de
   * assumir que existe: se o facet ainda não tiver sido criado num ambiente (ex. testes
   * locais sem a migration), cria na hora — mesmo espírito defensivo do
   * `findOrCreateBrand`.
   */
  private async findOrCreateConditionFacetValue(
    tx: Prisma.TransactionClient,
    condition: string,
  ): Promise<string> {
    const labels: Record<string, string> = {
      new: 'New',
      like_new: 'Like New',
      used_good: 'Used – Good',
      used_fair: 'Used – Fair',
    };

    let facet = await tx.facet.findUnique({ where: { key: 'condition' }, select: { id: true } });
    if (!facet) {
      facet = await tx.facet.create({
        data: { key: 'condition', name: 'Condition', inputType: 'chip', scope: 'product', visibility: 'always' },
        select: { id: true },
      });
    }

    const existing = await tx.facetValue.findUnique({
      where: { facetId_value: { facetId: facet.id, value: condition } },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const created = await tx.facetValue.create({
      data: { facetId: facet.id, value: condition, label: labels[condition] ?? condition },
      select: { id: true },
    });
    return created.id;
  }

  /** Estados em que a submissão ainda não teve uma decisão final (aprovar/rejeitar). */
  private static readonly OPEN_STATUSES: seller_submission_status[] = [
    seller_submission_status.pending_review,
    seller_submission_status.under_review,
  ];

  /**
   * Marca que alguém começou a rever — sinal pra equipe não duplicar trabalho em filas
   * partilhadas. Puramente informativo: aprovar/rejeitar continuam a funcionar mesmo que
   * ninguém tenha passado por aqui.
   */
  async startReview(id: string, context?: AuditContext) {
    const submission = await this.prisma.sellerSubmission.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (submission.status !== seller_submission_status.pending_review) {
      throw new BadRequestException({
        code: 'SUBMISSION_NOT_PENDING_REVIEW',
        message: `Submission is already ${submission.status}.`,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      return tx.sellerSubmission.update({
        where: { id },
        data: { status: seller_submission_status.under_review },
        select: submissionSelect,
      });
    });

    await this.auditLog.log({
      action: 'start_review',
      entity: 'seller_submission',
      entityId: id,
      before: { status: submission.status },
      after: { status: updated.status },
      context,
    });

    return updated;
  }

  /**
   * Decisão de aceitar o item — NÃO cria o produto nem publica na loja. Isso é um passo
   * separado (`publish`), porque aprovar não significa que já deve ficar visível de
   * imediato (ex.: a equipe ainda quer confirmar que recebeu o item fisicamente, trocar
   * fotos, ou simplesmente agrupar publicações).
   */
  async approve(id: string, dto: ApproveSellerSubmissionDto, context?: AuditContext) {
    const submission = await this.prisma.sellerSubmission.findUnique({ where: { id } });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (!SellerSubmissionsService.OPEN_STATUSES.includes(submission.status)) {
      throw new BadRequestException({
        code: 'SUBMISSION_NOT_OPEN',
        message: `Submission is already ${submission.status}.`,
      });
    }

    const categoryId = dto.categoryId ?? submission.categoryId;
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    });
    if (!category || !category.isActive) {
      throw new BadRequestException('Category not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      return tx.sellerSubmission.update({
        where: { id },
        data: {
          status: seller_submission_status.approved,
          categoryId,
          respondedAt: new Date(),
          respondedBy: context?.actorId ?? null,
        },
        select: submissionSelect,
      });
    });

    await this.auditLog.log({
      action: 'approve',
      entity: 'seller_submission',
      entityId: id,
      before: { status: submission.status },
      after: { status: updated.status, categoryId: updated.categoryId },
      context,
    });

    void this.notificationsService.dispatchSellerSubmissionDecision('seller_submission.approved', id);
    void this.notificationsService.dispatchSellerSubmissionDecisionInternal(
      'seller_submission.approved',
      id,
      context?.actorEmail,
    );

    return updated;
  }

  async reject(id: string, dto: RejectSellerSubmissionDto, context?: AuditContext) {
    const submission = await this.prisma.sellerSubmission.findUnique({ where: { id } });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (
      submission.status === seller_submission_status.published ||
      submission.status === seller_submission_status.rejected
    ) {
      throw new BadRequestException({
        code: 'SUBMISSION_LOCKED',
        message: `Submission is already ${submission.status}.`,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      return tx.sellerSubmission.update({
        where: { id },
        data: {
          status: seller_submission_status.rejected,
          rejectionReason: dto.rejectionReason,
          respondedAt: new Date(),
          respondedBy: context?.actorId ?? null,
        },
        select: submissionSelect,
      });
    });

    await this.auditLog.log({
      action: 'reject',
      entity: 'seller_submission',
      entityId: id,
      before: { status: submission.status },
      after: { status: updated.status, rejectionReason: updated.rejectionReason },
      context,
    });

    void this.notificationsService.dispatchSellerSubmissionDecision('seller_submission.rejected', id);
    void this.notificationsService.dispatchSellerSubmissionDecisionInternal(
      'seller_submission.rejected',
      id,
      context?.actorEmail,
    );

    return updated;
  }

  /**
   * Última ação: cria o `Product`/`ProductVariant`/`Inventory`/`ProductImage` de verdade e
   * deixa o item visível na loja. Só a partir de `approved` — publicar é uma escolha
   * explícita, não uma consequência automática de aprovar.
   */
  async publish(id: string, context?: AuditContext) {
    const submission = await this.prisma.sellerSubmission.findUnique({
      where: { id },
      include: { images: { orderBy: { position: 'asc' } } },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (submission.status !== seller_submission_status.approved) {
      throw new BadRequestException({
        code: 'SUBMISSION_NOT_APPROVED',
        message: `Submission must be approved before it can be published; it is currently ${submission.status}.`,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);

      const brandId = await this.findOrCreateBrand(tx, submission.brand);

      const baseSlug =
        this.slugify(`${submission.brand} ${submission.modelName} ${submission.size}`) || 'seller-item';
      let slug = baseSlug;
      let attempt = 0;
      while (await tx.product.findUnique({ where: { slug }, select: { id: true } })) {
        attempt += 1;
        slug = `${baseSlug}-${attempt}`;
      }

      const product = await tx.product.create({
        data: {
          categoryId: submission.categoryId,
          brandId,
          name: `${submission.brand} ${submission.modelName}`.trim(),
          slug,
          description: submission.additionalDetails,
          status: 'active',
        },
      });

      const variant = await tx.productVariant.create({
        data: {
          productId: product.id,
          sku: `SELLER-${submission.id}`,
          title: submission.size,
          price: submission.askingPrice,
        },
      });

      await tx.inventory.create({
        data: { variantId: variant.id, stockQuantity: submission.quantity, reservedQuantity: 0 },
      });

      if (submission.images.length) {
        await tx.productImage.createMany({
          data: submission.images.map((image) => ({
            productId: product.id,
            url: image.url,
            position: image.position,
          })),
        });
      }

      const conditionFacetValueId = await this.findOrCreateConditionFacetValue(tx, submission.condition);
      await tx.productFacetValue.create({
        data: { productId: product.id, facetValueId: conditionFacetValueId },
      });

      return tx.sellerSubmission.update({
        where: { id },
        data: {
          status: seller_submission_status.published,
          productId: product.id,
          publishedAt: new Date(),
          publishedBy: context?.actorId ?? null,
        },
        select: submissionSelect,
      });
    });

    await this.auditLog.log({
      action: 'publish',
      entity: 'seller_submission',
      entityId: id,
      before: { status: submission.status },
      after: { status: updated.status, productId: updated.productId },
      context,
    });

    void this.notificationsService.dispatchSellerSubmissionPublished(id);
    void this.notificationsService.dispatchSellerSubmissionPublishedInternal(id, context?.actorEmail);

    return updated;
  }
}
