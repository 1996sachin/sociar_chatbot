import * as z from 'zod';

export const createMessageValidator = z.object({
  senderId: z.string().min(1, 'Sender id is required'),
  recieverId: z.string().min(1, 'Reciever id is required'),
  content: z.string().min(1, 'Message cannot be left empty'),
  messageStatus: z.string().optional(),
});

export const updateMessageValidator = z.object({
  content: z.string().min(1, 'Message cannot be left empty'),
});
