import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAuthService {
  private adminClient: SupabaseClient | null = null;
  private anonClient: SupabaseClient | null = null;
  private readonly logger = new Logger(SupabaseAuthService.name);

  constructor(private readonly configService: ConfigService) {}

  private getSupabaseUrl() {
    const url = this.configService.get<string>('SUPABASE_URL');
    if (!url) {
      throw new InternalServerErrorException('SUPABASE_URL is not configured');
    }
    return url;
  }

  private getServiceRoleKey() {
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!key) {
      throw new InternalServerErrorException('SUPABASE_SERVICE_ROLE_KEY is not configured');
    }
    return key;
  }

  private getAnonKey() {
    const key = this.configService.get<string>('SUPABASE_ANON_KEY');
    if (!key) {
      throw new InternalServerErrorException('SUPABASE_ANON_KEY is not configured');
    }
    return key;
  }

  getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      this.adminClient = createClient(this.getSupabaseUrl(), this.getServiceRoleKey(), {
        auth: { persistSession: false },
      });
    }
    return this.adminClient;
  }

  getAnonClient(): SupabaseClient {
    if (!this.anonClient) {
      this.anonClient = createClient(this.getSupabaseUrl(), this.getAnonKey(), {
        auth: { persistSession: false },
      });
    }
    return this.anonClient;
  }

  async updateUserWithAccessToken(
    accessToken: string,
    attributes: { email?: string; password?: string },
    options?: { emailRedirectTo?: string },
  ) {
    const url = new URL('/auth/v1/user', this.getSupabaseUrl());
    if (options?.emailRedirectTo) {
      url.searchParams.set('redirect_to', options.emailRedirectTo);
    }

    const res = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.getAnonKey(),
        Authorization: `Bearer ${accessToken}`,
        'X-Supabase-Api-Version': '2024-01-01',
      },
      body: JSON.stringify(attributes),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        (data && (data.error_description || data.message || data.msg || data.error)) ||
        'Failed to update user';
      return { data: null, error: message };
    }

    return { data, error: null };
  }

  async getUserFromToken(accessToken: string) {
    const { data, error } = await this.getAdminClient().auth.getUser(accessToken);
    if (error) {
      this.logger.warn(`Supabase token validation failed: ${error.message}`);
      return null;
    }
    return data.user;
  }
}
