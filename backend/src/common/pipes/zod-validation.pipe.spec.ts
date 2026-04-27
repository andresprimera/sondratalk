import { BadRequestException } from '@nestjs/common';
import { z } from 'zod/v4';
import { ZodValidationPipe } from './zod-validation.pipe';

const testSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
});

describe('ZodValidationPipe', () => {
  let pipe: ZodValidationPipe;

  beforeEach(() => {
    pipe = new ZodValidationPipe(testSchema);
  });

  it('should return parsed data when validation succeeds on body', () => {
    const input = { name: 'John', email: 'john@example.com' };
    const result = pipe.transform(input, { type: 'body', metatype: Object });
    expect(result).toEqual(input);
  });

  it('should return parsed data when validation succeeds on query', () => {
    const input = { name: 'John', email: 'john@example.com' };
    const result = pipe.transform(input, { type: 'query', metatype: Object });
    expect(result).toEqual(input);
  });

  it('should strip unknown fields from validated data', () => {
    const input = { name: 'John', email: 'john@example.com', extra: 'field' };
    const result = pipe.transform(input, { type: 'body', metatype: Object });
    expect(result).toEqual({ name: 'John', email: 'john@example.com' });
  });

  it('should pass through value unchanged for param metadata type', () => {
    const value = 'some-id';
    const result = pipe.transform(value, { type: 'param', metatype: String });
    expect(result).toBe('some-id');
  });

  it('should pass through value unchanged for custom metadata type', () => {
    const value = { anything: true };
    const result = pipe.transform(value, { type: 'custom', metatype: Object });
    expect(result).toBe(value);
  });

  it('should throw BadRequestException when validation fails', () => {
    const input = { name: '', email: 'not-an-email' };
    expect(() =>
      pipe.transform(input, { type: 'body', metatype: Object }),
    ).toThrow(BadRequestException);
  });

  it('should include field-level errors in the exception response', () => {
    const input = { name: '', email: 'bad' };
    try {
      pipe.transform(input, { type: 'body', metatype: Object });
      fail('Expected BadRequestException');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as Record<
        string,
        unknown
      >;
      expect(response['message']).toBe('Validation failed');
      expect(response['errors']).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: expect.any(String), message: expect.any(String) }),
        ]),
      );
    }
  });

  it('should map nested field paths with dot notation', () => {
    const nestedSchema = z.object({
      address: z.object({
        city: z.string().min(1),
      }),
    });
    const nestedPipe = new ZodValidationPipe(nestedSchema);

    try {
      nestedPipe.transform({ address: { city: '' } }, { type: 'body', metatype: Object });
      fail('Expected BadRequestException');
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as Record<
        string,
        unknown
      >;
      const errors = response['errors'] as Array<{ field: string; message: string }>;
      expect(errors.some((e) => e.field === 'address.city')).toBe(true);
    }
  });
});
