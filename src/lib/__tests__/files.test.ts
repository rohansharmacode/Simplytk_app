import { safeFilename } from '../files';

describe('safeFilename', () => {
  it.each([
    ['optiver-cover-letter.txt', 'text/plain;charset=utf-8', 'optiver-cover-letter.txt'],
    ['deadline', 'text/calendar;charset=utf-8', 'deadline.ics'],
    ['share-card', 'image/png', 'share-card.png'],
    ['notes', 'application/x-unknown', 'notes'],
    ['../../etc/passwd', 'text/plain', 'etc-passwd.txt'],
    ['a/b\\c:d*e?f"g<h>i|j.pdf', 'application/pdf', 'a-b-c-d-e-f-g-h-i-j.pdf'],
    ['', 'text/calendar', 'download.ics'],
    ['.hidden', 'text/plain', 'hidden.txt'],
  ])('%p (%s) -> %p', (name, mimeType, expected) => {
    expect(safeFilename(name, mimeType)).toBe(expected);
  });

  it('caps very long names', () => {
    expect(safeFilename(`${'x'.repeat(300)}.txt`, 'text/plain').length).toBeLessThanOrEqual(124);
  });
});
