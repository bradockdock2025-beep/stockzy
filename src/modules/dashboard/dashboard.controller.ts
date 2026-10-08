import { Controller, Get, Query } from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { ExecutiveDashboardService } from './executive-dashboard.service';
import { QueryExecutiveDashboardDto } from './dto/query-executive-dashboard.dto';

@Controller('admin/dashboard')
@Roles(user_role.admin, user_role.manager, user_role.support)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly executiveDashboardService: ExecutiveDashboardService,
  ) {}

  @Get('summary')
  getSummary() {
    return this.dashboardService.getSummary();
  }

  /** Dados financeiros — support não vê (override do @Roles de classe, que inclui support). */
  @Get('executive')
  @Roles(user_role.admin, user_role.manager)
  getExecutive(@Query() query: QueryExecutiveDashboardDto) {
    return this.executiveDashboardService.getExecutive(query);
  }
}
