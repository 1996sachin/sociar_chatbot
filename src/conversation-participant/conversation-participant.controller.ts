import { Controller } from '@nestjs/common';
import { ConversationParticipantService } from './conversation-participant.service';

@Controller('conversation-participant')
export class ConversationParticipantController {
  constructor(
    private readonly conversationParticipantService: ConversationParticipantService,
  ) {}
}
