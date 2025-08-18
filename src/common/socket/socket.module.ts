import { Module } from '@nestjs/common';
import { SocketStore } from './socket.store';

@Module({
  providers: [SocketStore],
  exports: [SocketStore],
})
export class SocketModule { }
