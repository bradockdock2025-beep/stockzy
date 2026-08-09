import { IsEnum } from 'class-validator';
import { order_status } from '@prisma/client';

export class UpdateOrderStatusDto {
  @IsEnum(order_status)
  status: order_status;
}
