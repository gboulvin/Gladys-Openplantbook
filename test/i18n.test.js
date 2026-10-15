// -----------------------------------------------------------------------------
// Every user-facing text exists in the four languages of the Gladys UI:
// English, French, German and Spanish — the runtime messages as well as every
// text of the manifest and the user documentation.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { LANGUAGES, t, join } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

// Multi-language objects of the manifest: `label`, `description`,
// `placeholder`, at any depth.
function collectTexts(node, path, out) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectTexts(item, `${path}[${index}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (
        ['label', 'description', 'placeholder'].includes(key) &&
        value &&
        typeof value === 'object'
      ) {
        out.push({ path: `${path}.${key}`, value });
      } else {
        collectTexts(value, `${path}.${key}`, out);
      }
    }
  }
  return out;
}

test('every manifest text is translated in en, fr, de and es', () => {
  const texts = collectTexts(manifest, 'manifest', []);
  assert.ok(texts.length > 50);
  for (const { path, value } of texts) {
    assert.deepEqual(Object.keys(value).sort(), [...LANGUAGES].sort(), path);
    for (const lang of LANGUAGES) {
      assert.ok(value[lang].trim().length > 0, `${path}.${lang} is empty`);
    }
  }
});

test('runtime messages are built in every language, parameters substituted', () => {
  const message = t('refresh_done', { refreshed: 3, failed: 1 });
  assert.deepEqual(Object.keys(message), LANGUAGES);
  assert.equal(message.fr, '3 plante(s) actualisée(s), 1 en échec.');
  assert.equal(message.es, '3 planta(s) actualizada(s), 1 con error.');
  const nested = t('ideal_min', { label: t('light') });
  assert.equal(nested.de, 'Licht (ideal min.)');
  assert.equal(join([t('light'), t('temperature')], ' / ').es, 'Luz / Temperatura');
  assert.throws(() => t('no_such_message'), /Unknown message key/);
});

test('the user documentation exists in the four languages', async () => {
  for (const lang of LANGUAGES) {
    const file = new URL(`../docs/${lang}.md`, import.meta.url);
    const text = await readFile(file, 'utf8');
    // The store requires 300 characters at least (en and fr mandatory, de
    // and es skipped with a warning when too short).
    assert.ok((await stat(file)).size > 300 && text.startsWith('# '), `docs/${lang}.md`);
  }
});
