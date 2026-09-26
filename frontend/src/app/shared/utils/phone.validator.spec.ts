import { FormControl } from '@angular/forms';
import { phoneValidator } from './phone.validator';

describe('phoneValidator', () => {
  const check = (value: string | null) => phoneValidator(new FormControl(value));

  it('accepts 10 digits (and blank)', () => {
    expect(check('9876543210')).toBeNull();
    expect(check('')).toBeNull();
    expect(check(null)).toBeNull();
  });

  it('rejects letters, symbols, formatting and wrong lengths', () => {
    expect(check('abc!!')).toEqual({ phone: true });
    expect(check('+91 98765-43210')).toEqual({ phone: true });
    expect(check('98765 (43210)')).toEqual({ phone: true });
    expect(check('98765.43210')).toEqual({ phone: true });
    expect(check('98765')).toEqual({ phone: true });
    expect(check('98765432101')).toEqual({ phone: true });
  });
});
