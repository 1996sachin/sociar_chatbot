import { Body, Inject, Injectable, Logger } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { BaseService } from 'src/common/service/base.service';
import { MessageDocument, Message } from './entities/message.entity';
import { InjectModel } from '@nestjs/mongoose';
import { ConversationsService } from 'src/conversations/conversations.service';
import { ConversationParticipantService } from 'src/conversation-participant/conversation-participant.service';
import { CustomLogger } from 'src/config/custom.logger';

const logger = new CustomLogger('Message Service');

@Injectable()
export class MessageService extends BaseService<MessageDocument> {
  private readonly logger = new Logger(Message.name);
  constructor(
    @InjectModel(Message.name)
    private readonly MessageModel: Model<MessageDocument>,
    @Inject()
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
    logger.debug(body);

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

    logger.logRequest(requestBody);

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
          $sort: { updatedAt: -1 },
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
    logger.logResponse(newData);
    return {
      message: 'Messages fetched',
      data: {
        conversation: conversationId,
        messages: newData,
      },
    };
  }
}
