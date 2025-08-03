import { Module } from '@nestjs/common';
import { ConversationParticipantService } from './conversation-participant.service';
import { ConversationParticipantController } from './conversation-participant.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationParticipantSchema } from './entities/conversation-participant.entity';
import { UsersModule } from 'src/users/users.module';
import { ConversationsModule } from 'src/conversations/conversations.module';
import { MessagesModule } from 'src/messages/messages.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ConvPart', schema: ConversationParticipantSchema },
    ]),
    UsersModule,
    ConversationsModule,
    MessagesModule,
  ],
  controllers: [ConversationParticipantController],
  providers: [ConversationParticipantService],
  exports: [MongooseModule],
})
export class ConversationParticipantModule {}
