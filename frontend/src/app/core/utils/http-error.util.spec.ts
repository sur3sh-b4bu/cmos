import { HttpErrorResponse } from '@angular/common/http';
import { extractErrorMessage } from './http-error.util';

describe('extractErrorMessage', () => {
  it('returns the API-supplied message', () => {
    const error = new HttpErrorResponse({ error: { message: 'Name is required' }, status: 400 });
    expect(extractErrorMessage(error)).toBe('Name is required');
  });

  it('appends field-level details to the message', () => {
    const error = new HttpErrorResponse({
      error: { message: 'Missing required field(s)', details: [{ field: 'massId', message: 'invalid' }] },
      status: 400,
    });
    expect(extractErrorMessage(error)).toBe('Missing required field(s) (massId: invalid)');
  });

  it('joins multiple field details with a comma', () => {
    const error = new HttpErrorResponse({
      error: {
        message: 'Missing required field(s)',
        details: [
          { field: 'name', message: 'required' },
          { field: 'massId', message: 'required' },
        ],
      },
      status: 400,
    });
    expect(extractErrorMessage(error)).toBe('Missing required field(s) (name: required, massId: required)');
  });

  it('falls back to a connectivity message for status 0', () => {
    const error = new HttpErrorResponse({ status: 0 });
    expect(extractErrorMessage(error)).toBe('Cannot reach the server. Please check your connection.');
  });

  it('falls back to the default message for a body with no message', () => {
    const error = new HttpErrorResponse({ error: {}, status: 500 });
    expect(extractErrorMessage(error)).toBe('Something went wrong. Please try again.');
  });

  it('accepts a custom fallback message', () => {
    const error = new HttpErrorResponse({ error: {}, status: 500 });
    expect(extractErrorMessage(error, 'Custom fallback')).toBe('Custom fallback');
  });

  it('falls back for a non-HttpErrorResponse value', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
    expect(extractErrorMessage('boom')).toBe('Something went wrong. Please try again.');
    expect(extractErrorMessage(null)).toBe('Something went wrong. Please try again.');
  });
});
