import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AssignPatternDto } from './assign-pattern.dto';

describe('AssignPatternDto', () => {
  const validUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const validPatternId = 'b1ffcd88-8b0a-4fe7-aa5c-5aa8ac270b22';

  it('should validate a complete and valid payload', async () => {
    const raw = {
      user_id: validUserId,
      pattern_id: validPatternId,
      start_date: '2026-10-19',
      current_week_in_rotation: 1,
      auto_rotate_dayoff: true,
      day_off_days: [5, 6],
    };

    const dto = plainToInstance(AssignPatternDto, raw);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should allow omitting start_date (handled by default in service)', async () => {
    const raw = {
      user_id: validUserId,
      pattern_id: validPatternId,
      current_week_in_rotation: 1,
    };

    const dto = plainToInstance(AssignPatternDto, raw);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should transform empty string pattern_id to null and pass validation', async () => {
    const raw = {
      user_id: validUserId,
      pattern_id: '',
      current_week_in_rotation: 1,
    };

    const dto = plainToInstance(AssignPatternDto, raw);
    expect(dto.pattern_id).toBeNull();
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should transform "standard" pattern_id to null and pass validation', async () => {
    const raw = {
      user_id: validUserId,
      pattern_id: 'standard',
      current_week_in_rotation: 2,
    };

    const dto = plainToInstance(AssignPatternDto, raw);
    expect(dto.pattern_id).toBeNull();
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail if user_id is not a valid UUID', async () => {
    const raw = {
      user_id: 'invalid-user-id',
      pattern_id: validPatternId,
    };

    const dto = plainToInstance(AssignPatternDto, raw);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('user_id');
  });
});
