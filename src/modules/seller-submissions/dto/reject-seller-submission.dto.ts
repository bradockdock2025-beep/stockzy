import { IsNotEmpty, IsString } from 'class-validator';

export class RejectSellerSubmissionDto {
  @IsString()
  @IsNotEmpty()
  rejectionReason: string;
}
