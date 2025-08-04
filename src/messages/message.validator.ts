import { Model } from 'mongoose';
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
