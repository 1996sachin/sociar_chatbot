import { Module } from '@nestjs/common';
import { SocketStore } from 'src/chat/socket.store';

@Module({
  providers: [SocketStore],
  exports: [SocketStore],
})
export class SocketModule { }
