import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '@agricoop/nest-kit';
import { formatMad } from '@agricoop/shared';
import type { FastifyReply } from 'fastify';
import { PaiementsService } from './paiements.service';

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/**
 * Payment provider endpoints. Not part of the front-end contract (excluded from OpenAPI):
 *  - POST cmi/callback: server-to-server notification (form-encoded, signed);
 *  - GET/POST mock/…: the mock gateway's hosted page (only with PAYMENT_PROVIDER=cmi-mock).
 */
@ApiExcludeController()
@Controller('coops/:code/paiements')
@Public()
export class PaiementsController {
  constructor(@Inject(PaiementsService) private readonly paiements: PaiementsService) {}

  @Post('cmi/callback')
  @HttpCode(200)
  @Header('content-type', 'text/plain; charset=utf-8')
  async callback(
    @Param('code') code: string,
    @Body() body: Record<string, unknown>,
  ): Promise<string> {
    const outcome = await this.paiements.handleCallback(code, body ?? {});
    return outcome === 'declined' ? 'ACTION=DECLINED' : 'ACTION=POSTAUTH';
  }

  @Get('mock/:commandeId')
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'no-store')
  async mockPage(
    @Param('code') code: string,
    @Param('commandeId', new ParseUUIDPipe()) commandeId: string,
  ): Promise<string> {
    const { coop, montant, statut } = await this.paiements.mockCheckout(code, commandeId);
    const action = `/api/v1/coops/${encodeURIComponent(code)}/paiements/mock/${commandeId}/decision`;
    const payable = statut === 'creee';
    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paiement simulé</title>
<style>body{font-family:system-ui,sans-serif;max-width:28rem;margin:2rem auto;padding:0 1rem;color:#1c1917}
.card{border:1px solid #d6d3d1;border-radius:.75rem;padding:1.25rem}.amount{font-size:1.75rem;font-weight:700}
button{width:100%;padding:.8rem;margin-top:.6rem;border-radius:.5rem;border:0;font-size:1rem;cursor:pointer}
.pay{background:#4a5523;color:#fff}.cancel{background:#e7e5e4}.note{font-size:.8rem;color:#78716c}</style></head>
<body><div class="card">
<p class="note">Passerelle de paiement simulée (type CMI) — environnement de démonstration, aucune carte n'est débitée.</p>
<p>${escapeHtml(coop)}</p><p class="amount">${escapeHtml(formatMad(montant))}</p>
${
  payable
    ? `<form method="post" action="${action}"><button class="pay" name="decision" value="approve">Payer</button>
<button class="cancel" name="decision" value="decline">Annuler le paiement</button></form>`
    : `<p>Cette commande n'est plus à payer (statut : ${escapeHtml(statut)}).</p>`
}
</div></body></html>`;
  }

  @Post('mock/:commandeId/decision')
  async mockDecision(
    @Param('code') code: string,
    @Param('commandeId', new ParseUUIDPipe()) commandeId: string,
    @Body() body: { decision?: unknown } | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const approve = body?.decision === 'approve';
    const outcome = await this.paiements.mockDecision(code, commandeId, approve);
    const result = outcome === 'declined' ? 'refuse' : 'ok';
    // Back to the storefront order page (same origin).
    await reply
      .code(303)
      .redirect(`/coops/${encodeURIComponent(code)}/commandes/${commandeId}?paiement=${result}`);
  }
}
