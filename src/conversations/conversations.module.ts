import { forwardRef, Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationSchema } from './entities/conversation.entity';
import { DatabaseService } from 'src/common/database/database.service';
import { UsersModule } from 'src/users/users.module';
import { UsersService } from 'src/users/users.service';
import { ConversationParticipantModule } from 'src/conversation-participant/conversation-participant.module';
import { MessagesModule } from 'src/messages/messages.module';
import { ConversationsGateway } from './conversations.gateway';
import { ChatService } from 'src/chat/chat.service';
import { SocketModule } from 'src/common/socket/socket.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Conversation', schema: ConversationSchema },
    ]),
    UsersModule,
    ConversationParticipantModule,
    forwardRef(() => MessagesModule),
    SocketModule
  ],
  controllers: [ConversationsController],
  providers: [DatabaseService, ConversationsService, UsersService, ChatService, ConversationsGateway],
  exports: [MongooseModule, ConversationsService],
})
export class ConversationsModule { }
