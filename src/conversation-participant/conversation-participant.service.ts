import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/base.service';
import {
  ConvPart,
  ConvPartDocument,
} from './entities/conversation-participant.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ConversationParticipantService extends BaseService<ConvPartDocument> {
  constructor(
    @InjectModel(ConvPart.name)
    private readonly ConvPartModel: Model<ConvPartDocument>,
  ) {
    super(ConvPartModel);
  }
}
