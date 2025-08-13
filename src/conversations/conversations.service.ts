import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { BaseService } from 'src/common/service/base.service';
import { ChatDocument, Conversation } from './entities/conversation.entity';
import { InjectModel } from '@nestjs/mongoose';
import { UsersService } from 'src/users/users.service';
import { ConversationParticipantService } from 'src/conversation-participant/conversation-participant.service';
import { MessageService } from 'src/messages/messages.service';
import { MessageStatus } from 'src/messages/entities/message.entity';

@Injectable()
export class ConversationsService extends BaseService<ChatDocument> {
  constructor(
    @InjectModel(Conversation.name)
    private readonly ConversationModel: Model<ChatDocument>,
    @Inject()
    private readonly UserService: UsersService,
    @Inject()
    private readonly conversationPService: ConversationParticipantService,
    @Inject()
    private readonly messageService: MessageService
  ) {
    super(ConversationModel);
  }

  async fetchConversations(user: string, page?: string, limit?: string) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const offset = (pageNumber - 1) * limitNum;
    const userExists = await this.UserService.findWhere({
      userId: user,
    });

    if (!userExists || userExists.length === 0) {
      throw new NotFoundException('no user with such userid found');
    }

    const basePipeline = [
      {
        $match: { lastMessage: { $ne: undefined } },
      },
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
          as: 'participantDetails.userInfo',
        },
      },
      { $unwind: '$participantDetails.userInfo' },
      {
        $lookup: {
          from: 'messages',
          localField: '_id',
          foreignField: 'conversation',
          as: 'messages',
        },
      },
      {
        $group: {
          _id: '$_id',
          doc: { $first: '$$ROOT' },
          participants: {
            $push: {
              participantId: '$participantDetails._id',
              userId: '$participantDetails.userInfo.userId',
              userInfo: '$participantDetails.userInfo',
            },
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ['$doc', { participants: '$participants' }],
          },
        },
      },
      {
        $match: { 'participants.userId': user },
      },
      {
        // Find latest "seen" timestamp for user '2'
        $addFields: {
          lastSeenDate: {
            $getField: {
              field: 'createdAt',
              input: {
                $first: {
                  $filter: {
                    input: '$messages',
                    as: 'm',
                    cond: { $in: [user, '$$m.seenBy'] },
                  },
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          otherParticipants: {
            $filter: {
              input: '$participants',
              as: 'p',
              cond: { $ne: ['$$p.userId', '2'] },
            },
          },
          unreadCount: {
            $size: {
              $filter: {
                input: '$messages',
                as: 'msg',
                cond: {
                  $and: [
                    { $not: { $in: ['2', '$$msg.seenBy'] } },
                    {
                      $gt: ['$$msg.createdAt', '$lastSeenDate'],
                    },
                  ],
                },
              },
            },
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
            userId: '$otherParticipants.userId',
            lastMessage: -1,
            updatedAt: -1,
            unreadCount: 1,
          },
        },
        { $sort: { updatedAt: -1 } },
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
  }

  async updateConversaton(conversationId: string, data: { name: string }) {
    const isConversationGroup = await this.find(conversationId);

    if (isConversationGroup!.participants.length <= 2) {
      throw new BadRequestException(
        'Conversation must have more than two participants inorder to be a group conversation',
      );

    }
  }

  async leaveConversation(conversationId: string, userId: string) {
    console.log("conversationId", conversationId);
    console.log("userId", userId);

    const mongooseUserId = await this.UserService.getRepository().findOne({ userId: userId })

    console.log("mongooseUserId", mongooseUserId);


    if (!mongooseUserId) {
      throw new BadRequestException('No user with such userId found')
    }

    const conversation = await this.getRepository().findOne({ _id: conversationId })

    if (!conversation) {
      throw new BadRequestException('No conversation with such userId found')
    }

    const convParticipant = await this.conversationPService.findWhere(
      {
        conversation: conversation._id,
        user: mongooseUserId._id
      }
    )

    if (!convParticipant) {
      throw new BadRequestException('There is no any conversation participants with such conversation id and user id')
    }

    console.log("convParticipant[0]._id", convParticipant[0]._id);


    if (conversation.conversationType === 'group') {
      await this.conversationPService.delete(convParticipant[0]._id)
      await this.getRepository().updateOne({
        _id: conversation._id
      },
        {
          $pull: { participants: convParticipant[0]._id }
        }
      )


      console.log("convParticipant[0]._id", convParticipant[0]._id);

      // this is log for leaving the conversation
      const leaveLog = await this.messageService.save({
        conversation: conversation._id,
        sender: mongooseUserId._id,
        content: `{${userId}} has left the conversation`,
        messageStatus: 'delivered',
        messageType: 'log',
      })

      // this if for latest msg of the conversation regarding the user left
      await this.updateWhere(
        {
          _id: conversation._id
        },
        {
          lastMessage: leaveLog.content
        }
      )

      return {
        message: "Conversation left successfully."
      }
    } else {
      throw new BadRequestException('User cannot leave peer to peer conversation')
    }
  }
}
