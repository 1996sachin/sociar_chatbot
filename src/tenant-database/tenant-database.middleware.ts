import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction } from 'express';

@Injectable()
export class TenantDatabaseMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId =
      req.headers['x-tenant-id']?.toString() ?? process.env.DEFAULT_DB;
    if (!tenantId) throw new BadRequestException('X-TENANT-ID header missing');

    req['tenantId'] = tenantId;
    next();
  }
}
