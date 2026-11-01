import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeAccepted, isFileAccepted, validateFiles } from './fileRules.ts';

const pdf = { name: 'verbale.pdf', size: 800_000, type: 'application/pdf' };
const photo = { name: 'foto.JPG', size: 2_000_000, type: 'image/jpeg' };
const exe = { name: 'programma.exe', size: 1_000, type: 'application/x-msdownload' };
const noType = { name: 'bilancio.pdf', size: 1_000 };

test('isFileAccepted: MIME, MIME con asterisco, estensione', () => {
  assert.equal(isFileAccepted(pdf, ['application/pdf']), true);
  assert.equal(isFileAccepted(photo, ['image/*']), true);
  assert.equal(isFileAccepted(pdf, ['image/*']), false);
  assert.equal(isFileAccepted(noType, ['.pdf']), true);
  assert.equal(isFileAccepted(photo, ['.jpg']), true);
  assert.equal(isFileAccepted(exe, ['application/pdf', 'image/*']), false);
  assert.equal(isFileAccepted(exe, undefined), true);
  assert.equal(isFileAccepted(exe, []), true);
});

test('describeAccepted: parole semplici senza ripetizioni', () => {
  assert.equal(describeAccepted(['application/pdf', 'image/*']), 'PDF, immagini');
  assert.equal(describeAccepted(['.pdf', 'application/pdf']), 'PDF');
  assert.equal(describeAccepted(['.xyz']), 'XYZ');
});

test('validateFiles: tipo non consentito', () => {
  const result = validateFiles([pdf, exe], { accept: ['application/pdf'], multiple: true });
  assert.deepEqual(result.accepted, [pdf]);
  assert.equal(
    result.rejections[0],
    '“programma.exe” non è un tipo di file consentito. Puoi scegliere: PDF.',
  );
});

test('validateFiles: peso oltre il limite', () => {
  const result = validateFiles([photo], { maxSizeBytes: 1_000_000 });
  assert.deepEqual(result.accepted, []);
  assert.equal(
    result.rejections[0],
    '“foto.JPG” pesa 2 MB: il limite è 1 MB. Scegli un file più leggero.',
  );
});

test('validateFiles: un solo file se non è multiplo', () => {
  const result = validateFiles([pdf, noType], { multiple: false });
  assert.deepEqual(result.accepted, [pdf]);
  assert.match(result.rejections[0] ?? '', /solo file/);
});

test('validateFiles: numero massimo, contando quelli già scelti', () => {
  const result = validateFiles([pdf, noType, photo], { multiple: true, maxFiles: 3 }, 1);
  assert.equal(result.accepted.length, 2);
  assert.equal(result.rejections.length, 1);
  assert.match(result.rejections[0] ?? '', /al massimo 3 file/);
});
