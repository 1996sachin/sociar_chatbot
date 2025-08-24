import { forwardRef, Module, Scope } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import {
  Conversation,
  ConversationSchema,
} from './entities/conversation.entity';
import { UsersModule } from 'src/users/users.module';
import { Connection } from 'mongoose';
import { TenantDatabaseModule } from 'src/tenant-database/tenant-database.module';
import { ConversationParticipantModule } from 'src/conversation-participant/conversation-participant.module';
import { MessagesModule } from 'src/messages/messages.module';
import { ConversationsGateway } from './conversations.gateway';
import { SocketModule } from 'src/common/socket/socket.module';

@Module({
  imports: [
    // MongooseModule.forFeature([
    //   { name: 'Conversation', schema: ConversationSchema },
    // ]),
    TenantDatabaseModule,
    UsersModule,
    ConversationParticipantModule,
    forwardRef(() => MessagesModule),
    SocketModule,
  ],
  controllers: [ConversationsController],
  providers: [
    // DatabaseService,
    ConversationsService,
    // UsersService,
    // ChatService,
    ConversationsGateway,
    {
      provide: 'ConversationModel',
      scope: Scope.REQUEST,
      inject: ['TENANT_CONNECTION'],
      useFactory: (conn: Connection) =>
        conn.model(Conversation.name, ConversationSchema),
    },
  ],
  exports: [ConversationsService],
})
export class ConversationsModule {}
