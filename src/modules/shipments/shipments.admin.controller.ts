import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { buildAuditContext } from '../../common/audit/audit-context';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { CreateShipmentEventDto } from './dto/create-shipment-event.dto';
import { QueryShipmentDto } from './dto/query-shipment.dto';

@Controller('admin/shipments')
@Roles(user_role.admin, user_role.manager)
export class ShipmentsAdminController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  create(
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Body() dto: CreateShipmentDto,
  ) {
    return this.shipmentsService.create(dto, buildAuditContext(req));
  }

  @Get()
  findAll(@Query() query: QueryShipmentDto) {
    return this.shipmentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.shipmentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.shipmentsService.update(id, dto, buildAuditContext(req));
  }

  @Post(':id/events')
  addEvent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Body() dto: CreateShipmentEventDto,
  ) {
    return this.shipmentsService.addEvent(id, dto, buildAuditContext(req));
  }
}
