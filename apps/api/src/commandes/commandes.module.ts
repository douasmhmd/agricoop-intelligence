import { type DynamicModule, Module } from '@nestjs/common';
import { ClientsService } from '../clients/clients.service';
import type { ApiEnv } from '../env';
import { DefaultNotificationProvider, NOTIFICATION_PROVIDER } from '../notifications/notifications';
import { PaiementsController } from '../paiements/paiements.controller';
import { PaiementsService } from '../paiements/paiements.service';
import { CmiMockGateway, PAYMENT_GATEWAY } from '../paiements/payment-gateway';
import { StorefrontController } from '../storefront/storefront.controller';
import { BoutiqueCommandesController, CommandesController } from './commandes.controller';
import { CommandesService } from './commandes.service';

/** Storefront, orders, payments and notifications. */
@Module({})
export class CommandesModule {
  static register(env: ApiEnv): DynamicModule {
    return {
      module: CommandesModule,
      controllers: [
        StorefrontController,
        BoutiqueCommandesController,
        CommandesController,
        PaiementsController,
      ],
      providers: [
        ClientsService,
        CommandesService,
        PaiementsService,
        { provide: PAYMENT_GATEWAY, useFactory: () => new CmiMockGateway(env.PAYMENT_MOCK_SECRET) },
        { provide: 'SMTP_URL', useValue: env.SMTP_URL },
        { provide: 'MAIL_FROM', useValue: env.MAIL_FROM },
        { provide: NOTIFICATION_PROVIDER, useClass: DefaultNotificationProvider },
      ],
      exports: [CommandesService, ClientsService],
    };
  }
}
