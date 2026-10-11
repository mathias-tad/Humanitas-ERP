import { IsBoolean, IsOptional, IsString, IsNumber, IsIn, Min } from 'class-validator';

export class UpdateMessagingSettingsDto {
  @IsBoolean()
  @IsOptional()
  enableBrowserNotifications?: boolean;

  @IsBoolean()
  @IsOptional()
  enableSound?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyOnDirectMessages?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyOnGroupMessages?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyOnMentions?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyOnCalls?: boolean;

  @IsBoolean()
  @IsOptional()
  privacyModeEnabled?: boolean;

  @IsString()
  @IsOptional()
  @IsIn(['everyone', 'contacts', 'nobody'])
  allowMessagesFrom?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  messageRetentionDays?: number;

  @IsBoolean()
  @IsOptional()
  showReadReceipts?: boolean;

  @IsBoolean()
  @IsOptional()
  showTypingIndicators?: boolean;
}
