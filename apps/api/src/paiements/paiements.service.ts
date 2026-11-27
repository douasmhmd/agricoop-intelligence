import { Inject, Injectable, Logger } from '@nestjs/common';
import { commande } from '@agricoop/db';
import { AppProblem, Problems, TenantDb } from '@agricoop/nest-kit';
import { formatMad } from '@agricoop/shared';
import { eq } from 'drizzle-orm';
import { ClientsService } from '../clients/clients.service';
import { CommandesService } from '../commandes/commandes.service';
import { NOTIFICATION_PROVIDER, type NotificationProvider } from '../notifications/notifications';
import { CmiMockGateway, PAYMENT_GATEWAY, type PaymentGateway } from './payment-gateway';

export type CallbackOutcome = 'paid' | 'already_paid' | 'declined';

@Injectable()
export class PaiementsService {
  private readonly logger = new Logger(PaiementsService.name);

  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(CommandesService) private readonly commandes: CommandesService,
    @Inject(ClientsService) private readonly clients: ClientsService,
    @Inject(NOTIFICATION_PROVIDER) private readonly notifications: NotificationProvider,
  ) {}

  checkoutUrl(code: string, commandeId: string): string {
    return this.gateway.checkoutUrl(code, commandeId);
  }

  /**
   * Provider callback: verified signature, amount must equal the order total, then creee → payee
   * once. Replays are no-ops (`already_paid`); declined payments leave the order in `creee`.
   */
  async handleCallback(code: string, fields: Record<string, unknown>): Promise<CallbackOutcome> {
    const cb = this.gateway.parseCallback(code, fields);
    if (!cb.approved) {
      this.logger.log(
        { commande_id: cb.commandeId, provider: this.gateway.provider },
        'payment declined',
      );
      return 'declined';
    }
    const changed = await this.tenantDb.runForCode(code, async (scope) => {
      const montant = await this.commandes.montant(scope, cb.commandeId);
      if (montant !== cb.amount) {
        throw new AppProblem(
          409,
          'montant_incorrect',
          'Amount mismatch',
          'Paid amount differs from the order total',
        );
      }
      return (await this.commandes.transition(scope, cb.commandeId, 'payee')).changed;
    });
    this.logger.log(
      {
        commande_id: cb.commandeId,
        provider: this.gateway.provider,
        transaction: cb.transactionId,
        changed,
      },
      'payment approved',
    );
    if (changed) void this.notifyPaid(code, cb.commandeId);
    return changed ? 'paid' : 'already_paid';
  }

  /** Data for the mock gateway page (no personal data). */
  async mockCheckout(
    code: string,
    commandeId: string,
  ): Promise<{ coop: string; montant: string; statut: string }> {
    this.mockGateway();
    return this.tenantDb.runForCode(code, async (scope, coop) => {
      const cmd = await scope.findOne(commande, eq(commande.commande_id, commandeId));
      if (!cmd) throw Problems.notFound('Commande');
      return {
        coop: coop.nom,
        montant: await this.commandes.montant(scope, commandeId),
        statut: cmd.statut,
      };
    });
  }

  /** The mock gateway's "customer clicked Pay / Cancel": posts a signed callback to ourselves. */
  async mockDecision(code: string, commandeId: string, approve: boolean): Promise<CallbackOutcome> {
    const gateway = this.mockGateway();
    const { montant } = await this.mockCheckout(code, commandeId);
    return this.handleCallback(code, gateway.buildCallback(code, commandeId, montant, approve));
  }

  private mockGateway(): CmiMockGateway {
    if (!(this.gateway instanceof CmiMockGateway)) throw Problems.notFound('Mock gateway');
    return this.gateway;
  }

  /** Confirmation after commit; best effort, never logs addresses or phone numbers. */
  private async notifyPaid(code: string, commandeId: string): Promise<void> {
    try {
      const { pii, montant, coopNom } = await this.tenantDb.runForCode(
        code,
        async (scope, coop) => {
          const cmd = await scope.findOne(commande, eq(commande.commande_id, commandeId));
          return {
            pii: cmd ? await this.clients.personalData(scope, cmd.client_id) : undefined,
            montant: await this.commandes.montant(scope, commandeId),
            coopNom: coop.nom,
          };
        },
      );
      const reference = `commande:${commandeId}`;
      const ref = commandeId.slice(0, 8).toUpperCase();
      const text = `Merci ! Votre commande ${ref} auprès de ${coopNom} est payée (${formatMad(montant)}).`;
      if (pii?.email) {
        await this.notifications.send({
          channel: 'email',
          to: pii.email,
          subject: `Commande ${ref} confirmée`,
          text,
          reference,
        });
      }
      if (pii?.telephone) {
        await this.notifications.send({ channel: 'sms', to: pii.telephone, text, reference });
      }
    } catch (error) {
      // Error messages from mail transports may contain addresses: log the type only.
      this.logger.warn(
        { commande_id: commandeId, error: error instanceof Error ? error.name : 'unknown' },
        'order confirmation failed',
      );
    }
  }
}
