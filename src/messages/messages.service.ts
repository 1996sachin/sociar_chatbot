import {
  Body,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { BaseService } from 'src/base.service';
import { MessageDocument, Message } from './entities/message.entity';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import { ConversationsService } from 'src/conversations/conversations.service';
import { ConversationParticipantService } from 'src/conversation-participant/conversation-participant.service';

@Injectable()
export class MessageService extends BaseService<MessageDocument> {
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
    try {
      let { senderId, recieverId, content, conversationId } = body;

      const conversationExists =
        await this.ConversationService.getRepository().findById(conversationId);

      if (!conversationExists || conversationExists === null) {
        const newConv = await this.ConversationService.getRepository().create({
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

      const newMessage = await this.getRepository().create({
        sender: new Types.ObjectId(senderId),
        content: content,
        conversation: new Types.ObjectId(conversationId),
        messageStatus: 'sent',
      });

      return {
        message: 'Message created successfully',
        data: newMessage,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async fetchMessages(page: string, limit: string, conversationId: string) {
    try {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const offset = (pageNum - 1) * limitNum;

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
        ])
        .exec();

      return {
        message: 'Messages fetched',
        newData,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }
    }
  }
}
