import { Body, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { BaseService } from 'src/base.service';
import { MessageDocument, Message } from './entities/message.entity';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/users/entities/user.entity';
import {
  ChatDocument,
  Conversation,
} from 'src/conversations/entities/conversation.entity';
import bcrypt from 'bcrypt';
import {
  ConversationParticipant,
  ConversationParticipantDocument,
} from 'src/conversation-participant/entities/conversation-participant.entity';

@Injectable()
export class MessageService extends BaseService<MessageDocument> {
  constructor(
    @InjectModel(Message.name)
    private readonly MessageModel: Model<MessageDocument>,
    @InjectModel(User.name) private readonly UserModel: Model<UserDocument>,
    @InjectModel(Conversation.name)
    private readonly ConversationModel: Model<ChatDocument>,
    @InjectModel(ConversationParticipant.name)
    private readonly ConversationParticipantModel: Model<ConversationParticipantDocument>,
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
        await this.ConversationModel.findById(conversationId);

      const senderDetails = await this.UserModel.findById(senderId);

      if (!conversationExists || conversationExists === null) {
        const newConv = await this.ConversationModel.create({
          participants: [],
          lastMessage: content,
        });

        conversationId = newConv._id as string;
      } else {
        conversationId = conversationExists._id as string;
      }

      const senderParticipant =
        await this.ConversationParticipantModel.findOneAndUpdate(
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
        await this.ConversationParticipantModel.findOneAndUpdate(
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

      await this.ConversationModel.findByIdAndUpdate(
        new Types.ObjectId(conversationId),
        {
          $addToSet: {
            participants: { $each: participantsIds },
          },
          $set: { lastMessage: content },
        },
        { new: true },
      ).exec();

      const hashedMessage = await bcrypt.hash(content, 10);
      const newMessage = await this.MessageModel.create({
        userId: senderDetails?.userId,
        content: hashedMessage,
        conversation: conversationId,
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
      const pageNum = parseInt(page, 10) || 10;
      const limitNum = parseInt(limit, 10) || 10;
      const offset = (pageNum - 1) * limitNum;

      const data = await this.MessageModel.find({
        conversation: new Types.ObjectId(conversationId),
      })
        .skip(offset)
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .exec();

      return {
        message: 'Messages fetched',
        data,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }
    }
  }
}
