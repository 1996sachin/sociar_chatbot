import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/service/base.service';
import {
  ConversationParticipant,
  ConversationParticipantDocument,
} from './entities/conversation-participant.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';

@Injectable()
export class ConversationParticipantService extends BaseService<ConversationParticipantDocument> {
  constructor(
    @InjectModel(ConversationParticipant.name)
    private readonly ConversationParticipantModel: Model<ConversationParticipantDocument>,
  ) {
    super(ConversationParticipantModel);
  }

  async getParticipantsExcludingSelf(conversationId, userId) {
    const participants = await this.getRepository().aggregate([
      {
        $match: {
          conversation: new Types.ObjectId(conversationId),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetail',
        },
      },
      {
        $match: {
          'userDetail.userId': { $ne: userId },
        },
      },
    ]);

    return participants;
  }

  async getParticipantsUserDetails(conversationId) {
    const participants = await this.getRepository().aggregate([
      {
        $match: {
          conversation: new Types.ObjectId(conversationId),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetail',
        },
      },
    ]);

    return participants;
  }

  async getPastConversation(allParticipants) {
    const conversationParticipants = await this.getRepository().aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: '$userDetails' },
      {
        $group: {
          _id: '$conversation',
          userDetails: { $push: '$userDetails' },
          userIds: { $addToSet: '$userDetails.userId' },
        },
      },
      { $match: { $expr: { $setEquals: ['$userIds', allParticipants] } } },
      {
        $project: {
          _id: 0,
          conversation: '$_id',
          userDetails: 1,
          userIds: 1,
        },
      },
    ]);
    return conversationParticipants;
  }
}
