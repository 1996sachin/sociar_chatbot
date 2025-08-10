import { Module, Scope } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Conversation,
  ConversationSchema,
} from './entities/conversation.entity';
import { DatabaseService } from 'src/database/database.service';
import { UsersModule } from 'src/users/users.module';
import { Connection } from 'mongoose';
import { TenantDatabaseModule } from 'src/tenant-database/tenant-database.module';

@Module({
  imports: [
    // MongooseModule.forFeature([
    //   { name: 'Conversation', schema: ConversationSchema },
    // ]),
    TenantDatabaseModule,
    UsersModule,
  ],
  controllers: [ConversationsController],
  providers: [
    DatabaseService,
    ConversationsService,
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
