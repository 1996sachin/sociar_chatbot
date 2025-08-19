import { Test, TestingModule } from '@nestjs/testing';
import { TenantDatabaseService } from './tenant-database.service';

describe('TenantDatabaseService', () => {
  let service: TenantDatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantDatabaseService],
    }).compile();

    service = module.get<TenantDatabaseService>(TenantDatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
