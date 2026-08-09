import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DatabaseModule } from './database/database.module';
import { ProductsModule } from './modules/products/products.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { OrdersModule } from './modules/orders/orders.module';
import { UsersModule } from './modules/users/users.module';
import { CartModule } from './modules/cart/cart.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { BannersModule } from './modules/banners/banners.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RankingsModule } from './modules/rankings/rankings.module';
import { SearchModule } from './modules/search/search.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { HomepageModule } from './modules/homepage/homepage.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { BrandsModule } from './modules/brands/brands.module';
import { FacetsModule } from './modules/facets/facets.module';
import { OffersModule } from './modules/offers/offers.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditContextMiddleware } from './common/audit/audit-context.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60_000,
      limit: 120,
    }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    UsersModule,
    CartModule,
    CustomersModule,
    PromotionsModule,
    BannersModule,
    ShipmentsModule,
    PaymentsModule,
    ObservabilityModule,
    RankingsModule,
    SearchModule,
    RecommendationsModule,
    WishlistModule,
    HomepageModule,
    NewsletterModule,
    AnnouncementsModule,
    NotificationsModule,
    BrandsModule,
    FacetsModule,
    OffersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditContextMiddleware).forRoutes('*');
  }
}
