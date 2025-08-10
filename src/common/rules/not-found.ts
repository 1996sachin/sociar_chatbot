import { z } from 'zod';
import mongoose, { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';

type NotFoundOptions = {
  model: mongoose.Model<any>;
  field?: string;
  message?: string;
};

export function notFoundCheck({ model, field = '_id' }: NotFoundOptions) {
  return z.string().superRefine(async (value, ctx) => {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(
        'Conversation id should be a valid object id',
      );
    }

    const exists = await model.exists({ [field]: value });

    if (!exists) {
      ctx.addIssue({
        code: 'custom',
        message: 'No such resource found',
      });
    }
  });
}
