import { Module } from '@nestjs/common';
import { ConversationParticipantService } from './conversation-participant.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationParticipantSchema } from './entities/conversation-participant.entity';
import { UsersModule } from 'src/users/users.module';
import { ConversationsModule } from 'src/conversations/conversations.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'ConversationParticipant',
        schema: ConversationParticipantSchema,
      },
    ]),
    UsersModule,
    ConversationsModule,
  ],
  providers: [ConversationParticipantService],
  exports: [MongooseModule, ConversationParticipantService],
})
export class ConversationParticipantModule {}
