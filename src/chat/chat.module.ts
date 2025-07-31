import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { SocketStore } from './socket.store';

@Module({
  providers: [ChatGateway, ChatService, SocketStore],
})
export class ChatModule {}
