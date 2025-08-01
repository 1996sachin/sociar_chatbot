import * as z from 'zod';

export const createConversationValidator = z.object({
  senderId: z.string().min(1, 'Sender id is required'),
  recieverId: z.string().min(1, 'Reciever id is required'),
  message: z.array(z.string()),
});

export const updateConversationValidator = z.object({
  message: z.string().min(1, 'Message cannot be left empty'),
});
