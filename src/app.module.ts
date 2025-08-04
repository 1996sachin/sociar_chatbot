import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConversationsModule } from './conversations/conversations.module';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagesModule } from './messages/messages.module';
import { UsersModule } from './users/users.module';
import { ConversationParticipantModule } from './conversation-participant/conversation-participant.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConversationsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.DATABASE_URL!),
    MessagesModule,
    UsersModule,
    ConversationParticipantModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
