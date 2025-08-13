import { Module } from '@nestjs/common';
import { ConversationParticipantService } from './conversation-participant.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationParticipantSchema } from './entities/conversation-participant.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'ConversationParticipant',
        schema: ConversationParticipantSchema,
      },
    ]),
  ],
  providers: [ConversationParticipantService],
  exports: [MongooseModule, ConversationParticipantService],
})
export class ConversationParticipantModule { }
