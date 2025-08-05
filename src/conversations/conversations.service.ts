import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { BaseService } from 'src/base.service';
import { ChatDocument, Conversation } from './entities/conversation.entity';
import { InjectModel } from '@nestjs/mongoose';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class ConversationsService extends BaseService<ChatDocument> {
  constructor(
    @InjectModel(Conversation.name)
    private readonly ConversationModel: Model<ChatDocument>,
    @Inject()
    private readonly UserService: UsersService,
  ) {
    super(ConversationModel);
  }

  async fetchConversations(page: string, limit: string, user: string) {
    try {
      const pageNumber = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNum;
      const userExists = await this.UserService.getRepository().findOne({
        userId: user,
      });

      if (!userExists) {
        throw new NotFoundException('No user with such userid found');
      }

      const basePipeline = [
        {
          $lookup: {
            from: 'conversationparticipants',
            localField: 'participants',
            foreignField: '_id',
            as: 'participantDetails',
          },
        },
        { $unwind: '$participantDetails' },
        {
          $lookup: {
            from: 'users',
            localField: 'participantDetails.user',
            foreignField: '_id',
            as: 'participantDetails.userDetails',
          },
        },
        { $unwind: '$participantDetails.userDetails' },
        {
          $match: {
            'participantDetails.userDetails.userId': {
              $ne: user,
              $exists: true,
            },
          },
        },
      ];

      const totalCountResult = await this.getRepository()
        .aggregate([...basePipeline, { $count: 'total' }])
        .exec();

      const totalCount = totalCountResult[0]?.total || 0;
      const totalPages = Math.ceil(totalCount / limitNum);

      const newData = await this.getRepository()
        .aggregate([
          ...basePipeline,
          {
            $project: {
              userId: '$participantDetails.userDetails.userId',
              lastMessage: 1,
              updatedAt: 1,
            },
          },
        ])
        .skip(offset)
        .limit(limitNum)
        .exec();

      return {
        data: newData,
        pagination: {
          totalCount,
          totalPages,
          currentPage: pageNumber,
          perPage: limitNum,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }
    }
  }
}
