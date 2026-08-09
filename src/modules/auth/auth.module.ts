import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DatabaseModule } from '../../database/database.module';
import { LoginRateLimitService } from './login-rate-limit.service';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { LoginRateLimitAuditController } from './login-rate-limit-audit.controller';
import { LoginRateLimitAuditService } from './login-rate-limit-audit.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [AuthController, LoginRateLimitAuditController],
  providers: [
    AuthService,
    LoginRateLimitService,
    LoginRateLimitGuard,
    LoginRateLimitAuditService,
  ],
  exports: [LoginRateLimitService],
})
export class AuthModule {}
