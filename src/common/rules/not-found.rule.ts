import { z } from 'zod';
import mongoose from 'mongoose';

type NotFoundOptions = {
  model: mongoose.Model<any>;
  field: string;
  message?: string;
};

export function notFoundCheck({ model, field = '_id' }: NotFoundOptions) {
  return z.string().superRefine(async (value, ctx) => {
    const exists = await model.exists({ [field]: value });

    if (!exists) {
      ctx.addIssue({
        code: 'custom',
        message: 'No such resource found',
      });
    }
  });
}
