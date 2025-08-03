import * as z from 'zod';

export const createConversationValidator = z.object({
  senderId: z.string().min(1, 'Sender id is required'),
  conversationParticipant: z
    .string()
    .min(1, 'ConversationParticipant id is required'),
});

export const updateConversationValidator = z.object({
  conversationParticipant: z
    .string()
    .min(1, 'ConversationParticipant id is required'),
});
