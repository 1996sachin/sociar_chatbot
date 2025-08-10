import { BadRequestException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { ChatDocument } from 'src/conversations/entities/conversation.entity';
import { UserDocument } from 'src/users/entities/user.entity';
import * as z from 'zod';

export const createMessageValidator = (UserModel: Model<UserDocument>) =>
  z
    .object({
      senderId: z.string().min(1, 'Sender id is required'),
      recieverId: z.string().min(1, 'Reciver id is required'),
      content: z.string().min(1, 'Message cannot be left empty'),
      messageStatus: z.string().optional(),
      conversation: z.string().min(1, 'Conversation id is requried'),
    })
    .superRefine(async (data, ctx) => {
      const senderExist = await UserModel.findById(data.senderId);
      if (!senderExist) {
        ctx.addIssue({
          path: ['sender'],
          code: 'custom',
          message: 'sender not found',
        });
      }

      const recieverExists = await UserModel.findById(data.recieverId);
      if (!recieverExists) {
        ctx.addIssue({
          path: ['reciever'],
          code: 'custom',
          message: 'reciever not found',
        });
      }
    });

export const updateMessageValidator = z.object({
  content: z.string().min(1, 'Message cannot be left empty'),
});

export const fetchMessageValidator = (ConversationModel: Model<ChatDocument>) =>
  z
    .object({
      conversationId: z.string().min(1, 'Conversation id is required'),
      page: z.string().optional(),
      limit: z.string().optional(),
    })
    .superRefine(async (data, ctx) => {
      if (!Types.ObjectId.isValid(data.conversationId)) {
        ctx.addIssue({
          path: ['conversationId'],
          code: 'custom',
          message: 'conversation id is not a valid object id',
        });
        throw new BadRequestException(
          'conversation id should be a valid object id',
        );
      }

      const conversationExists = await ConversationModel.findById(
        data.conversationId,
      );
      if (!conversationExists) {
        ctx.addIssue({
          path: ['conversationId'],
          code: 'custom',
          message: 'no such conversation with such id found',
        });
      }
    });
