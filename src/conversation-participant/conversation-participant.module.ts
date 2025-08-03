import { Module } from '@nestjs/common';
import { ConversationParticipantService } from './conversation-participant.service';
import { ConversationParticipantController } from './conversation-participant.controller';
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
  controllers: [ConversationParticipantController],
  providers: [ConversationParticipantService],
  exports: [MongooseModule],
})
export class ConversationParticipantModule {}
