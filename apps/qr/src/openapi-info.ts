import type { OpenApiOptions } from '@agricoop/nest-kit';

export const OPENAPI_INFO: OpenApiOptions = {
  title: 'AgriCoop QR authenticity service',
  version: '0.1.0',
  description: 'QR code generation, label export and public verification. Served under /qr/v1.',
};
