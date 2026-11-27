import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public, Roles } from '@agricoop/nest-kit';
import {
  type QrCode,
  type QrCodePage,
  qrCodePageSchema,
  qrCodeSchema,
  qrGenerateQuery,
  qrListQuery,
  qrStatutChangeSchema,
  type Scan,
  scanSchema,
  type ScansParVille,
  scansParVilleQuery,
  scansParVilleSchema,
  type Verification,
  verificationSchema,
} from '@agricoop/shared';
import type { FastifyRequest } from 'fastify';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { renderLabelSheet } from './labels-pdf';
import { QrCodesService } from './qr-codes.service';
import { VerificationService } from './verification.service';

export class VerificationDto extends createZodDto(verificationSchema) {}
export class QrCodeDto extends createZodDto(qrCodeSchema) {}
export class QrCodePageDto extends createZodDto(qrCodePageSchema) {}
export class QrListQueryDto extends createZodDto(qrListQuery) {}
export class QrGenerateQueryDto extends createZodDto(qrGenerateQuery) {}
export class QrStatutChangeDto extends createZodDto(qrStatutChangeSchema) {}
export class ScanDto extends createZodDto(scanSchema) {}
export class ScansParVilleDto extends createZodDto(scansParVilleSchema) {}
export class ScansParVilleQueryDto extends createZodDto(scansParVilleQuery) {}

/** Requests per minute and client on the public verification endpoint (QR_VERIFY_RATE_PER_MIN). */
export const verifyRateLimit = (): number => Number(process.env.QR_VERIFY_RATE_PER_MIN ?? 30);

@ApiTags('verification')
@Controller('verify')
@Public()
export class VerificationController {
  constructor(@Inject(VerificationService) private readonly verification: VerificationService) {}

  /**
   * Public authenticity check behind the label's QR code. Records the scan (approximate city, device
   * class — never the IP). 404 `qr_inconnu` for a code that was never issued. Strictly rate-limited.
   */
  @Get(':token')
  @Throttle({ default: { limit: verifyRateLimit, ttl: 60_000 } })
  @Header('cache-control', 'no-store')
  @ZodResponse({ status: 200, description: 'Verification result', type: VerificationDto })
  verify(@Param('token') token: string, @Req() req: FastifyRequest): Promise<Verification> {
    return this.verification.verify(token, {
      headers: req.headers,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}

@ApiTags('qr-codes')
@Controller()
@Roles('coop_manager')
export class QrAdminController {
  constructor(@Inject(QrCodesService) private readonly qrCodes: QrCodesService) {}

  /**
   * Issues the lot's QR codes (one per lot or per unit) and returns the printable A4 label sheet.
   * The PDF is the only copy of the tokens. 409 `qr_deja_generes` unless `regenerer=true`.
   */
  @Post('lots/:lotId/qr-codes')
  @ApiProduces('application/pdf')
  @ApiResponse({
    status: 201,
    description: 'Printable label sheet',
    content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
  })
  async generate(
    @Param('lotId', new ParseUUIDPipe()) lotId: string,
    @Query() query: QrGenerateQueryDto,
  ): Promise<StreamableFile> {
    const sheet = await this.qrCodes.generate(lotId, query.regenerer === 'true');
    const pdf = await renderLabelSheet(sheet);
    const name = `qr-${sheet.lotNumero.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${name}"`,
      length: pdf.length,
    });
  }

  @Get('qr-codes')
  @ZodResponse({ status: 200, description: 'QR codes with scan statistics', type: QrCodePageDto })
  list(@Query() query: QrListQueryDto): Promise<QrCodePage> {
    return this.qrCodes.list(query);
  }

  @Get('qr-codes/:qrId')
  @ZodResponse({ status: 200, description: 'The QR code', type: QrCodeDto })
  get(@Param('qrId', new ParseUUIDPipe()) qrId: string): Promise<QrCode> {
    return this.qrCodes.get(qrId);
  }

  /** Deactivate, flag or reactivate a code. */
  @Patch('qr-codes/:qrId')
  @ZodResponse({ status: 200, description: 'QR code updated', type: QrCodeDto })
  changeStatut(
    @Param('qrId', new ParseUUIDPipe()) qrId: string,
    @Body() body: QrStatutChangeDto,
  ): Promise<QrCode> {
    return this.qrCodes.changeStatut(qrId, body);
  }

  @Get('qr-codes/:qrId/scans')
  @ZodResponse({ status: 200, description: 'Scan history (latest 500)', type: [ScanDto] })
  scans(@Param('qrId', new ParseUUIDPipe()) qrId: string): Promise<Scan[]> {
    return this.qrCodes.scans(qrId);
  }

  @Get('scans/villes')
  @ZodResponse({ status: 200, description: 'Scans per city', type: [ScansParVilleDto] })
  villes(@Query() query: ScansParVilleQueryDto): Promise<ScansParVille[]> {
    return this.qrCodes.scansParVille(query);
  }
}
