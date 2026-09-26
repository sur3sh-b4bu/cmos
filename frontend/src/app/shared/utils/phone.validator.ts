import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Strictly 10 digits only (e.g. 9876543210). */
const PHONE_PATTERN = /^[0-9]{10}$/;

export function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  return PHONE_PATTERN.test(String(value).trim()) ? null : { phone: true };
}
