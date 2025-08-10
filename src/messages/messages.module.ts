import { Module, Scope } from '@nestjs/common';
import { MessageService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './entities/message.entity';
import { UsersModule } from 'src/users/users.module';
import { ConversationsModule } from 'src/conversations/conversations.module';
import { ConversationParticipantModule } from 'src/conversation-participant/conversation-participant.module';
import { Connection } from 'mongoose';
import { TenantDatabaseModule } from 'src/tenant-database/tenant-database.module';

@Module({
  imports: [
    // MongooseModule.forFeature([{ name: 'Message', schema: MessageSchema }]),
    TenantDatabaseModule,
    UsersModule,
    ConversationsModule,
    ConversationParticipantModule,
  ],
  controllers: [MessagesController],
  providers: [
    MessageService,
    {
      provide: 'MessageModel',
      scope: Scope.REQUEST,
      inject: ['TENANT_CONNECTION'],
      useFactory: (conn: Connection) => conn.model(Message.name, MessageSchema),
    },
  ],
  exports: [MessageService],
})
export class MessagesModule {}
