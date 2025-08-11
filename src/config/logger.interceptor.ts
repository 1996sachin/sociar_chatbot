import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { CustomLogger } from './custom.logger';
import { catchError, Observable, tap } from 'rxjs';

@Injectable()
export class GlobalLoggingInterceptor implements NestInterceptor {
  private readonly logger = new CustomLogger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = req;

    this.logger.logRequest(
      `${method} ${url} | params=${JSON.stringify(params)} query=${JSON.stringify(query)} body=${JSON.stringify(body)}`,
    );

    return next.handle().pipe(
      tap((data) => {
        this.logger.logResponse(data);
      }),

      catchError((err) => {
        this.logger.error(err);
        throw err;
      }),
    );
  }
}
