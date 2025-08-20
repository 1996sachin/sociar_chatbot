import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantServiceFactory } from './tenant-database.service';
import { Socket } from 'socket.io';

@Injectable()
export class TenantDatabaseInterceptor implements NestInterceptor {
  constructor(private readonly tenantServiceFactory: TenantServiceFactory) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const wsCtx = context.switchToWs();
    const client = wsCtx.getClient<Socket>();
    const tenantId =
      (client.handshake.headers['x-tenant-id'] as string) ??
      process.env.DEFAULT_DB;

    const services =
      await this.tenantServiceFactory.getServicesForTenant(tenantId);

    client.data.tenantServices = services;
    return next.handle();
  }
}
