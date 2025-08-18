import { MiddlewareConsumer, Module, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Connection } from 'mongoose';
import { TenantDatabaseMiddleware } from './tenant-database.middleware';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { TenantServiceFactory } from './tenant-database.service';

const tenantProviders = [
  {
    provide: 'TENANT_CONNECTION',
    scope: Scope.REQUEST,
    inject: [REQUEST, getConnectionToken()],
    useFactory: async (req: Request, connection: Connection) => {
      const tenantId = req['tenantId'];
      const dbName = `tenant_${tenantId}`;
      // console.log((await connection.listDatabases()).databases);
      const connectionDb = connection.useDb(dbName, {
        useCache: true,
      });
      return connectionDb;
    },
  },
  TenantServiceFactory,
];

@Module({
  imports: [MongooseModule.forFeature([])],
  providers: tenantProviders,
  exports: tenantProviders,
})
export class TenantDatabaseModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantDatabaseMiddleware).forRoutes('*');
  }
}
