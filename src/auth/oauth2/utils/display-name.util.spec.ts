import { oauthDisplayName } from './display-name.util';

describe('oauthDisplayName', () => {
  it('keeps a valid name, trimmed', () => {
    expect(oauthDisplayName('  Ahmed Ali  ', 'a@b.com', 'Google User')).toBe(
      'Ahmed Ali',
    );
  });

  it('cuts a long name to 30 characters', () => {
    const name = oauthDisplayName(
      'Mohammed Abdullah Abdulrahman Al-Qahtani',
      'm@b.com',
      'Google User',
    );
    expect(name).toBe('Mohammed Abdullah Abdulrahman');
    expect(name.length).toBeLessThanOrEqual(30);
  });

  it('uses the email local part when the name is too short', () => {
    expect(oauthDisplayName('Ali', 'ali.hassan@b.com', 'Google User')).toBe(
      'ali.hassan',
    );
  });

  it('uses the email local part when there is no name', () => {
    expect(oauthDisplayName(undefined, 'sara99@b.com', 'Facebook User')).toBe(
      'sara99',
    );
  });

  it('falls back when neither name nor email part is long enough', () => {
    expect(oauthDisplayName('Al', 'al@b.com', 'Google User')).toBe(
      'Google User',
    );
  });

  it('never uses the random local part of an Apple private relay email', () => {
    expect(
      oauthDisplayName(
        undefined,
        'x7k2abcd@privaterelay.appleid.com',
        'Apple User',
      ),
    ).toBe('Apple User');
  });
});
