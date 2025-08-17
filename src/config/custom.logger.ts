import { ConsoleLogger, LoggerService } from '@nestjs/common';

export class CustomLogger extends ConsoleLogger implements LoggerService {
  constructor(context?: string) {
    super();
    this.setLogLevels(['warn', 'debug', 'error', 'log']);
    this.setContext(context!);
  }

  log(message: any) {
    super.log(message);
  }

  logRequest(message: any) {
    super.log('[REQUSET]', message);
  }

  logResponse(message: any) {
    super.log('[RESPONSE]', message);
  }

  warn(message: any) {
    super.warn(message);
  }

  error(message: any) {
    super.error(message);
  }

  debug(message: any) {
    super.debug(message);
  }
}
