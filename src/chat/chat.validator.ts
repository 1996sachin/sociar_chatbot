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
export type createConversationDto = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z
  .object({
    conversationId: isValidObjectId(),
    message: z.string(),
  })
  .required();
export type sendMessageDto = z.infer<typeof sendMessageSchema>;
