import {
  Body,
  Controller,
  type DynamicModule,
  Get,
  Inject,
  Injectable,
  Logger,
  Module,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { cooperative, type Database } from '@agricoop/db';
import { DB, isUniqueViolation, NoTenant, Problems, Roles } from '@agricoop/nest-kit';
import {
  type CooperativeAdmin,
  cooperativeAdminSchema,
  type CooperativeCreate,
  cooperativeCreateSchema,
  toIsoTimestamp,
} from '@agricoop/shared';
import { asc } from 'drizzle-orm';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import type { ApiEnv } from '../env';
import {
  IDENTITY_ADMIN,
  type IdentityAdmin,
  InMemoryIdentityAdmin,
  KeycloakIdentityAdmin,
  type ProvisionedIdentity,
} from './identity-admin';

export class CooperativeAdminDto extends createZodDto(cooperativeAdminSchema) {}
export class CooperativeCreateDto extends createZodDto(cooperativeCreateSchema) {}

const toAdmin = (r: typeof cooperative.$inferSelect): CooperativeAdmin => ({
  coop_id: r.coop_id,
  code: r.code,
  nom: r.nom,
  province: r.province,
  is_synthetic: r.is_synthetic,
  created_at: toIsoTimestamp(r.created_at),
});

@Injectable()
export class CooperativesAdminService {
  private readonly logger = new Logger('PlatformAdmin');

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(IDENTITY_ADMIN) private readonly identity: IdentityAdmin,
  ) {}

  async list(): Promise<CooperativeAdmin[]> {
    return (await this.db.select().from(cooperative).orderBy(asc(cooperative.code))).map(toAdmin);
  }

  /**
   * Creates the tenant row and, inside the same transaction, its Keycloak group + manager. Keycloak
   * failure → rollback; commit failure after provisioning → Keycloak is cleaned up.
   */
  async create(input: CooperativeCreate): Promise<CooperativeAdmin> {
    let provisioned: ProvisionedIdentity | undefined;
    try {
      const row = await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(cooperative)
          .values({ code: input.code, nom: input.nom, province: input.province })
          .returning();
        if (!created) throw new Error('cooperative insert returned nothing');
        provisioned = await this.identity.provisionCooperative({
          coopId: created.coop_id,
          code: created.code,
          manager: {
            email: input.gestionnaire.email,
            firstName: input.gestionnaire.prenom,
            lastName: input.gestionnaire.nom,
          },
        });
        return created;
      });
      // Audit without personal data.
      this.logger.log({ audit: 'cooperative_created', coop_id: row.coop_id, code: row.code });
      return toAdmin(row);
    } catch (error) {
      if (provisioned) await this.identity.deprovision(provisioned).catch(() => undefined);
      if (isUniqueViolation(error, 'cooperative_code_key')) {
        throw Problems.conflict('coop_code_existe', 'A cooperative with this code already exists');
      }
      throw error;
    }
  }
}

/** Platform administration (saas_admin only, no tenant). */
@ApiTags('admin')
@Controller('admin/cooperatives')
@NoTenant()
@Roles('saas_admin')
export class CooperativesAdminController {
  constructor(
    @Inject(CooperativesAdminService) private readonly service: CooperativesAdminService,
  ) {}

  @Get()
  @ZodResponse({
    status: 200,
    description: 'All cooperatives (tenants)',
    type: [CooperativeAdminDto],
  })
  list(): Promise<CooperativeAdmin[]> {
    return this.service.list();
  }

  /** 409 `coop_code_existe` / `gestionnaire_existe`; 502 `idp_indisponible` (nothing is created). */
  @Post()
  @ZodResponse({
    status: 201,
    description: 'Cooperative and manager account created',
    type: CooperativeAdminDto,
  })
  create(@Body() body: CooperativeCreateDto): Promise<CooperativeAdmin> {
    return this.service.create(body);
  }
}

@Module({})
export class AdminModule {
  static register(env: ApiEnv): DynamicModule {
    return {
      module: AdminModule,
      controllers: [CooperativesAdminController],
      providers: [
        CooperativesAdminService,
        {
          provide: IDENTITY_ADMIN,
          useFactory: (): IdentityAdmin =>
            env.KC_PROVISIONER_SECRET
              ? new KeycloakIdentityAdmin({
                  baseUrl: env.KEYCLOAK_ADMIN_URL,
                  realm: env.KEYCLOAK_REALM,
                  clientId: env.KC_PROVISIONER_CLIENT_ID,
                  clientSecret: env.KC_PROVISIONER_SECRET,
                })
              : new InMemoryIdentityAdmin(),
        },
      ],
    };
  }
}
