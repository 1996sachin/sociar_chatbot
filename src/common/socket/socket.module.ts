import { Module } from '@nestjs/common';
import { SocketStore } from './socket.store';
import { SocketService } from './socket.service';

@Module({
  providers: [SocketStore, SocketService],
  exports: [SocketStore, SocketService],
})
export class SocketModule {}
