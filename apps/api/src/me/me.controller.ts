import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, NoTenant } from '@agricoop/nest-kit';
import { type Me, meSchema } from '@agricoop/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';

export class MeDto extends createZodDto(meSchema) {}

@ApiTags('me')
@Controller('me')
export class MeController {
  /** Roles and cooperative of the caller. */
  @Get()
  @NoTenant()
  @ZodResponse({ status: 200, description: 'The caller', type: MeDto })
  get(@CurrentUser() user: AuthUser): Me {
    return { roles: user.roles, coop_id: user.tenantId ?? null };
  }
}
