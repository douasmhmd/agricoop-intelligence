import { AsyncLocalStorage } from 'node:async_hooks';
import {
  type CallHandler,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { AuthUser } from '../auth/auth-user.js';

export interface RequestContextData {
  requestId: string;
  user?: AuthUser;
  /** Tenant of this request (coop_id), resolved by AccessGuard. Never taken from a request body. */
  coopId?: string;
  /** True when a saas_admin acts on a tenant through X-Coop-Id. */
  adminOverride?: boolean;
}

/** Fields AccessGuard attaches to the raw request, picked up by RequestContextInterceptor. */
export interface ContextualRequest {
  id?: string;
  agricoop?: Omit<RequestContextData, 'requestId'>;
}

const storage = new AsyncLocalStorage<RequestContextData>();

export const RequestContext = {
  current(): RequestContextData | undefined {
    return storage.getStore();
  },

  /** The current tenant. Throws when called outside a tenant-scoped request (programming error). */
  requireTenant(): string {
    const coopId = storage.getStore()?.coopId;
    if (!coopId) throw new ForbiddenException('No tenant in the current request');
    return coopId;
  },

  /** Runs `fn` with an explicit context (workers, tests, public flows that resolved a tenant). */
  run<R>(data: RequestContextData, fn: () => R): R {
    return storage.run(data, fn);
  },
};

/** Runs every handler inside an AsyncLocalStorage scope holding the caller and the tenant. */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<ContextualRequest>();
    const data: RequestContextData = { requestId: String(req.id ?? ''), ...(req.agricoop ?? {}) };
    return new Observable((subscriber) =>
      storage.run(data, () => next.handle().subscribe(subscriber)),
    );
  }
}
