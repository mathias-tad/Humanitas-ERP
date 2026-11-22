import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ACTIVITY_TYPES } from './crm.dto';

/** How the contact happened. */
export const FOLLOW_UP_CHANNELS = ['call', 'meeting', 'visit', 'email', 'telegram', 'whatsapp', 'sms', 'note'] as const;
export type FollowUpChannel = (typeof FOLLOW_UP_CHANNELS)[number];

export class NextStepDto {
  @IsIn(ACTIVITY_TYPES) activity_type: (typeof ACTIVITY_TYPES)[number];
  @IsString() @Length(1, 255) subject: string;
  @IsDateString() due_at: string;
  @IsOptional() @IsUUID() assigned_to?: string;
}

/** A contact that already happened: by which means, which way, when, with whom and what came out of it. */
export class LogFollowUpDto {
  @IsIn(FOLLOW_UP_CHANNELS) channel: FollowUpChannel;
  /** outbound: we contacted them; inbound: they contacted us. */
  @IsOptional() @IsIn(['inbound', 'outbound']) direction?: 'inbound' | 'outbound';
  /** When it happened; now when left out. Cannot be in the future. */
  @IsOptional() @IsDateString() occurred_at?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1440) duration_minutes?: number;
  /** Who it was with (a name, or the deal's contact person). */
  @IsOptional() @IsString() @MaxLength(255) with_whom?: string;
  /** What came out of it. */
  @IsString() @Length(1, 5000) outcome: string;
  /** Plan the next step in the same go. */
  @IsOptional() @ValidateNested() @Type(() => NextStepDto) next?: NextStepDto;
}
