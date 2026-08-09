import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { AuditContextStore } from '../../common/audit/audit-context.store';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateCustomerAdminDto } from './dto/update-customer-admin.dto';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto';
import { RequestPhoneVerificationDto } from './dto/request-phone-verification.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { MfaPreferenceDto } from './dto/mfa-preference.dto';
import { CustomerConsentDto } from './dto/customer-consent.dto';
import { RequestEmailOtpDto } from './dto/request-email-otp.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { VerifyEmailLinkDto } from './dto/verify-email-link.dto';
import { ChangeCustomerPasswordDto } from './dto/change-customer-password.dto';
import { ChangeCustomerEmailDto } from './dto/change-customer-email.dto';

type SupabaseMetadata = Record<string, unknown>;
type AuthWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
  user?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
};

@Injectable()
export class CustomersService {
  private readonly RESET_TTL = 1800; // 30 min
  private readonly OTP_COOLDOWN_TTL = 60; // seconds between OTP resends

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAuth: SupabaseAuthService,
    private readonly redis: RedisService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async register(dto: RegisterCustomerDto) {
    const email = dto.email.trim().toLowerCase();
    const admin = this.supabaseAuth.getAdminClient();

    const existingCustomer = await this.prisma.customer.findUnique({
      where: { email },
      select: { id: true, isActive: true, authUserId: true },
    });

    if (existingCustomer?.isActive) {
      this.badRequest('AUTH_CREATE_FAILED', 'A user with this email address has already been registered');
    }

    if (existingCustomer && !existingCustomer.isActive && existingCustomer.authUserId) {
      await admin.auth.admin.updateUserById(existingCustomer.authUserId, {
        password: dto.password,
        email_confirm: false,
      });

      await this.prisma.customer.update({
        where: { id: existingCustomer.id },
        data: {
          phoneNumber: dto.phoneNumber ?? undefined,
          emailVerifiedAt: null,
          isActive: true,
        },
      });

      const anon = this.supabaseAuth.getAnonClient();
      await anon.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      return { requiresEmailVerification: true, email };
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: dto.password,
      email_confirm: false,
    });

    if (error || !data.user) {
      this.badRequest('AUTH_CREATE_FAILED', error?.message ?? 'Failed to create auth user');
    }

    const authUserId = data.user.id;

    await this.prisma.$transaction(async (tx) => {
      const existingByEmail = await tx.customer.findUnique({ where: { email } });

      if (existingByEmail) {
        if (existingByEmail.authUserId && existingByEmail.authUserId !== authUserId) {
          this.badRequest('AUTH_ALREADY_LINKED', 'Customer already linked to another auth user');
        }

        return tx.customer.update({
          where: { id: existingByEmail.id },
          data: {
            authUserId,
            phoneNumber: dto.phoneNumber,
            emailVerifiedAt: null,
            isActive: true,
          },
        });
      }

      return tx.customer.create({
        data: {
          authUserId,
          email,
          phoneNumber: dto.phoneNumber,
          emailVerifiedAt: null,
          isActive: true,
        },
      });
    });

    // Enviar código OTP de verificação por email após criar a conta
    const anon = this.supabaseAuth.getAnonClient();
    await anon.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    return {
      requiresEmailVerification: true,
      email,
    };
  }

  async login(dto: LoginCustomerDto) {
    const email = dto.email.trim().toLowerCase();
    const anon = this.supabaseAuth.getAnonClient();

    const { data, error } = await anon.auth.signInWithPassword({
      email,
      password: dto.password,
    });

    if (error || !data.session || !data.user) {
      if (
        error &&
        (error.message?.toLowerCase().includes('email not confirmed') ||
          (error as unknown as Record<string, unknown>).code === 'email_not_confirmed')
      ) {
        throw new UnauthorizedException({
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Por favor verifica o teu email antes de fazer login.',
        });
      }

      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    await this.syncVerificationFromAuthUser(data.user.id, data.user);

    const customer = await this.getProfile(data.user.id);

    if (!customer.isActive) {
      await this.supabaseAuth.getAdminClient().auth.admin.signOut(data.user.id, 'global');
      throw new UnauthorizedException({ code: 'ACCOUNT_DELETED', message: 'This account has been deactivated.' });
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      tokenType: data.session.token_type,
      expiresIn: data.session.expires_in,
      customer,
    };
  }

  async requestEmailOtp(dto: RequestEmailOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const customer = await this.prisma.customer.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    if (!customer) {
      this.badRequest('CUSTOMER_NOT_FOUND', 'Customer not found');
    }

    if (!customer.isActive) {
      this.badRequest('CUSTOMER_INACTIVE', 'Customer is inactive');
    }

    const redisClient = this.redis.getClient();
    if (redisClient) {
      const cooldownKey = `otp:cooldown:${email}`;
      const existing = await redisClient.get(cooldownKey);
      if (existing) {
        const ttl = await redisClient.ttl(cooldownKey);
        throw new HttpException(
          { code: 'OTP_COOLDOWN', message: `Please wait ${ttl}s before requesting a new code.` },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      await redisClient.set(cooldownKey, '1', { EX: this.OTP_COOLDOWN_TTL });
    }

    const anon = this.supabaseAuth.getAnonClient();
    const { error } = await anon.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: dto.redirectTo,
      },
    });

    if (error) {
      if (redisClient) {
        await redisClient.del(`otp:cooldown:${email}`);
      }
      this.badRequest('OTP_SEND_FAILED', error.message);
    }

    return { success: true };
  }

  async verifyEmailOtp(dto: VerifyEmailOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const anon = this.supabaseAuth.getAnonClient();

    const { data, error } = await anon.auth.verifyOtp({
      email,
      token: dto.token,
      type: 'email',
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException({
        code: 'OTP_INVALID',
        message: 'Invalid or expired token',
      });
    }

    const { firstEmailVerification, welcomeEmail } = await this.syncVerificationFromAuthUser(data.user.id, data.user);

    const customer = await this.getProfile(data.user.id);

    if (!customer.isActive) {
      await this.supabaseAuth.getAdminClient().auth.admin.signOut(data.user.id, 'global');
      throw new UnauthorizedException({ code: 'ACCOUNT_DELETED', message: 'This account has been deactivated.' });
    }

    if (firstEmailVerification && welcomeEmail) {
      void this.notificationsService.dispatchWelcome({
        to: welcomeEmail,
        locale: 'fr',
      });
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      tokenType: data.session.token_type,
      expiresIn: data.session.expires_in,
      customer,
    };
  }

  async verifyEmailLink(dto: VerifyEmailLinkDto) {
    const anon = this.supabaseAuth.getAnonClient();

    const { data, error } = await anon.auth.verifyOtp({
      token_hash: dto.tokenHash,
      type: dto.type,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException({
        code: 'OTP_INVALID',
        message: 'Invalid or expired token',
      });
    }

    const { firstEmailVerification, welcomeEmail } = await this.syncVerificationFromAuthUser(data.user.id, data.user);

    const customer = await this.getProfile(data.user.id);

    if (!customer.isActive) {
      await this.supabaseAuth.getAdminClient().auth.admin.signOut(data.user.id, 'global');
      throw new UnauthorizedException({ code: 'ACCOUNT_DELETED', message: 'This account has been deactivated.' });
    }

    if (firstEmailVerification && welcomeEmail) {
      void this.notificationsService.dispatchWelcome({
        to: welcomeEmail,
        locale: 'fr',
      });
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      tokenType: data.session.token_type,
      expiresIn: data.session.expires_in,
      customer,
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const anon = this.supabaseAuth.getAnonClient();
    const { data, error } = await anon.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const email = data.user.email;
    if (!email) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.syncVerificationFromAuthUser(data.user.id, data.user);

    const customer = await this.getProfile(data.user.id);

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      tokenType: data.session.token_type,
      expiresIn: data.session.expires_in,
      customer,
    };
  }

  private normalizeBearerToken(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      return '';
    }

    return trimmed.toLowerCase().startsWith('bearer ')
      ? trimmed.slice(7).trim()
      : trimmed;
  }

  async logout(accessToken: string) {
    const normalized = this.normalizeBearerToken(accessToken);
    if (!normalized) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const admin = this.supabaseAuth.getAdminClient();
    const { error } = await admin.auth.admin.signOut(normalized, 'global');

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { success: true };
  }

  async logoutWithRefreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const anon = this.supabaseAuth.getAnonClient();
    const { data, error } = await anon.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const admin = this.supabaseAuth.getAdminClient();
    const { error: signOutError } = await admin.auth.admin.signOut(
      data.session.access_token,
      'global',
    );

    if (signOutError) {
      throw new BadRequestException(signOutError.message);
    }

    return { success: true };
  }

  async getProfile(authUserId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      include: { addresses: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    return customer;
  }

  async updateProfile(authUserId: string, dto: UpdateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({
      where: { authUserId },
    });

    if (!existing) {
      throw new BadRequestException('Customer profile not found');
    }

    const phoneChanged =
      dto.phoneNumber !== undefined && dto.phoneNumber !== existing.phoneNumber;

    if (phoneChanged && dto.phoneNumber) {
      const admin = this.supabaseAuth.getAdminClient();
      const { error } = await admin.auth.admin.updateUserById(authUserId, {
        phone: dto.phoneNumber,
      });
      if (error) {
        throw new BadRequestException(error.message);
      }
    }

    return this.prisma.customer.update({
      where: { id: existing.id },
      data: {
        firstName: dto.firstName ?? undefined,
        lastName: dto.lastName ?? undefined,
        phoneNumber: dto.phoneNumber ?? undefined,
        phoneVerifiedAt: phoneChanged ? null : undefined,
      },
    });
  }

  async listAddresses(authUserId: string) {
    const customerId = await this.getCustomerId(authUserId);
    return this.prisma.address.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addAddress(authUserId: string, dto: CreateAddressDto) {
    const customerId = await this.getCustomerId(authUserId);
    return this.prisma.address.create({
      data: {
        customerId,
        type: dto.type,
        street: dto.street,
        city: dto.city,
        state: dto.state ?? null,
        zipcode: dto.zipcode ?? null,
        country: dto.country,
      },
    });
  }

  async updateAddress(authUserId: string, addressId: string, dto: UpdateAddressDto) {
    const customerId = await this.getCustomerId(authUserId);
    const existing = await this.prisma.address.findUnique({ where: { id: addressId } });

    if (!existing || existing.customerId !== customerId) {
      throw new BadRequestException('Address not found');
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data: {
        type: dto.type ?? undefined,
        street: dto.street ?? undefined,
        city: dto.city ?? undefined,
        state: dto.state ?? undefined,
        zipcode: dto.zipcode ?? undefined,
        country: dto.country ?? undefined,
      },
    });
  }

  async removeAddress(authUserId: string, addressId: string) {
    const customerId = await this.getCustomerId(authUserId);
    const existing = await this.prisma.address.findUnique({ where: { id: addressId } });

    if (!existing || existing.customerId !== customerId) {
      throw new BadRequestException('Address not found');
    }

    return this.prisma.address.delete({ where: { id: addressId } });
  }

  async requestEmailVerification(authUserId: string, dto: RequestEmailVerificationDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { id: true, email: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    const admin = this.supabaseAuth.getAdminClient();
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(authUserId);
    if (userError) {
      throw new BadRequestException(userError.message);
    }

    const userRecord = this.asRecord(userData.user);
    const emailVerifiedAt = this.parseDate(
      userRecord.email_confirmed_at ?? userRecord.confirmed_at,
    );

    if (emailVerifiedAt) {
      await this.prisma.customer.updateMany({
        where: { id: customer.id },
        data: { emailVerifiedAt },
      });

      return { verified: true, emailVerifiedAt };
    }

    const anon = this.supabaseAuth.getAnonClient();
    const { error } = await anon.auth.resend({
      type: 'signup',
      email: customer.email,
      options: dto.redirectTo ? { emailRedirectTo: dto.redirectTo } : undefined,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { success: true };
  }

  async requestPhoneVerification(authUserId: string, dto: RequestPhoneVerificationDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { id: true, phoneNumber: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    let phoneNumber = customer.phoneNumber;
    if (!phoneNumber) {
      const admin = this.supabaseAuth.getAdminClient();
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(authUserId);
      if (userError) {
        throw new BadRequestException(userError.message);
      }
      phoneNumber =
        typeof userData.user?.phone === 'string'
          ? userData.user.phone
          : null;
    }

    if (!phoneNumber) {
      throw new BadRequestException('Phone number not found');
    }

    const anon = this.supabaseAuth.getAnonClient();
    const { error } = await anon.auth.signInWithOtp({
      phone: phoneNumber,
      options: {
        shouldCreateUser: false,
        channel: dto.channel ?? 'sms',
      },
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { success: true };
  }

  async verifyPhone(authUserId: string, dto: VerifyPhoneDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { id: true, phoneNumber: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    const phoneNumber = customer.phoneNumber;
    if (!phoneNumber) {
      throw new BadRequestException('Phone number not found');
    }

    const anon = this.supabaseAuth.getAnonClient();
    const { data, error } = await anon.auth.verifyOtp({
      phone: phoneNumber,
      token: dto.token,
      type: 'sms',
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const userRecord = this.asRecord(data.user);
    const phoneVerifiedAt = this.parseDate(userRecord.phone_confirmed_at) ?? new Date();

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { phoneVerifiedAt },
    });

    return { verified: true, phoneVerifiedAt };
  }

  async updateMfaPreference(authUserId: string, dto: MfaPreferenceDto) {
    if (dto.enabled && !dto.method) {
      throw new BadRequestException('MFA method is required when enabled');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { id: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    return this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        mfaEnabled: dto.enabled,
        mfaMethod: dto.enabled ? dto.method ?? null : null,
      },
      select: { mfaEnabled: true, mfaMethod: true },
    });
  }

  async changePassword(authUserId: string, dto: ChangeCustomerPasswordDto) {
    const verification = await this.requestEmailVerification(authUserId, {});
    const isVerified = 'verified' in verification && verification.verified;
    if (!isVerified) {
      this.badRequest(
        'EMAIL_VERIFICATION_REQUIRED',
        'Enviamos um link de verificacao para o seu email. Confirme para continuar.',
        {
          action: 'RESEND_EMAIL_VERIFICATION',
          endpoint: '/customers/verify/email',
        },
      );
    }

    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { email: true },
    });

    if (!customer) {
      this.badRequest('CUSTOMER_NOT_FOUND', 'Customer profile not found');
    }

    const anon = this.supabaseAuth.getAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({
      email: customer.email,
      password: dto.currentPassword,
    });

    if (error || !data.session) {
      throw new UnauthorizedException({
        code: 'PASSWORD_INVALID',
        message: 'Senha atual inválida.',
      });
    }

    const admin = this.supabaseAuth.getAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
      password: dto.newPassword,
    });

    if (updateError) {
      this.badRequest('PASSWORD_UPDATE_FAILED', updateError.message);
    }

    return { success: true };
  }

  async changeEmail(authUserId: string, accessToken: string, dto: ChangeCustomerEmailDto) {
    await this.ensureEmailVerified(authUserId);

    if (!accessToken) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Faça login para continuar.',
      });
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.customer.findUnique({
      where: { email },
      select: { authUserId: true },
    });

    if (existing && existing.authUserId !== authUserId) {
      this.badRequest('EMAIL_IN_USE', 'Email already in use');
    }

    const { error } = await this.supabaseAuth.updateUserWithAccessToken(
      accessToken,
      { email },
      dto.redirectTo ? { emailRedirectTo: dto.redirectTo } : undefined,
    );

    if (error) {
      this.badRequest('EMAIL_UPDATE_FAILED', error);
    }

    return {
      success: true,
      email,
      verificationRequired: true,
    };
  }

  async recordConsent(authUserId: string, dto: CustomerConsentDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: {
        id: true,
        termsAcceptedAt: true,
        privacyAcceptedAt: true,
        marketingConsent: true,
        marketingConsentAt: true,
      },
    });

    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    const now = new Date();
    const consentUpdate: Prisma.CustomerUpdateInput = {};

    if (dto.type === 'terms') {
      consentUpdate.termsAcceptedAt = dto.granted ? now : null;
    }

    if (dto.type === 'privacy') {
      consentUpdate.privacyAcceptedAt = dto.granted ? now : null;
    }

    if (dto.type === 'marketing') {
      consentUpdate.marketingConsent = dto.granted;
      consentUpdate.marketingConsentAt = now;
    }

    const context = AuditContextStore.get();
    const ipAddress = context?.ip ?? null;
    const userAgent = context?.userAgent ?? null;

    return this.prisma.$transaction(async (tx) => {
      const consent = await tx.customerConsent.create({
        data: {
          customerId: customer.id,
          type: dto.type,
          version: dto.version ?? null,
          granted: dto.granted,
          source: dto.source ?? null,
          ipAddress,
          userAgent,
        },
      });

      const current = await tx.customer.update({
        where: { id: customer.id },
        data: consentUpdate,
        select: {
          termsAcceptedAt: true,
          privacyAcceptedAt: true,
          marketingConsent: true,
          marketingConsentAt: true,
        },
      });

      return { consent, current };
    });
  }

  async listConsents(authUserId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: {
        id: true,
        termsAcceptedAt: true,
        privacyAcceptedAt: true,
        marketingConsent: true,
        marketingConsentAt: true,
      },
    });

    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    const history = await this.prisma.customerConsent.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      current: {
        termsAcceptedAt: customer.termsAcceptedAt,
        privacyAcceptedAt: customer.privacyAcceptedAt,
        marketingConsent: customer.marketingConsent,
        marketingConsentAt: customer.marketingConsentAt,
      },
      history,
    };
  }

  async exportData(authUserId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: {
        id: true,
        authUserId: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        mfaEnabled: true,
        mfaMethod: true,
        termsAcceptedAt: true,
        privacyAcceptedAt: true,
        marketingConsent: true,
        marketingConsentAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        addresses: true,
        orders: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
        carts: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
        consents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    return {
      exportedAt: new Date().toISOString(),
      customer,
    };
  }

  async exportOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: this.getCustomerExportSelect(),
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      exportedAt: new Date().toISOString(),
      customer,
    };
  }

  async exportAll(query: QueryCustomerDto) {
    const where = this.buildCustomerWhere(query);
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const select = this.getCustomerExportSelect();

    if (query.cursor) {
      let data;
      try {
        data = await this.prisma.customer.findMany({
          where,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          cursor: { id: query.cursor },
          skip: 1,
          select,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          throw new BadRequestException('Invalid cursor');
        }
        throw error;
      }

      return {
        exportedAt: new Date().toISOString(),
        data,
        meta: {
          limit,
          nextCursor: data.length === limit ? data[data.length - 1]?.id : null,
        },
      };
    }

    const page = Number(query.page) || 1;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAll(query: QueryCustomerDto) {
    const where = this.buildCustomerWhere(query);

    if (query.cursor) {
      const limit = Number(query.limit) || 20;
      let data;
      try {
        data = await this.prisma.customer.findMany({
          where,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          cursor: { id: query.cursor },
          skip: 1,
          select: {
            id: true,
            authUserId: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          throw new BadRequestException('Invalid cursor');
        }
        throw error;
      }

      return {
        data,
        meta: {
          limit,
          nextCursor: data.length === limit ? data[data.length - 1]?.id : null,
        },
      };
    }

    const { page, limit, skip } = this.buildCustomerListQuery(query);
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          authUserId: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllWithDetails(query: QueryCustomerDto) {
    const where = this.buildCustomerWhere(query);

    if (query.cursor) {
      const limit = Number(query.limit) || 20;
      let data;
      try {
        data = await this.prisma.customer.findMany({
          where,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          cursor: { id: query.cursor },
          skip: 1,
          include: {
            addresses: true,
            orders: {
              include: { items: true },
              orderBy: { createdAt: 'desc' },
            },
            carts: {
              include: { items: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          throw new BadRequestException('Invalid cursor');
        }
        throw error;
      }

      return {
        data,
        meta: {
          limit,
          nextCursor: data.length === limit ? data[data.length - 1]?.id : null,
        },
      };
    }

    const { page, limit, skip } = this.buildCustomerListQuery(query);

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          addresses: true,
          orders: {
            include: { items: true },
            orderBy: { createdAt: 'desc' },
          },
          carts: {
            include: { items: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneWithDetails(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
        carts: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async updateAdmin(id: string, dto: UpdateCustomerAdminDto) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        firstName: dto.firstName ?? undefined,
        lastName: dto.lastName ?? undefined,
        phoneNumber: dto.phoneNumber ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
  }

  async deactivate(id: string) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async deleteAccount(authUserId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { isActive: false },
    });

    const admin = this.supabaseAuth.getAdminClient();
    await admin.auth.admin.signOut(authUserId, 'global');

    return { success: true };
  }

  async upsertFromAuthWebhook(payload: AuthWebhookPayload) {
    if (!payload) {
      return { ignored: true };
    }

    if (payload.schema && payload.schema !== 'auth') {
      return { ignored: true };
    }

    if (payload.table && payload.table !== 'users') {
      return { ignored: true };
    }

    const eventRaw = ((payload as { event?: string }).event ?? payload.type ?? '').toUpperCase();
    if (
      eventRaw &&
      !eventRaw.includes('INSERT') &&
      !eventRaw.includes('UPDATE') &&
      !eventRaw.includes('CREATE') &&
      !eventRaw.includes('USER')
    ) {
      return { ignored: true };
    }

    const record =
      payload.record ??
      payload.user ??
      (payload.data && (payload.data as { user?: Record<string, unknown> }).user) ??
      null;
    if (!record) {
      return { ignored: true };
    }

    const authUserId =
      typeof record.id === 'string'
        ? record.id
        : typeof (record as { user_id?: unknown }).user_id === 'string'
          ? (record as { user_id?: string }).user_id!
          : null;
    const emailRaw =
      typeof record.email === 'string'
        ? record.email
        : typeof (record as { user_email?: unknown }).user_email === 'string'
          ? (record as { user_email?: string }).user_email!
          : null;

    if (!authUserId || !emailRaw) {
      return { ignored: true };
    }

    const email = emailRaw.trim().toLowerCase();
    const metadata =
      (record.raw_user_meta_data as SupabaseMetadata | null) ??
      (record.user_metadata as SupabaseMetadata | null) ??
      null;

    const firstName = this.readMetadataValue(metadata, 'firstName')
      ?? this.readMetadataValue(metadata, 'first_name')
      ?? this.readMetadataValue(metadata, 'given_name');
    const lastName = this.readMetadataValue(metadata, 'lastName')
      ?? this.readMetadataValue(metadata, 'last_name')
      ?? this.readMetadataValue(metadata, 'family_name');
    const phoneNumber = this.readMetadataValue(metadata, 'phoneNumber')
      ?? this.readMetadataValue(metadata, 'phone')
      ?? (typeof record.phone === 'string' ? record.phone : null);
    const emailVerifiedAt = this.parseDate(
      (record as Record<string, unknown>).email_confirmed_at ??
        (record as Record<string, unknown>).confirmed_at,
    );
    const phoneVerifiedAt = this.parseDate(
      (record as Record<string, unknown>).phone_confirmed_at,
    );

    return this.prisma.$transaction(async (tx) => {
      const byAuth = await tx.customer.findUnique({ where: { authUserId } });

      if (byAuth) {
        return tx.customer.update({
          where: { id: byAuth.id },
          data: {
            email,
            firstName: firstName ?? byAuth.firstName,
            lastName: lastName ?? byAuth.lastName,
            phoneNumber: phoneNumber ?? byAuth.phoneNumber,
            emailVerifiedAt: emailVerifiedAt ?? null,
            phoneVerifiedAt: phoneVerifiedAt ?? null,
            isActive: true,
          },
        });
      }

      const byEmail = await tx.customer.findUnique({ where: { email } });
      if (byEmail) {
        if (byEmail.authUserId && byEmail.authUserId !== authUserId) {
          throw new BadRequestException('Customer already linked to another auth user');
        }

        return tx.customer.update({
          where: { id: byEmail.id },
          data: {
            authUserId,
            firstName: firstName ?? byEmail.firstName,
            lastName: lastName ?? byEmail.lastName,
            phoneNumber: phoneNumber ?? byEmail.phoneNumber,
            emailVerifiedAt: emailVerifiedAt ?? null,
            phoneVerifiedAt: phoneVerifiedAt ?? null,
            isActive: true,
          },
        });
      }

      return tx.customer.create({
        data: {
          authUserId,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
          email,
          phoneNumber: phoneNumber ?? null,
          emailVerifiedAt: emailVerifiedAt ?? null,
          phoneVerifiedAt: phoneVerifiedAt ?? null,
          isActive: true,
        },
      });
    });
  }

  private readMetadataValue(metadata: SupabaseMetadata | null, key: string) {
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }

    const value = metadata[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    return null;
  }

  private async getCustomerId(authUserId: string) {
    if (!authUserId) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { id: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    return customer.id;
  }

  private async syncVerificationFromAuthUser(
    authUserId: string,
    user: unknown,
  ): Promise<{ firstEmailVerification: boolean; welcomeEmail: string | null }> {
    const none = { firstEmailVerification: false, welcomeEmail: null };

    const userRecord = this.asRecord(user);
    if (!Object.keys(userRecord).length) {
      return none;
    }

    const hasEmailField =
      'email_confirmed_at' in userRecord ||
      'confirmed_at' in userRecord;
    const hasPhoneField = 'phone_confirmed_at' in userRecord;

    if (!hasEmailField && !hasPhoneField) {
      return none;
    }

    const emailVerifiedAt = this.parseDate(
      userRecord.email_confirmed_at ?? userRecord.confirmed_at,
    );
    const phoneVerifiedAt = this.parseDate(userRecord.phone_confirmed_at);

    const data: Prisma.CustomerUpdateManyMutationInput = {};
    if (hasEmailField) {
      data.emailVerifiedAt = emailVerifiedAt;
    }
    if (hasPhoneField) {
      data.phoneVerifiedAt = phoneVerifiedAt;
    }

    if (Object.keys(data).length === 0) {
      return none;
    }

    let firstEmailVerification = false;
    let welcomeEmail: string | null = null;

    if (hasEmailField && emailVerifiedAt) {
      const existing = await this.prisma.customer.findFirst({
        where: { authUserId },
        select: { emailVerifiedAt: true, email: true },
      });
      firstEmailVerification = existing?.emailVerifiedAt === null;
      if (firstEmailVerification) {
        welcomeEmail = existing?.email ?? null;
      }
    }

    await this.prisma.customer.updateMany({
      where: { authUserId },
      data,
    });

    return { firstEmailVerification, welcomeEmail };
  }

  private buildCustomerListQuery(query: QueryCustomerDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  private buildCustomerWhere(query: QueryCustomerDto) {
    const where: Record<string, unknown> = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phoneNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private getCustomerExportSelect(): Prisma.CustomerSelect {
    return {
      id: true,
      authUserId: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      mfaEnabled: true,
      mfaMethod: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true,
      marketingConsent: true,
      marketingConsentAt: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      addresses: true,
      orders: {
        include: { items: true },
        orderBy: { createdAt: Prisma.SortOrder.desc },
      },
      carts: {
        include: { items: true },
        orderBy: { createdAt: Prisma.SortOrder.desc },
      },
      consents: { orderBy: { createdAt: Prisma.SortOrder.desc } },
    };
  }

  private async ensureEmailVerified(authUserId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { id: true, emailVerifiedAt: true },
    });

    if (!customer) {
      this.badRequest('CUSTOMER_NOT_FOUND', 'Customer profile not found');
    }

    if (customer.emailVerifiedAt) {
      return;
    }

    const admin = this.supabaseAuth.getAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(authUserId);
    if (error) {
      this.badRequest('AUTH_FETCH_FAILED', error.message);
    }

    const userRecord = this.asRecord(data.user);
    const emailVerifiedAt = this.parseDate(
      userRecord.email_confirmed_at ?? userRecord.confirmed_at,
    );

    if (emailVerifiedAt) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { emailVerifiedAt },
      });
      return;
    }

    this.badRequest(
      'EMAIL_VERIFICATION_REQUIRED',
      'Confirme seu email. Clique para reenviar a verificacao.',
      {
        action: 'RESEND_EMAIL_VERIFICATION',
        endpoint: '/customers/verify/email',
      },
    );
  }

  async requestPasswordReset(dto: PasswordResetRequestDto): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const locale = dto.locale ?? 'pt';
    const client = this.redis.getClient();

    const customer = await this.prisma.customer.findUnique({
      where: { email },
      select: { id: true, firstName: true, authUserId: true },
    });

    // Responde sempre 200 — anti-enumeração de emails
    if (!customer || !customer.authUserId) {
      return { message: 'Se o email existir, receberá um link em breve.' };
    }

    if (client) {
      // Invalidar token anterior se existir
      const prevHash = await client.get(`pwd-reset:active:${customer.id}`);
      if (prevHash) {
        await client.del(`pwd-reset:${prevHash}`);
        await client.del(`pwd-reset:active:${customer.id}`);
      }

      // Gerar novo token seguro
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');

      await client.set(`pwd-reset:${tokenHash}`, JSON.stringify({ customerId: customer.id, authUserId: customer.authUserId, email, locale }), { EX: this.RESET_TTL });
      await client.set(`pwd-reset:active:${customer.id}`, tokenHash, { EX: this.RESET_TTL });

      const frontendUrl = process.env.FRONTEND_URL ?? 'https://stockzy.com';
      const resetLink = `${frontendUrl}/reset-password?token=${token}&locale=${locale}`;

      void this.notificationsService.dispatchPasswordReset({
        to: email,
        firstName: customer.firstName ?? 'Cliente',
        locale: locale as 'pt' | 'fr' | 'en' | 'es',
        resetLink,
      });
    }

    return { message: 'Se o email existir, receberá um link em breve.' };
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto): Promise<{ message: string }> {
    const client = this.redis.getClient();
    if (!client) {
      throw new BadRequestException({ code: 'SERVICE_UNAVAILABLE', message: 'Serviço temporariamente indisponível.' });
    }

    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const raw = await client.get(`pwd-reset:${tokenHash}`);

    if (!raw) {
      throw new BadRequestException({ code: 'TOKEN_INVALID', message: 'Link inválido ou expirado.' });
    }

    const { customerId, authUserId, email, locale } = JSON.parse(raw) as { customerId: string; authUserId: string; email: string; locale: string };

    // Apagar ANTES de atualizar — uso único, previne race conditions
    await client.del(`pwd-reset:${tokenHash}`);
    await client.del(`pwd-reset:active:${customerId}`);

    const admin = this.supabaseAuth.getAdminClient();
    const { error } = await admin.auth.admin.updateUserById(authUserId, { password: dto.newPassword });

    if (error) {
      throw new BadRequestException({ code: 'PASSWORD_UPDATE_FAILED', message: error.message });
    }

    // Invalidar todas as sessões activas
    await admin.auth.admin.signOut(authUserId, 'global');

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { firstName: true },
    });

    void this.notificationsService.dispatchPasswordResetConfirmed({
      to: email,
      firstName: customer?.firstName ?? 'Cliente',
      locale: (locale ?? 'fr') as 'pt' | 'fr' | 'en' | 'es',
    });

    return { message: 'Password alterada com sucesso.' };
  }

  private badRequest(code: string, message: string, details?: Record<string, unknown>): never {
    throw new BadRequestException({
      code,
      message,
      ...(details ?? {}),
    });
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private parseDate(value: unknown) {
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
