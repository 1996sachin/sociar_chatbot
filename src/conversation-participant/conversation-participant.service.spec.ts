import { Test, TestingModule } from '@nestjs/testing';
import { ConversationParticipantService } from './conversation-participant.service';

describe('ConversationParticipantService', () => {
  let service: ConversationParticipantService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConversationParticipantService],
    }).compile();

    service = module.get<ConversationParticipantService>(
      ConversationParticipantService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
