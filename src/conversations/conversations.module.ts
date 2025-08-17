import { forwardRef, Module, Scope } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Conversation,
  ConversationSchema,
} from './entities/conversation.entity';
import { DatabaseService } from 'src/common/database/database.service';
import { UsersModule } from 'src/users/users.module';
import { Connection } from 'mongoose';
import { TenantDatabaseModule } from 'src/tenant-database/tenant-database.module';
import { UsersService } from 'src/users/users.service';
import { ConversationParticipantModule } from 'src/conversation-participant/conversation-participant.module';
import { MessagesModule } from 'src/messages/messages.module';

@Module({
  imports: [
    // MongooseModule.forFeature([
    //   { name: 'Conversation', schema: ConversationSchema },
    // ]),
    TenantDatabaseModule,
    UsersModule,
    ConversationParticipantModule,
    forwardRef(() => MessagesModule)
  ],
  controllers: [ConversationsController],
  providers: [
    DatabaseService,
    ConversationsService, UsersService,
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
