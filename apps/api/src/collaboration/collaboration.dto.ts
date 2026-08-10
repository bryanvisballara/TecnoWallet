import {
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsObject,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import {
  COLLABORATION_RESOURCE_TYPES,
  COLLABORATION_ROLES,
  type CollaborationResourceType,
  type CollaborationRole,
} from './collaboration.schemas';

export class CreateCollaborationInviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(COLLABORATION_RESOURCE_TYPES)
  resourceType!: CollaborationResourceType;

  @IsMongoId()
  resourceId!: string;

  @IsEnum(COLLABORATION_ROLES)
  role!: CollaborationRole;
}

export class AcceptCollaborationInviteDto {
  @IsString()
  @Length(32, 512)
  token!: string;
}

export class ListCollaborationInvitesQueryDto {
  @IsEnum(COLLABORATION_RESOURCE_TYPES)
  resourceType!: CollaborationResourceType;

  @IsMongoId()
  resourceId!: string;
}

export class InviteTokenParamDto {
  @IsString()
  @Length(32, 512)
  token!: string;
}

export class MongoIdParamDto {
  @IsMongoId()
  id!: string;
}

export class CreateCalendarDto {
  @IsMongoId()
  workspaceId!: string;

  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-f]{6}$/i)
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  icon?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  migrationSourceId?: string;
}

export class UpdateCalendarDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-f]{6}$/i)
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  icon?: string;
}

export class ListCalendarsQueryDto {
  @IsOptional()
  @IsMongoId()
  workspaceId?: string;
}

export class CreateCalendarItemDto {
  @IsOptional()
  @IsMongoId()
  id?: string;

  @IsMongoId()
  calendarId!: string;

  @IsObject()
  data!: Record<string, unknown>;
}

export class UpdateCalendarItemDto {
  @IsOptional()
  @IsMongoId()
  id?: string;

  @IsObject()
  data!: Record<string, unknown>;
}

export class ListCalendarItemsQueryDto {
  @IsMongoId()
  calendarId!: string;
}
