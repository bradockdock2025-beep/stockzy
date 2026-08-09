import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
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
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { CustomersService } from './customers.service';
import { CustomerAuthGuard } from './customer-auth.guard';
import { CustomerRateLimitGuard } from './customer-rate-limit.guard';

const COOKIE_NAME = 'customer_refresh_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias

function setRefreshCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Public()
  @UseGuards(CustomerRateLimitGuard)
  @Post('register')
  register(@Body() dto: RegisterCustomerDto) {
    return this.customersService.register(dto);
  }

  @Public()
  @UseGuards(CustomerRateLimitGuard)
  @Post('password-reset/request')
  requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.customersService.requestPasswordReset(dto);
  }

  @Public()
  @UseGuards(CustomerRateLimitGuard)
  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.customersService.confirmPasswordReset(dto);
  }

  @Public()
  @UseGuards(CustomerRateLimitGuard)
  @Post('login')
  async login(
    @Body() dto: LoginCustomerDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.customersService.login(dto);
    if (result.refreshToken) setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...safe } = result;
    return safe;
  }

  @Public()
  @UseGuards(CustomerRateLimitGuard)
  @Post('login/otp')
  requestEmailOtp(@Body() dto: RequestEmailOtpDto) {
    return this.customersService.requestEmailOtp(dto);
  }

  @Public()
  @UseGuards(CustomerRateLimitGuard)
  @Post('login/otp/verify')
  async verifyEmailOtp(
    @Body() dto: VerifyEmailOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.customersService.verifyEmailOtp(dto);
    if (result.refreshToken) setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...safe } = result;
    return safe;
  }

  @Public()
  @UseGuards(CustomerRateLimitGuard)
  @Post('login/otp/verify-link')
  async verifyEmailLink(
    @Body() dto: VerifyEmailLinkDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.customersService.verifyEmailLink(dto);
    if (result.refreshToken) setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...safe } = result;
    return safe;
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[COOKIE_NAME] ?? '';
    const result = await this.customersService.refresh(token);
    if (result.refreshToken) setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...safe } = result;
    return safe;
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() req: Request & { cookies?: Record<string, string>; headers?: Record<string, unknown> },
    @Res({ passthrough: true }) res: Response,
  ) {
    clearRefreshCookie(res);
    const cookieToken = req.cookies?.[COOKIE_NAME];
    if (cookieToken) {
      return this.customersService.logoutWithRefreshToken(cookieToken);
    }
    const authHeader = req.headers?.['authorization'];
    const rawHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (typeof rawHeader === 'string' && rawHeader.trim().length > 0) {
      return this.customersService.logout(rawHeader);
    }
    return this.customersService.logout('');
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Get('me')
  me(@Req() req: { customerAuth?: { authUserId: string } }) {
    return this.customersService.getProfile(req.customerAuth?.authUserId ?? '');
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Patch('me')
  update(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateProfile(req.customerAuth?.authUserId ?? '', dto);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Patch('profile')
  updateProfile(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateProfile(req.customerAuth?.authUserId ?? '', dto);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Post('verify/email')
  requestEmailVerification(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Body() dto: RequestEmailVerificationDto,
  ) {
    return this.customersService.requestEmailVerification(
      req.customerAuth?.authUserId ?? '',
      dto,
    );
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Post('verify/phone')
  requestPhoneVerification(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Body() dto: RequestPhoneVerificationDto,
  ) {
    return this.customersService.requestPhoneVerification(
      req.customerAuth?.authUserId ?? '',
      dto,
    );
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Post('verify/phone/confirm')
  verifyPhone(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Body() dto: VerifyPhoneDto,
  ) {
    return this.customersService.verifyPhone(req.customerAuth?.authUserId ?? '', dto);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Patch('mfa')
  updateMfa(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Body() dto: MfaPreferenceDto,
  ) {
    return this.customersService.updateMfaPreference(
      req.customerAuth?.authUserId ?? '',
      dto,
    );
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Patch('password')
  changePassword(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Body() dto: ChangeCustomerPasswordDto,
  ) {
    return this.customersService.changePassword(req.customerAuth?.authUserId ?? '', dto);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Patch('email')
  changeEmail(
    @Req() req: { customerAuth?: { authUserId: string; accessToken?: string } },
    @Body() dto: ChangeCustomerEmailDto,
  ) {
    return this.customersService.changeEmail(
      req.customerAuth?.authUserId ?? '',
      req.customerAuth?.accessToken ?? '',
      dto,
    );
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Get('consents')
  listConsents(@Req() req: { customerAuth?: { authUserId: string } }) {
    return this.customersService.listConsents(req.customerAuth?.authUserId ?? '');
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Post('consents')
  recordConsent(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Body() dto: CustomerConsentDto,
  ) {
    return this.customersService.recordConsent(req.customerAuth?.authUserId ?? '', dto);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Get('export')
  exportData(@Req() req: { customerAuth?: { authUserId: string } }) {
    return this.customersService.exportData(req.customerAuth?.authUserId ?? '');
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Get('addresses')
  listAddresses(@Req() req: { customerAuth?: { authUserId: string } }) {
    return this.customersService.listAddresses(req.customerAuth?.authUserId ?? '');
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Post('addresses')
  addAddress(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Body() dto: CreateAddressDto,
  ) {
    return this.customersService.addAddress(req.customerAuth?.authUserId ?? '', dto);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Patch('addresses/:id')
  updateAddress(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.customersService.updateAddress(req.customerAuth?.authUserId ?? '', id, dto);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Delete('addresses/:id')
  removeAddress(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.customersService.removeAddress(req.customerAuth?.authUserId ?? '', id);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Delete('me')
  deleteAccount(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    clearRefreshCookie(res);
    return this.customersService.deleteAccount(req.customerAuth?.authUserId ?? '');
  }
}
