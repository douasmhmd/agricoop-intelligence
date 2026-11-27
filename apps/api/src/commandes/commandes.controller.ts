import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, NoTenant, Roles } from '@agricoop/nest-kit';
import {
  type Commande,
  commandeCreateSchema,
  type CommandeCreeeResponse,
  commandeCreeeSchema,
  type CommandeDetail,
  commandeDetailSchema,
  commandeListQuery,
  type CommandePage,
  commandePageSchema,
  commandeSchema,
  statutChangeSchema,
} from '@agricoop/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { PaiementsService } from '../paiements/paiements.service';
import { CommandesService } from './commandes.service';

export class CommandeDto extends createZodDto(commandeSchema) {}
export class CommandeCreateDto extends createZodDto(commandeCreateSchema) {}
export class CommandeCreeeDto extends createZodDto(commandeCreeeSchema) {}
export class CommandeDetailDto extends createZodDto(commandeDetailSchema) {}
export class CommandePageDto extends createZodDto(commandePageSchema) {}
export class CommandeListQueryDto extends createZodDto(commandeListQuery) {}
export class StatutChangeDto extends createZodDto(statutChangeSchema) {}

/** Storefront orders of the signed-in customer / reseller. Tenant = cooperative code in the URL. */
@ApiTags('boutique')
@Controller('coops/:code/commandes')
@NoTenant()
@Roles('customer', 'reseller')
export class BoutiqueCommandesController {
  constructor(
    @Inject(CommandesService) private readonly commandes: CommandesService,
    @Inject(PaiementsService) private readonly paiements: PaiementsService,
  ) {}

  /**
   * Places an order (canal `web`, or `revendeur` for resellers): FEFO allocation, stock decrement and
   * events in one transaction. 409 `stock_insuffisant` lists the `manquants`.
   */
  @Post()
  @ZodResponse({
    status: 201,
    description: 'Order placed; pay at paiement.redirect_url',
    type: CommandeCreeeDto,
  })
  async place(
    @Param('code') code: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CommandeCreateDto,
  ): Promise<CommandeCreeeResponse> {
    const commande = await this.commandes.place(code, user, body);
    return {
      ...commande,
      paiement: { redirect_url: this.paiements.checkoutUrl(code, commande.commande_id) },
    };
  }

  @Get()
  @ZodResponse({ status: 200, description: 'My orders in this cooperative', type: [CommandeDto] })
  mine(@Param('code') code: string, @CurrentUser() user: AuthUser): Promise<Commande[]> {
    return this.commandes.listMine(code, user);
  }

  @Get(':commandeId')
  @ZodResponse({ status: 200, description: 'One of my orders', type: CommandeDto })
  get(
    @Param('code') code: string,
    @Param('commandeId', new ParseUUIDPipe()) commandeId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Commande> {
    return this.commandes.getMine(code, user, commandeId);
  }

  /** Cancels one of my orders (allowed while `creee` or `payee`). */
  @Post(':commandeId/annulation')
  @HttpCode(200)
  @ZodResponse({ status: 200, description: 'Order cancelled', type: CommandeDto })
  cancel(
    @Param('code') code: string,
    @Param('commandeId', new ParseUUIDPipe()) commandeId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Commande> {
    return this.commandes.cancelMine(code, user, commandeId);
  }
}

/** Back-office order management. */
@ApiTags('commandes')
@Controller('commandes')
@Roles('coop_manager')
export class CommandesController {
  constructor(@Inject(CommandesService) private readonly commandes: CommandesService) {}

  @Get()
  @ZodResponse({ status: 200, description: 'A page of orders', type: CommandePageDto })
  list(@Query() query: CommandeListQueryDto): Promise<CommandePage> {
    return this.commandes.list(query);
  }

  /** Order with lines and the customer's delivery details. */
  @Get(':commandeId')
  @ZodResponse({ status: 200, description: 'The order', type: CommandeDetailDto })
  get(@Param('commandeId', new ParseUUIDPipe()) commandeId: string): Promise<CommandeDetail> {
    return this.commandes.get(commandeId);
  }

  /**
   * creee → payee (e.g. cash) → expediee → livree; annulee from creee / payee (restocks).
   * 409 `transition_invalide` otherwise.
   */
  @Post(':commandeId/statut')
  @HttpCode(200)
  @ZodResponse({ status: 200, description: 'Order updated', type: CommandeDetailDto })
  changeStatut(
    @Param('commandeId', new ParseUUIDPipe()) commandeId: string,
    @Body() body: StatutChangeDto,
  ): Promise<CommandeDetail> {
    return this.commandes.changeStatut(commandeId, body.statut);
  }
}
