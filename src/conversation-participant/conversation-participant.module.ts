import { Module } from '@nestjs/common';
import { ConversationParticipantService } from './conversation-participant.service';
import { ConversationParticipantController } from './conversation-participant.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ConvPart,
  ConvPartSchema,
} from './entities/conversation-participant.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConvPart.name, schema: ConvPartSchema },
    ]),
  ],
  controllers: [ConversationParticipantController],
  providers: [ConversationParticipantService],
})
export class ConvPartModule { }
