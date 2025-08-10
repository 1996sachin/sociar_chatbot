import { TenantDatabaseMiddleware } from './tenant-database.middleware';

describe('TenantDatabaseMiddleware', () => {
  it('should be defined', () => {
    expect(new TenantDatabaseMiddleware()).toBeDefined();
  });
});
