import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, type AuthPrincipal } from '../auth/auth.module';
import { BrevoMailer } from '../mail/brevo';
import { inviteEmailHtml, inviteEmailSubject } from '../mail/invite-email';
import {
  AcceptCollaborationInviteDto,
  CreateCalendarDto,
  CreateCollaborationInviteDto,
  InviteTokenParamDto,
  ListCalendarsQueryDto,
  MongoIdParamDto,
  UpdateCalendarDto,
  UpdateCalendarItemDto,
} from './collaboration.dto';
import { CalendarService, CollaborationService } from './collaboration.service';

@ApiTags('collaboration')
@Controller('collaboration')
export class CollaborationController {
  constructor(
    private readonly collaboration: CollaborationService,
    private readonly mailer: BrevoMailer,
  ) {}

  @ApiBearerAuth()
  @Post('invites')
  async createInvite(
    @Body() body: CreateCollaborationInviteDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const created = await this.collaboration.createInvite(body, user);
    const payload = {
      kind: created.mailDispatch.resourceType,
      resourceName: created.mailDispatch.resourceName,
      acceptLink: created.mailDispatch.inviteUrl,
      inviterName: user.email.split('@')[0],
      roleLabel: created.response.role,
    };
    const delivery = await this.mailer.sendHtml({
      to: created.mailDispatch.to,
      subject: inviteEmailSubject(payload),
      htmlContent: inviteEmailHtml(payload),
    });
    return { ...created.response, delivered: delivery.delivered };
  }

  @ApiBearerAuth()
  @Post('invites/accept')
  acceptInvite(
    @Body() body: AcceptCollaborationInviteDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.collaboration.acceptInvite(body, user);
  }

  @Public()
  @Get('invites/:token')
  lookupInvite(@Param() params: InviteTokenParamDto) {
    return this.collaboration.lookupInvite(params.token);
  }

  @ApiBearerAuth()
  @Get('seats')
  seats(@CurrentUser() user: AuthPrincipal) {
    return this.collaboration.listSeats(user.userId);
  }

  @ApiBearerAuth()
  @Delete('seats/:id')
  revokeSeat(
    @Param() params: MongoIdParamDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.collaboration.revokeSeat(params.id, user.userId);
  }
}

@ApiTags('calendars')
@ApiBearerAuth()
@Controller('calendars')
export class CalendarController {
  constructor(private readonly calendars: CalendarService) {}

  @Get()
  list(
    @Query() query: ListCalendarsQueryDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.calendars.list(query, user.userId);
  }

  @Post()
  create(@Body() body: CreateCalendarDto, @CurrentUser() user: AuthPrincipal) {
    return this.calendars.create(body, user.userId);
  }

  @Patch(':id')
  update(
    @Param() params: MongoIdParamDto,
    @Body() body: UpdateCalendarDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.calendars.update(params.id, body, user.userId);
  }

  @Delete(':id')
  remove(@Param() params: MongoIdParamDto, @CurrentUser() user: AuthPrincipal) {
    return this.calendars.remove(params.id, user.userId);
  }

  @Get(':id/members')
  members(
    @Param() params: MongoIdParamDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.calendars.members(params.id, user.userId);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.calendars.removeMember(id, memberUserId, user.userId);
  }

  @Get(':id/items')
  items(@Param() params: MongoIdParamDto, @CurrentUser() user: AuthPrincipal) {
    return this.calendars.listItems(params.id, user.userId);
  }

  @Post(':id/items')
  createItem(
    @Param() params: MongoIdParamDto,
    @Body() body: UpdateCalendarItemDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.calendars.createItem(
      { id: body.id, calendarId: params.id, data: body.data },
      user.userId,
    );
  }

  @Patch('items/:id')
  updateItem(
    @Param() params: MongoIdParamDto,
    @Body() body: UpdateCalendarItemDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.calendars.updateItem(params.id, body, user.userId);
  }

  @Delete('items/:id')
  removeItem(
    @Param() params: MongoIdParamDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.calendars.removeItem(params.id, user.userId);
  }
}
