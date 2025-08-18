import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ConversationsModule } from 'src/conversations/conversations.module';
import { ConversationParticipantModule } from 'src/conversation-participant/conversation-participant.module';
import { MessagesModule } from 'src/messages/messages.module';
import { UsersModule } from 'src/users/users.module';
import { SocketModule } from 'src/common/socket/socket.module';
import { TenantDatabaseModule } from 'src/tenant-database/tenant-database.module';

@Module({
  imports: [
    SocketModule,
    TenantDatabaseModule,
    ConversationsModule,
    ConversationParticipantModule,
    MessagesModule,
    UsersModule,
  ],
  providers: [ChatGateway, ChatService],
})
export class ChatModule { }
