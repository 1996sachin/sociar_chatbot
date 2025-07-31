import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { BaseService } from 'src/base.service';
import { ChatDocument, Conversation } from './entities/conversation.entity';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class ConversationsService extends BaseService<ChatDocument> {
  constructor(
    @InjectModel(Conversation.name)
    private readonly ConversationModel: Model<ChatDocument>,
  ) {
    super(ConversationModel);
  }
}
