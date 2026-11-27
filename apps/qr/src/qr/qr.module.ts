import { type DynamicModule, Module } from '@nestjs/common';
import type { QrEnv } from '../env';
import { GEO_LOCATOR, headerGeoLocator } from './client-info';
import { QrAdminController, VerificationController } from './qr.controllers';
import { QR_CONFIG, type QrConfig } from './qr.config';
import { QrCodesService } from './qr-codes.service';
import { VerificationService } from './verification.service';

@Module({})
export class QrModule {
  static register(env: QrEnv): DynamicModule {
    const config: QrConfig = {
      webPublicUrl: env.WEB_PUBLIC_URL,
      maxLabels: env.QR_MAX_LABELS,
      anomaly: {
        maxScansUnite: env.QR_MAX_SCANS_UNITE,
        lotScanFactor: env.QR_LOT_SCAN_FACTOR,
        maxVilles24h: env.QR_MAX_VILLES_24H,
      },
    };
    return {
      module: QrModule,
      controllers: [VerificationController, QrAdminController],
      providers: [
        QrCodesService,
        VerificationService,
        { provide: QR_CONFIG, useValue: config },
        { provide: GEO_LOCATOR, useValue: headerGeoLocator },
      ],
    };
  }
}
