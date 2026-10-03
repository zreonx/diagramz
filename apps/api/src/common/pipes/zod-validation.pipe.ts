import { PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata?: ArgumentMetadata) {
    // Only validate the request body payload.
    // Skip 'param', 'query', and custom decorators like @CurrentUser()
    if (metadata && metadata.type !== 'body') {
      return value;
    }

    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => `${e.path.join('.') || 'root'}: ${e.message}`);
        throw new BadRequestException({
          statusCode: 400,
          error: 'Validation Error',
          message: messages.join('; '),
          details: messages,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
