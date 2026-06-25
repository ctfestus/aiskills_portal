import { describe, it, expect } from 'vitest';
import { applyNameTags } from '@/lib/merge-tags';

describe('applyNameTags', () => {
  it('replaces {{first_name}} with the first name only', () => {
    expect(applyNameTags('Hi {{first_name}}, welcome.', 'Ama Mensah')).toBe('Hi Ama, welcome.');
  });

  it('replaces {{name}}, {{student_name}} and {{full_name}} with the full name', () => {
    expect(applyNameTags('To {{name}}', 'Ama Mensah')).toBe('To Ama Mensah');
    expect(applyNameTags('To {{student_name}}', 'Ama Mensah')).toBe('To Ama Mensah');
    expect(applyNameTags('To {{full_name}}', 'Ama Mensah')).toBe('To Ama Mensah');
  });

  it('does not let the full-name tag swallow {{first_name}}', () => {
    // The "name" alternative must not match inside "first_name".
    expect(applyNameTags('{{first_name}} / {{name}}', 'Ama Mensah')).toBe('Ama / Ama Mensah');
  });

  it('degrades to "there" when no name is available', () => {
    expect(applyNameTags('Hi {{first_name}},', '')).toBe('Hi there,');
    expect(applyNameTags('Hi {{name}},', null)).toBe('Hi there,');
    expect(applyNameTags('Hi {{first_name}},', undefined)).toBe('Hi there,');
    expect(applyNameTags('Hi {{first_name}},', '   ')).toBe('Hi there,');
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(applyNameTags('Hi {{ First_Name }}', 'Ama Mensah')).toBe('Hi Ama');
    expect(applyNameTags('Hi {{  NAME  }}', 'Ama Mensah')).toBe('Hi Ama Mensah');
  });

  it('replaces every occurrence', () => {
    expect(applyNameTags('{{first_name}} {{first_name}}', 'Ama Mensah')).toBe('Ama Ama');
  });

  it('escapes HTML in the name so a malicious name cannot inject markup', () => {
    // first_name takes the first whitespace-delimited token, so use a space-free payload here.
    expect(applyNameTags('Hi {{first_name}}', '<script>alert(1)</script>'))
      .toBe('Hi &lt;script&gt;alert(1)&lt;/script&gt;');
    // full-name tag keeps the whole string; all of &, <, > are escaped.
    expect(applyNameTags('Hi {{name}}', 'A & B <b>'))
      .toBe('Hi A &amp; B &lt;b&gt;');
  });

  it('leaves content without tags untouched and handles empty input', () => {
    expect(applyNameTags('No tags here', 'Ama Mensah')).toBe('No tags here');
    expect(applyNameTags('', 'Ama Mensah')).toBe('');
  });
});
