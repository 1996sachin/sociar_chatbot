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
    participantIds: z.array(z.string()),
    conversationId: isValidObjectId(),
  });
export type addParticipantsDto = z.infer<
  ReturnType<typeof addParticipantsSchema>
>;

export const leaveConversationSchema = (
  ConversationModel: Model<ChatDocument>,
) =>
  z.object({
    userId: z.string(),
    conversationId: isValidObjectId(),
  });
export type leaveConversationDto = z.infer<
  ReturnType<typeof leaveConversationSchema>
>;

export const removeParticipantSchema = (
  ConversationModel: Model<ChatDocument>,
) =>
  z.object({
    participantId: z.string(),
    conversationId: isValidObjectId(),
  });
export type removeParticipantDto = z.infer<
  ReturnType<typeof removeParticipantSchema>
>;

export const renameConversationSchema = (
  ConversationModel: Model<ChatDocument>,
) =>
  z.object({
    name: z.string().min(1, 'Conversation name cannot be left empty'),
    conversationId: isValidObjectId(),
  });

export type renameConversationDto = z.infer<
  ReturnType<typeof renameConversationSchema>
>;
