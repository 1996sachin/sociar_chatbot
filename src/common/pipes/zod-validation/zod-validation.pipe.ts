import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(
    private readonly schema: ZodSchema,
    private readonly exceptionFactory: (errors: any) => unknown,
  ) {}

  transform(value: unknown) {
    try {
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (err) {
      const messages = err?.issues[0]?.message || err;
      throw this.exceptionFactory(messages);
    }
  }
}
