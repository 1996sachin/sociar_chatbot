import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { ConversationsModule } from './conversations/conversations.module';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagesModule } from './messages/messages.module';
import { UsersModule } from './users/users.module';
import { ConversationParticipantModule } from './conversation-participant/conversation-participant.module';
import { ChatModule } from './chat/chat.module';
import { TenantDatabaseModule } from './tenant-database/tenant-database.module';

@Module({
  imports: [
    ConversationsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.DATABASE_URL!),
    TenantDatabaseModule,
    MessagesModule,
    UsersModule,
    ConversationParticipantModule,
    ChatModule,
    TenantDatabaseModule,
  ],
  providers: [AppService],
})
export class AppModule { }
