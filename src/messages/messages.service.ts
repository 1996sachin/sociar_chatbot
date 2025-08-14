import { Body, forwardRef, Inject, Injectable } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { BaseService } from 'src/common/service/base.service';
import {
  MessageDocument,
  Message,
  MessageStatus,
} from './entities/message.entity';
import { InjectModel } from '@nestjs/mongoose';
import { ConversationsService } from 'src/conversations/conversations.service';
import { ConversationParticipantService } from 'src/conversation-participant/conversation-participant.service';

@Injectable()
export class MessageService extends BaseService<MessageDocument> {
  constructor(
    @InjectModel(Message.name)
    private readonly MessageModel: Model<MessageDocument>,
    @Inject(forwardRef(() => ConversationsService))
    private readonly ConversationService: ConversationsService,
    @Inject()
    private readonly ConversationParticipantService: ConversationParticipantService,
  ) {
    super(MessageModel);
  }

  async createMessage(
    @Body()
    body: {
      senderId: string;
      recieverId: string;
      content: string;
      conversationId?: string;
      messageStatus?: string;
    },
  ) {
    let { senderId, recieverId, content, conversationId } = body;

    const conversationExists =
      await this.ConversationService.find(conversationId);

    if (!conversationExists || conversationExists === null) {
      const newConv = await this.ConversationService.save({
        participants: [],
        lastMessage: content,
      });
      conversationId = newConv._id as string;
    } else {
      conversationId = conversationExists._id as string;
    }

    const senderParticipant =
      await this.ConversationParticipantService.getRepository().findOneAndUpdate(
        {
          conversation: new Types.ObjectId(conversationId),
          user: new Types.ObjectId(senderId),
        },
        {
          conversation: new Types.ObjectId(conversationId),
          user: new Types.ObjectId(senderId),
        },
        { upsert: true, new: true },
      );

    const receiverParticipant =
      await this.ConversationParticipantService.getRepository().findOneAndUpdate(
        {
          conversation: new Types.ObjectId(conversationId),
          user: new Types.ObjectId(recieverId),
        },
        {
          conversation: new Types.ObjectId(conversationId),
          user: new Types.ObjectId(recieverId),
        },
        { upsert: true, new: true },
      );

    const conversationParticipant = [senderParticipant, receiverParticipant];
    const participantsIds = conversationParticipant.map((p) => p._id);

    await this.ConversationService.getRepository()
      .findByIdAndUpdate(
        new Types.ObjectId(conversationId),
        {
          $addToSet: {
            participants: { $each: participantsIds },
          },
          $set: { lastMessage: content },
        },
        { new: true },
      )
      .exec();

    const newMessage = await this.save({
      sender: new Types.ObjectId(senderId),
      content: content,
      conversation: new Types.ObjectId(conversationId),
      messageStatus: 'sent',
    });

    return {
      message: 'Message created successfully',
      data: newMessage,
    };
  }

  async fetchMessages(conversationId: string, page?: string, limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const offset = (pageNum - 1) * limitNum;

    const requestBody = {
      conversationId,
      page,
      limit,
    };

    await this.getRepository().updateMany(
      {
        conversation: new Types.ObjectId(conversationId),
        messageStatus: { $ne: 'delivered' },
      },
      {
        $set: { messageStatus: 'delivered' },
      },
    );

    const newData = await this.getRepository()
      .aggregate([
        {
          $match: { conversation: new Types.ObjectId(conversationId) },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'sender',
            foreignField: '_id',
            as: 'userId',
          },
        },
        {
          $addFields: {
            sender: {
              $arrayElemAt: ['$userId.userId', 0],
            },
          },
        },
        {
          $unset: 'userId', // Remove the lookup field
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $skip: offset,
        },
        {
          $limit: limitNum,
        },
        { $project: { conversation: 0 } },
      ])
      .exec();
    //TODO: Later take the conversationInfo from the validator rule
    const conversationInfo =
      await this.ConversationService.find(conversationId);
    const group = conversationInfo!.participants.length > 2;
    return {
      message: 'Messages fetched',
      data: {
        conversation: conversationId,
        messages: newData.map((data) => ({ ...data, group })),
      },
    };
  }

  async seenMessage(conversationId: string, userId: string) {

    console.log("conversationId", conversationId);
    console.log("userId", userId);

    // fetching the messages in descending order to pick the latest message
    const messages = await this
      .getRepository()
      .find({ conversation: new Types.ObjectId(conversationId) })
      .sort({ createdAt: -1 })
      .lean();

    console.log("messages", messages);


    // function rto remove the seen status from the previous message after seeing the latest message
    await this.getRepository().updateMany(
      {
        conversation: new Types.ObjectId(conversationId),
        _id: { $ne: messages[0]._id }
      },
      {
        $pull: { seenBy: userId }
      }
    )

    // adding the seen status on the latest message of a particular user
    const messagesAfterSeen = await this.getRepository().findByIdAndUpdate(
      {
        _id: messages[0]._id
      },
      {
        $addToSet: { seenBy: userId, messageStatus: MessageStatus.SEEN },
      },
      { new: true }
    )

    return messagesAfterSeen

  }
}
