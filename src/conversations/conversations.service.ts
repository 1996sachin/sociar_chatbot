import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { BaseService } from 'src/common/service/base.service';
import {
  ChatDocument,
  Conversation,
  ConversationType,
} from './entities/conversation.entity';
import { InjectModel } from '@nestjs/mongoose';
import { UsersService } from 'src/users/users.service';
import { ConversationParticipantService } from 'src/conversation-participant/conversation-participant.service';
import { MessageService } from 'src/messages/messages.service';
import { Types } from 'mongoose';
import {
  MessageStatus,
  MessageTypes,
} from 'src/messages/entities/message.entity';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class ConversationsService extends BaseService<ChatDocument> {
  constructor(
    @InjectModel(Conversation.name)
    private readonly ConversationModel: Model<ChatDocument>,
    @Inject()
    private readonly UserService: UsersService,
    @Inject()
    private readonly conversationPService: ConversationParticipantService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
  ) {
    super(ConversationModel);
  }

  async fetchConversations(user: string, page?: string, limit?: string) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const offset = (pageNumber - 1) * limitNum;
    await new Promise((resolve) => process.nextTick(resolve)); // DO NOT REMOVE THIS
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
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy',
        },
      },
      { $unwind: '$createdBy' },
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
              cond: { $ne: ['$$p.userId', user] },
            },
          },
          unreadCount: {
            $size: {
              $filter: {
                input: '$messages',
                as: 'msg',
                cond: {
                  $and: [
                    { $not: { $in: [user, '$$msg.seenBy'] } },
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
            userId: '$participants.userId',
            name: 1,
            lastMessage: -1,
            updatedAt: -1,
            unreadCount: 1,
            createdBy: '$createdBy.userId',
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

  // this is for renaming the group conversation
  async renameConversation(
    conversationId: string,
    userId: string,
    name: string,
  ) {
    const conversation = await this.getWithCreatedBy(conversationId);

    if (!conversation) {
      throw new WsException('No conversation with such converasiton id found');
    }

    if (
      conversation.participants.length <= 2 &&
      conversation.conversationType === ConversationType.GROUP
    ) {
      throw new WsException(
        'Conversation must have more than two participants inorder to be a group conversation',
      );
    }

    const userDetails = await this.UserService.findWhere({
      userId: userId,
    });

    if (!userDetails) {
      throw new WsException('No such user is part of this conversation');
    }

    const lastMsg = `{${userId}} renamed conversation to {${name}}`;
    await this.update(conversationId, {
      $set: {
        lastMessage: lastMsg,
      },
    });
    const renameLog = await this.messageService.save({
      conversation: conversation._id,
      sender: userDetails[0]._id,
      content: lastMsg,
      messageStatus: MessageStatus.DELIVERED,
      seenBy: [userId],
      messageType: MessageTypes.LOG,
    });

    await this.getRepository().updateOne(
      {
        _id: new Types.ObjectId(conversationId),
      },
      {
        $set: { name: name },
      },
    );
    return {
      conversation,
      message: 'Converastion renamed successfully',
    };
  }

  async leaveConversation(conversationId: string, userId: string) {
    const mongooseUserId = await this.UserService.getRepository().findOne({
      userId: userId,
    });

    if (!mongooseUserId) {
      throw new WsException('No user with such userId found');
    }

    const conversation = await this.getWithCreatedBy(conversationId);
    if (!conversation) {
      throw new WsException('No conversation with such userId found');
    }

    if (!conversation) {
      throw new WsException('No conversation with such userId found');
    }

    const convParticipant = await this.conversationPService.findWhere({
      conversation: conversation._id,
      user: mongooseUserId._id,
    });

    if (!convParticipant.length) {
      throw new WsException(
        'There is no any conversation participants with such conversation id and user id',
      );
    }

    if (conversation.conversationType !== ConversationType.GROUP)
      throw new WsException('User cannot leave peer to peer conversation');
    //TODO: soft delete
    await this.conversationPService.delete(convParticipant[0]._id);
    await this.getRepository().updateOne(
      {
        _id: conversation._id,
      },
      {
        $pull: { participants: convParticipant[0]._id },
      },
    );

    // this is log for leaving the conversation
    const lastMsg = `{${userId}} has left the conversation`;
    const leaveLog = await this.messageService.save({
      conversation: conversation._id,
      sender: mongooseUserId._id,
      content: lastMsg,
      messageStatus: MessageStatus.DELIVERED,
      messageType: MessageTypes.LOG,
      seenBy: [userId],
    });

    let nonAdminUser;
    if (mongooseUserId.id === conversation.createdBy._id.toString()) {
      const nonAdminParticipant = conversation.participants.find(
        (participant) => participant.toString() !== convParticipant[0].id,
      );
      nonAdminUser = await this.conversationPService.getRepository().aggregate([
        {
          $match: {
            _id: nonAdminParticipant,
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
      ]);
    }

    await this.update(conversationId, {
      $set: {
        lastMessage: lastMsg,
        ...(nonAdminUser ? { createdBy: nonAdminUser[0].user._id } : {}),
      },
    });

    return {
      conversation: {
        ...conversation,
        ...(nonAdminUser ? { createdBy: nonAdminUser[0].user } : {}),
      },
      message: 'Conversation left successfully.',
    };
  }

  async removeParticipant(
    conversationId: string,
    userId: string,
    participantId: string,
  ) {
    await new Promise((resolve) => process.nextTick(resolve)); // <- add this

    const conversation = await this.getWithCreatedBy(conversationId);

    if (!conversation) {
      throw new WsException('No conversation with such userId found');
    }

    if (conversation.conversationType !== 'group') {
      throw new WsException(
        'Cannot remove participant from the private conversation',
      );
    }

    const participantUserId = await this.UserService.getRepository().findOne({
      userId: participantId,
    });
    const adminUserId = await this.UserService.getRepository().findOne({
      userId: userId,
    });

    if (!participantUserId || !adminUserId) {
      throw new WsException('No user with such userId found');
    }

    if (!conversation.createdBy._id.equals(adminUserId?._id as string)) {
      throw new WsException('Only admin can remove participants');
    }

    const convParticipant = await this.conversationPService.findWhere({
      conversation: conversation._id,
      user: participantUserId._id,
    });

    if (!convParticipant) {
      throw new WsException(
        'There is no any conversation participants with such conversation id and user id',
      );
    }

    if (userId === participantId) {
      throw new WsException(
        'Admin cannot remove themselve from the conversation',
      );
    }

    await this.conversationPService.delete(convParticipant[0]._id);
    await this.getRepository().updateOne(
      {
        _id: conversation._id,
      },
      {
        $pull: { participants: convParticipant[0]._id },
      },
    );

    // this is log for leaving the conversation
    const lastMsg = `{${participantId}} has been removed from the conversation`;
    await this.update(conversationId, {
      $set: {
        lastMessage: lastMsg,
      },
    });
    const leaveLog = await this.messageService.save({
      conversation: conversation._id,
      sender: adminUserId._id,
      content: `{${participantId}} has been removed from the conversation`,
      messageStatus: MessageStatus.DELIVERED,
      seenBy: [userId],
      messageType: MessageTypes.LOG,
    });

    return {
      conversation,
      message: 'Participant removed successfully.',
    };
  }
  async getWithCreatedBy(conversationId: string) {
    return (
      await this.getRepository().aggregate([
        {
          $match: {
            _id: new Types.ObjectId(conversationId),
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'createdBy',
          },
        },
        { $unwind: '$createdBy' },
      ])
    )[0];
  }
}
