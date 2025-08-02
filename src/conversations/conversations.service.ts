import { Injectable, InternalServerErrorException } from '@nestjs/common';
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

  async fetchConversations(page: string, limit: string) {
    try {
      const pageNumber = parseInt(page, 10) || 10;
      const limitNum = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNum;

      const data = await this.ConversationModel.find({})
        .skip(offset)
        .limit(limitNum)
        .exec();

      if (Object.keys(data).length === 0) {
        return {
          message: 'No conversations has been done yet.',
        };
      }

      return {
        message: 'Conversations fetched successfully',
        data,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }
    }
  }
}
