import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SocketEvents } from 'src/common/constants/socket-events';
import { ZodError } from 'zod';

@Catch(WsException)
export class SocketExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const ctx = host.switchToWs();
    const client = ctx.getClient<Socket>();

    // Emit the error event back to the same client
    const rawError = exception.getError() as any;
    if (rawError.data instanceof ZodError && rawError.data.issues.length) {
      client.emit(SocketEvents.ERROR, {
        message: `${rawError.data.issues[0].path[0]}: ${rawError.data.issues[0].message}`,
      });
    } else client.emit(SocketEvents.ERROR, { message: rawError });
  }
}
