import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationSchema } from './entities/conversation.entity';
import { DatabaseService } from 'src/common/database/database.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Conversation', schema: ConversationSchema },
    ]),
    UsersModule,
  ],
  controllers: [ConversationsController],
  providers: [DatabaseService, ConversationsService],
  exports: [MongooseModule, ConversationsService],
})
export class ConversationsModule { }
