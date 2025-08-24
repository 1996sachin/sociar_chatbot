import { z } from 'zod';
import { Types } from 'mongoose';

export function isValidObjectId() {
  return z.string().superRefine((value, ctx) => {
    if (!Types.ObjectId.isValid(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Conversation id must be a valid object id',
      });
    }
  });
}
