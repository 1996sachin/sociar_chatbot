import {
  BadRequestException,
  Body,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { BaseService } from 'src/base.service';
import { MessageDocument, Message } from './entities/message.entity';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/users/entities/user.entity';
import {
  ChatDocument,
  Conversation,
} from 'src/conversations/entities/conversation.entity';
import bcrypt from 'bcrypt';

@Injectable()
export class MessageService extends BaseService<MessageDocument> {
  constructor(
    @InjectModel(Message.name)
    private readonly MessageModel: Model<MessageDocument>,
    @InjectModel(User.name) private readonly UserModel: Model<UserDocument>,
    @InjectModel(Conversation.name)
    private readonly ConversationModel: Model<ChatDocument>,
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
      let { senderId, recieverId, content, conversationId, messageStatus } =
        body;
      const senderExists = await this.UserModel.findById(senderId);
      const recieverExists = await this.UserModel.findById(recieverId);
      const conversationExists =
        await this.ConversationModel.findById(conversationId);
      console.log(conversationExists);
      console.log(conversationId);

      if (!senderExists) {
        throw new NotFoundException('No such sender found');
      }

      if (!recieverExists) {
        throw new NotFoundException('No such reciever found');
      }

      if (!conversationExists || conversationExists === null) {
        const newConv = await this.ConversationModel.create({
          participants: [senderId, recieverId],
          message: [],
        });

        conversationId = newConv._id as string;
      } else {
        conversationId = conversationExists._id as string;
      }
      const hashedMessage = await bcrypt.hash(content, 10);
      const newMessage = await this.MessageModel.create({
        sender: senderId,
        reciever: recieverId,
        content: hashedMessage,
        conversation: conversationId,
        messageStatus: 'sent',
      });

      await this.ConversationModel.findByIdAndUpdate(conversationId, {
        $push: { message: hashedMessage },
      });

      return {
        message: 'Message created successfully',
        data: newMessage,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
    }
  }
}
