import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, Min, Max } from 'class-validator';

export enum DeliveryMethod {
  ONLINE = 'online',
  IN_PERSON = 'in_person',
  BLENDED = 'blended',
}

export enum SessionStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum EnrollmentStatus {
  NOMINATED = 'nominated',
  WAITLISTED = 'waitlisted',
  CONFIRMED = 'confirmed',
  ATTENDED = 'attended',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum SkillProficiency {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export class CreateCourseDto {
  @IsString()
  title: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  prerequisites?: string;

  @IsOptional()
  @IsEnum(DeliveryMethod)
  delivery_method?: DeliveryMethod;

  @IsOptional()
  @IsNumber()
  duration_hours?: number;

  @IsOptional()
  @IsNumber()
  capacity_limit?: number;

  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passing_score?: number;

  @IsOptional()
  @IsString()
  provider_name?: string;

  @IsOptional()
  @IsNumber()
  cost_per_learner?: number;
}

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  prerequisites?: string;

  @IsOptional()
  @IsEnum(DeliveryMethod)
  delivery_method?: DeliveryMethod;

  @IsOptional()
  @IsNumber()
  duration_hours?: number;

  @IsOptional()
  @IsNumber()
  capacity_limit?: number;

  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean;

  @IsOptional()
  @IsNumber()
  passing_score?: number;

  @IsOptional()
  @IsString()
  provider_name?: string;

  @IsOptional()
  @IsNumber()
  cost_per_learner?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class CreateSessionDto {
  @IsString()
  course_id: string;

  @IsOptional()
  @IsString()
  instructor_name?: string;

  @IsOptional()
  @IsString()
  venue_or_link?: string;

  @IsString()
  start_time: string;

  @IsString()
  end_time: string;

  @IsOptional()
  @IsNumber()
  max_participants?: number;
}

export class EnrollLearnerDto {
  @IsString()
  course_id: string;

  @IsOptional()
  @IsString()
  session_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;
}

export class UpdateEnrollmentProgressDto {
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  completion_percentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsBoolean()
  attendance_confirmed?: boolean;

  @IsOptional()
  @IsBoolean()
  certificate_issued?: boolean;
}

export class UpsertSkillDto {
  @IsOptional()
  @IsString()
  user_id?: string;

  @IsString()
  skill_name: string;

  @IsString()
  category: string;

  @IsEnum(SkillProficiency)
  proficiency_level: SkillProficiency;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}
