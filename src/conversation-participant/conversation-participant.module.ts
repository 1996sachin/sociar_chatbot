import { Module, Scope } from '@nestjs/common';
import { ConversationParticipantService } from './conversation-participant.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ConversationParticipant,
  ConversationParticipantSchema,
} from './entities/conversation-participant.entity';
import { UsersModule } from 'src/users/users.module';
import { ConversationsModule } from 'src/conversations/conversations.module';
import { Connection } from 'mongoose';
import { TenantDatabaseModule } from 'src/tenant-database/tenant-database.module';

@Module({
  imports: [
    // MongooseModule.forFeature([
    //   {
    //     name: 'ConversationParticipant',
    //     schema: ConversationParticipantSchema,
    //   },
    // ]),
    TenantDatabaseModule,
    UsersModule,
    ConversationsModule,
  ],
  controllers: [ConversationParticipantController],
  providers: [
    ConversationParticipantService,
    {
      provide: 'ConversationParticipantModel',
      scope: Scope.REQUEST,
      inject: ['TENANT_CONNECTION'],
      useFactory: (conn: Connection) =>
        conn.model(ConversationParticipant.name, ConversationParticipantSchema),
    },
  ],
  exports: [ConversationParticipantService],
})
export class ConversationParticipantModule { }
