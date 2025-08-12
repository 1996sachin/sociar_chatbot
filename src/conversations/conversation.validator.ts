import { Model } from 'mongoose';
import * as z from 'zod';
import { ChatDocument } from './entities/conversation.entity';
import { notFoundCheck } from 'src/common/rules/not-found.rule';
import { isValidObjectId } from 'src/common/rules/valid-objectid.rule';

export const createConversationValidator = z.object({
  senderId: z.string().min(1, 'Sender id is required'),
  conversationParticipant: z
    .string()
    .min(1, 'ConversationParticipant id is required'),
});

export const updateConversationValidator = (
  ConversationModel: Model<ChatDocument>,
) =>
  z.object({
    conversationId: isValidObjectId().pipe(
      notFoundCheck({
        model: ConversationModel,
        field: '_id',
        message: 'Conversation does not exists',
      }),
    ),
  });
