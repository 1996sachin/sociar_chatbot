import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { SocketStore } from './socket.store';
import { ConversationsModule } from 'src/conversations/conversations.module';
import { ConversationParticipantModule } from 'src/conversation-participant/conversation-participant.module';
import { MessagesModule } from 'src/messages/messages.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    ConversationsModule,
    ConversationParticipantModule,
    MessagesModule,
    UsersModule,
  ],
  providers: [ChatGateway, ChatService, SocketStore],
})
export class ChatModule {}
