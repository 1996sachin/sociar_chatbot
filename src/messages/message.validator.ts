import { Model } from 'mongoose';
import { notFoundCheck } from 'src/common/rules/not-found';
import { ChatDocument } from 'src/conversations/entities/conversation.entity';
import { UserDocument } from 'src/users/entities/user.entity';
import * as z from 'zod';

export const createMessageValidator = (UserModel: Model<UserDocument>) =>
  z.object({
    senderId: notFoundCheck({
      model: UserModel,
      field: '_id',
      message: 'Sender with this id does not exists',
    }),
    recieverId: notFoundCheck({
      model: UserModel,
      field: '_id',
      message: 'Reciever with this id does not exists',
    }),
    content: z.string().min(1, 'Message cannot be left empty'),
    messageStatus: z.string().optional(),
    conversation: z.string().min(1, 'Conversation id is requried'),
  });

export const updateMessageValidator = z.object({
  content: z.string().min(1, 'Message cannot be left empty'),
});

export const fetchMessageValidator = (ConversationModel: Model<ChatDocument>) =>
  z.object({
    conversationId: notFoundCheck({
      model: ConversationModel,
      field: '_id',
      message: 'Conversation does not exists',
    }),
    page: z.string().optional(),
    limit: z.string().optional(),
  }); // .superRefine(async (data, ctx) => {
//   if (!Types.ObjectId.isValid(data.conversationId)) {
//     ctx.addIssue({
//       path: ['conversationId'],
//       code: 'custom',
//       message: 'conversation id is not a valid object id',
//     });
//     throw new BadRequestException(
//       'conversation id should be a valid object id',
//     );
//   }
//
//   const conversationExists = await ConversationModel.findById(
//     data.conversationId,
//   );
//   if (!conversationExists) {
//     ctx.addIssue({
//       path: ['conversationId'],
//       code: 'custom',
//       message: 'no such conversation with such id found',
//     });
//   }
// });
