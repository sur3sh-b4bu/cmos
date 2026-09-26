import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { StaticTranslateLoader } from '../../../core/i18n/static-translate-loader';
import { ChurchSetupService, ChurchSetupStatus } from '../../../core/services/church-setup.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ChurchSetupDialogComponent } from './church-setup-dialog';

const SERIES = { prefix: 'RCT', startNumber: 1, padding: 4 };

function statusWith(missing: Partial<ChurchSetupStatus['missing']> = {}): ChurchSetupStatus {
  const all = { receiptSeries: true, certificateSeries: ['Baptism', 'Marriage', 'Death'] as ChurchSetupStatus['missing']['certificateSeries'], masses: true, branch: true, priest: true, admin: true };
  const missingNow = { ...all, ...missing };
  return {
    churchId: 7,
    churchName: 'St. Test',
    complete: !missingNow.receiptSeries && missingNow.certificateSeries.length === 0 && !missingNow.masses,
    missing: missingNow,
    defaults: {
      receiptSeries: SERIES,
      certificateSeries: { Baptism: { ...SERIES, prefix: 'BAP' }, Marriage: { ...SERIES, prefix: 'MAR' }, Death: { ...SERIES, prefix: 'DTH' } },
      masses: [
        { name: 'Morning Mass', nameTa: 'காலை', massTime: '06:00', dayType: 'Daily', defaultOfferingAmount: 0 },
        { name: 'Sunday Mass', nameTa: '', massTime: '08:00', dayType: 'Sunday', defaultOfferingAmount: 0 },
      ],
    },
  };
}

async function open(status: ChurchSetupStatus, apply = vi.fn().mockResolvedValue({ status, created: {}, skipped: [] })) {
  const close = vi.fn();
  const success = vi.fn();
  await TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideTranslateService({ lang: 'en', fallbackLang: 'en', loader: provideTranslateLoader(StaticTranslateLoader) }),
      { provide: MAT_DIALOG_DATA, useValue: { churchId: 7, churchName: 'St. Test' } },
      { provide: MatDialogRef, useValue: { close } },
      { provide: ChurchSetupService, useValue: { getStatus: vi.fn().mockResolvedValue(status), apply } },
      { provide: NotificationService, useValue: { success, error: vi.fn(), info: vi.fn() } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ChurchSetupDialogComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, close, apply, success, el: fixture.nativeElement as HTMLElement };
}

describe('ChurchSetupDialogComponent', () => {
  it('shows every section for a brand-new church, pre-filled with the suggested values', async () => {
    const { component, el } = await open(statusWith());
    expect(el.querySelector('[data-testid=setup-receipt]')).not.toBeNull();
    expect(el.querySelectorAll('[data-testid^=setup-cert-]').length).toBe(3);
    expect(component.masses.length).toBe(2);
    expect(el.querySelector('[data-testid=setup-extras]')).not.toBeNull();
    expect(component.receipt.getRawValue()).toEqual(SERIES);
    expect(component.preview(component.receipt)).toBe('RCT0001');
    expect(component.preview(component.certificates.Marriage)).toBe('MAR0001');
  });

  it('shows only what the church is still missing', async () => {
    const { component, el } = await open(statusWith({ receiptSeries: false, certificateSeries: ['Death'], masses: false, branch: false, priest: false, admin: false }));
    expect(el.querySelector('[data-testid=setup-receipt]')).toBeNull();
    expect(el.querySelectorAll('[data-testid^=setup-cert-]').length).toBe(1);
    expect(el.querySelector('[data-testid=setup-masses]')).toBeNull();
    expect(el.querySelector('[data-testid=setup-extras]')).toBeNull();
    expect(el.querySelector('[data-testid=setup-admin]')).toBeNull();
    expect(component.masses.length).toBe(0);
  });

  it('saves exactly what was entered, and only for the sections that were missing', async () => {
    const { component, apply, close, success } = await open(statusWith());
    component.receipt.patchValue({ prefix: 'STM', startNumber: 10, padding: 5 });
    component.certificates.Baptism!.patchValue({ prefix: 'B', startNumber: 200 });
    component.masses.at(0).patchValue({ name: 'Dawn Mass', massTime: '05:30', defaultOfferingAmount: 75 });
    component.extras.patchValue({ branchName: ' Main Church ', priestName: 'Fr. Paul', priestTitle: '' });
    await component.save();

    const [churchId, payload] = apply.mock.calls[0];
    expect(churchId).toBe(7);
    expect(payload.receiptSeries).toEqual({ prefix: 'STM', startNumber: 10, padding: 5 });
    expect(payload.certificateSeries.Baptism).toEqual({ prefix: 'B', startNumber: 200, padding: 4 });
    expect(Object.keys(payload.certificateSeries)).toEqual(['Baptism', 'Marriage', 'Death']);
    expect(payload.masses[0]).toMatchObject({ name: 'Dawn Mass', massTime: '05:30', defaultOfferingAmount: 75 });
    expect(payload.masses).toHaveLength(2);
    expect(payload.branch).toEqual({ name: 'Main Church' });
    expect(payload.priest).toEqual({ name: 'Fr. Paul', title: undefined });
    expect(success).toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(true);
  });

  it('leaves out the optional branch and priest when their boxes are empty, and out of sections that are not missing', async () => {
    const { component, apply } = await open(statusWith({ receiptSeries: false, certificateSeries: [], masses: true, branch: true, priest: true }));
    component.extras.patchValue({ branchName: '', priestName: '' });
    await component.save();
    const payload = apply.mock.calls[0][1];
    expect(payload).not.toHaveProperty('receiptSeries');
    expect(payload).not.toHaveProperty('certificateSeries');
    expect(payload).not.toHaveProperty('branch');
    expect(payload).not.toHaveProperty('priest');
    expect(payload.masses).toHaveLength(2);
  });

  it('does not save while anything is invalid, and says which field', async () => {
    const { component, apply, close, fixture, el } = await open(statusWith());
    component.receipt.patchValue({ prefix: '' });
    component.certificates.Death!.patchValue({ prefix: 'has space' });
    component.masses.at(1).patchValue({ name: '' });
    component.certificates.Marriage!.patchValue({ padding: 11 });
    await component.save();
    fixture.detectChanges();

    expect(apply).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(component.invalid(component.receipt, 'prefix')).toBe(true);
    expect(component.invalid(component.certificates.Death, 'prefix')).toBe(true);
    expect(component.invalid(component.certificates.Marriage, 'padding')).toBe(true);
    expect(el.textContent).toContain('letters, digits');
  });

  it('accepts prefixes the server accepts (letters, digits and . _ / -)', async () => {
    const { component } = await open(statusWith());
    for (const ok of ['A', 'ST-1', 'a.b_c/d', 'X99']) {
      component.receipt.patchValue({ prefix: ok });
      expect(component.receipt.get('prefix')!.valid).toBe(true);
    }
    for (const bad of ['', 'a b', 'a#', 'x'.repeat(21)]) {
      component.receipt.patchValue({ prefix: bad });
      expect(component.receipt.get('prefix')!.valid).toBe(false);
    }
  });

  it('adds and removes Masses', async () => {
    const { component, apply } = await open(statusWith({ receiptSeries: false, certificateSeries: [], branch: false, priest: false }));
    component.addMass();
    expect(component.masses.length).toBe(3);
    component.masses.at(2).patchValue({ name: 'Vigil Mass', massTime: '23:00', dayType: 'Special' });
    component.removeMass(0);
    component.removeMass(0);
    expect(component.masses.length).toBe(1);
    await component.save();
    expect(apply.mock.calls[0][1].masses).toEqual([expect.objectContaining({ name: 'Vigil Mass', massTime: '23:00', dayType: 'Special' })]);
  });

  it('removing every Mass just skips that part instead of failing', async () => {
    const { component, apply } = await open(statusWith({ receiptSeries: false, certificateSeries: [], branch: false, priest: false }));
    component.removeMass(0);
    component.removeMass(0);
    await component.save();
    expect(apply.mock.calls[0][1]).toEqual({});
  });

  it('keeps the popup open and shows the server message when saving fails', async () => {
    const failing = vi.fn().mockRejectedValue({ error: { message: 'Something went wrong on the server' }, status: 400 });
    const { component, close, fixture, el } = await open(statusWith(), failing);
    await component.save();
    fixture.detectChanges();
    expect(close).not.toHaveBeenCalled();
    expect(component.saveError()).toBeTruthy();
    expect(el.querySelector('[data-testid=setup-save-error]')).not.toBeNull();
    expect(component.saving()).toBe(false);
  });

  it('"Do this later" closes without saving', async () => {
    const { component, apply, close } = await open(statusWith());
    component.later();
    expect(apply).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(false);
  });

  it('says so when there is nothing left to set up', async () => {
    const { el } = await open(statusWith({ receiptSeries: false, certificateSeries: [], masses: false, branch: false, priest: false, admin: false }));
    expect(el.querySelector('[data-testid=setup-nothing-missing]')).not.toBeNull();
  });

  describe('the church administrator', () => {
    it('is offered only while the church has none', async () => {
      const { el } = await open(statusWith({ admin: true }));
      expect(el.querySelector('[data-testid=setup-admin]')).not.toBeNull();
    });

    it('is not offered when the church already has one', async () => {
      const { el } = await open(statusWith({ admin: false }));
      expect(el.querySelector('[data-testid=setup-admin]')).toBeNull();
    });

    it('is optional: left empty, no admin is sent', async () => {
      const { component, apply } = await open(statusWith());
      await component.save();
      expect(apply.mock.calls[0][1]).not.toHaveProperty('admin');
    });

    it('sends the trimmed details, leaving out an empty email and phone', async () => {
      const { component, apply } = await open(statusWith());
      component.adminForm.patchValue({ fullName: '  Fr. Paul  ', username: ' paul.admin ', email: '', phone: '' });
      await component.save();
      expect(apply.mock.calls[0][1].admin).toEqual({ fullName: 'Fr. Paul', username: 'paul.admin', email: undefined, phone: undefined });
    });

    it('needs both a name and a username once either is started, and a valid username and email', async () => {
      const { component, apply, fixture } = await open(statusWith());
      component.adminForm.patchValue({ fullName: 'Fr. Paul', username: '' });
      await component.save();
      fixture.detectChanges();
      expect(apply).not.toHaveBeenCalled();
      expect(component.adminInvalid('username')).toBe(true);
      expect(component.adminInvalid('fullName')).toBe(false);

      component.adminForm.patchValue({ fullName: '', username: 'paulsecretary' });
      expect(component.adminInvalid('fullName')).toBe(true);

      component.adminForm.patchValue({ fullName: 'Fr. Paul', username: 'no spaces allowed' });
      expect(component.adminInvalid('username')).toBe(true);
      component.adminForm.patchValue({ username: 'ab' });
      expect(component.adminInvalid('username')).toBe(true); // too short

      component.adminForm.patchValue({ username: 'paul', email: 'not-an-email' });
      expect(component.adminInvalid('email')).toBe(true);
      await component.save();
      expect(apply).not.toHaveBeenCalled();

      component.adminForm.patchValue({ email: 'paul@example.org' });
      expect(component.adminInvalid('email')).toBe(false);
      expect(component.adminInvalid('username')).toBe(false);
    });

    it('shows the login and temporary password once after it is created, and stays open until Done', async () => {
      const status = statusWith();
      const apply = vi.fn().mockResolvedValue({ status, created: { admin: true }, skipped: [], admin: { id: 9, username: 'paul.admin', tempPassword: 'Bright-Falcon-482' } });
      const { component, close, fixture, el } = await open(status, apply);
      component.adminForm.patchValue({ fullName: 'Fr. Paul', username: 'paul.admin' });
      await component.save();
      fixture.detectChanges();

      expect(close).not.toHaveBeenCalled();
      expect(el.querySelector('[data-testid=setup-cred-username]')?.textContent).toContain('paul.admin');
      expect(el.querySelector('[data-testid=setup-cred-password]')?.textContent).toContain('Bright-Falcon-482');
      expect(el.querySelector('[data-testid=setup-credentials]')).not.toBeNull();
      expect(el.querySelector('[data-testid=setup-save]')).toBeNull(); // the form is gone: nothing can be submitted twice
      expect(el.querySelector('[data-testid=setup-later]')).toBeNull();

      (el.querySelector('[data-testid=setup-done]') as HTMLButtonElement).click();
      expect(close).toHaveBeenCalledWith(true);
    });

    it('shows the message from the server when the username is taken, and keeps everything typed', async () => {
      const taken = vi.fn().mockRejectedValue({ error: { message: 'A user with this username or email already exists.' }, status: 409 });
      const { component, close, fixture, el } = await open(statusWith(), taken);
      component.adminForm.patchValue({ fullName: 'Fr. Paul', username: 'taken' });
      await component.save();
      fixture.detectChanges();
      expect(close).not.toHaveBeenCalled();
      expect(el.querySelector('[data-testid=setup-save-error]')).not.toBeNull();
      expect(component.adminForm.getRawValue().username).toBe('taken');
      expect(component.credentials()).toBeNull();
    });
  });
});
