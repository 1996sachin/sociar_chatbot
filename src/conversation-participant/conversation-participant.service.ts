import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/base.service';
import {
  ConversationParticipant,
  ConversationParticipantDocument,
} from './entities/conversation-participant.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ConversationParticipantService extends BaseService<ConversationParticipantDocument> {
  constructor(
    @InjectModel(ConversationParticipant.name)
    private readonly ConversationParticipantModel: Model<ConversationParticipantDocument>,
  ) {
    super(ConversationParticipantModel);
  }
}
