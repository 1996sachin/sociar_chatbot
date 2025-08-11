import { isValidObjectId } from 'src/common/rules/valid-objectid.rule';
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
      .nonempty('Participants cannot be empty'),
  })
  .required();
export type CreateConversationDto = z.infer<typeof createConversationSchema>;
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
