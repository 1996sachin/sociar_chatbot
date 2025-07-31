import * as z from 'zod';

export const createMessageValidator = z.object({
  senderId: z.string().min(1, 'Sender id is required'),
  recieverId: z.string().min(1, 'Reciever id is required'),
  message: z.string().min(1, 'Message cannot be left empty'),
  status: z.string(),
});

export const updateMessageValidator = z.object({
  message: z.string().min(1, 'Message cannot be left empty'),
});
