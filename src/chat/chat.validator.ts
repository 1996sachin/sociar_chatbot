import { Model } from 'mongoose';
import { notFoundCheck } from 'src/common/rules/not-found.rule';
import { isValidObjectId } from 'src/common/rules/valid-objectid.rule';
import { ChatDocument } from 'src/conversations/entities/conversation.entity';
import { UserDocument } from 'src/users/entities/user.entity';
import * as z from 'zod';

export const initializeChatSchema = z
  .object({
    userId: z.string('Invalid userId'),
  })
  .required();
export type InitializeChatDto = z.infer<typeof initializeChatSchema>;

export const createConversationSchema = z
  .object({
    participants: z
      .array(z.coerce.string())
      .nonempty('Participants cannot be empty')
      .refine((arr) => new Set(arr).size === arr.length, {
        message: 'Participants must not contain duplicate values',
      }),
  })
  .required();
export type CreateConversationDto = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z
  .object({
    conversationId: isValidObjectId(),
    message: z.string(),
  })
  .required();
export type SendMessageDto = z.infer<typeof sendMessageSchema>;

export const seenMessageSchema = z.object({
  conversationId: isValidObjectId(),
});
export type seenMessageDto = z.infer<typeof seenMessageSchema>;

export const addParticipantsSchema = (
  UserModel: Model<UserDocument>,
  ConversationModel: Model<ChatDocument>,
) =>
  z.object({
    participantId: notFoundCheck({
      model: UserModel,
      field: '_id',
      message: 'No user with such user id found',
    }),
    conversationId: notFoundCheck({
      model: ConversationModel,
      field: '_id',
      message: 'No conversation with such conversation id found',
    }),
  });
export type addParticipantsDto = z.infer<
  ReturnType<typeof addParticipantsSchema>
>;
