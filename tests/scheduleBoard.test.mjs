import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Exercise the production calculation module without introducing a test framework.
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const dataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const timeModule = dataUrl(compile('../src/lib/time/index.ts'));
const model = await import(dataUrl(compile('../src/features/timeline/scheduleBoardModel.ts').replace("'@/lib/time'", JSON.stringify(timeModule))));
const rules = [{ jenis: 'CLT', durasi_jam: 2, jumlah_sesi: 1 }, { jenis: 'Private', durasi_jam: 1.5, jumlah_sesi: 1 }];
const slot = { slot_id: 'a', kelas_jenis: 'CLT', jam_mulai: '09:00', jam_selesai: '12:00', status: 'aktif', dihitung: true, tipe_lokasi: 'ruangan', ruangan_nama: 'Fuyu 1' };

test('session totals and interval allocations use the same exact rule', () => {
  assert.equal(model.scheduleSessions(slot, rules), 1.5);
  assert.equal(model.intervalSessions(slot, 540, rules), .25);
  const privateSlot = { ...slot, kelas_jenis: 'Private', jam_selesai: '10:30' };
  assert.equal(model.scheduleSessions(privateSlot, rules), 1);
  assert.ok(Math.abs([540, 570, 600].reduce((sum, tick) => sum + model.intervalSessions(privateSlot, tick, rules), 0) - 1) < 1e-12);
});

test('partial intervals preserve exact totals and zero outside the slot', () => {
  const partial = { ...slot, jam_mulai: '09:15', jam_selesai: '10:15' };
  assert.equal(model.intervalSessions(partial, 540, rules), .125);
  assert.equal(model.intervalSessions(partial, 570, rules), .25);
  assert.equal(model.intervalSessions(partial, 600, rules), .125);
  assert.equal(model.intervalSessions(partial, 630, rules), 0);
});

test('cancelled markers and planning do not count; the replacement counts once', () => {
  assert.equal(model.scheduleSessions({ ...slot, dihitung: false }, rules), 0);
  assert.equal(model.scheduleSessions({ ...slot, status: 'planning' }, rules), 0);
  assert.equal(model.scheduleSessions({ ...slot, is_pengganti: true }, rules), 1.5);
  assert.equal(model.scheduleSessions(slot, []), 1);
});

test('touching schedules share a lane; overlapping schedules keep separate lanes', () => {
  const next = { ...slot, slot_id: 'b', jam_mulai: '12:00', jam_selesai: '13:00' };
  assert.equal(model.placeSchedules([next, slot]).lanes, 1);
  assert.equal(model.placeSchedules([slot, { ...next, jam_mulai: '11:30' }]).lanes, 2);
});

test('colors follow room identity and the axis follows the supplied reference', () => {
  assert.equal(model.scheduleColor(slot).color, '#a3dbff');
  assert.equal(model.scheduleColor({ ...slot, tipe_lokasi: 'kelas_perusahaan' }).color, '#c189f7');
  assert.equal(model.BOARD_TICKS.length, 28);
  assert.equal(model.BOARD_START, 450);
  assert.equal(model.BOARD_END, 1290);
});

test('the actual board renders every teacher, interval and unavailable Actual value', async () => {
  const require = createRequire(import.meta.url);
  const source = compile('../src/features/timeline/SenseiScheduleBoard.tsx')
    .replace("'@/lib/time'", JSON.stringify(timeModule))
    .replace("'./scheduleBoardModel'", JSON.stringify(dataUrl(compile('../src/features/timeline/scheduleBoardModel.ts').replace("'@/lib/time'", JSON.stringify(timeModule)))))
    .replace(/(["'])react\/jsx-runtime\1/g, JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href))
    .replace(/(["'])react\1/g, JSON.stringify(pathToFileURL(require.resolve('react')).href));
  const { SenseiScheduleBoard } = await import(dataUrl(source));
  const rows = Array.from({ length: 26 }, (_, i) => ({ id: `s${i}`, label: i === 0 ? '<Sensei>' : `Sensei ${i}` }));
  const markup = renderToStaticMarkup(React.createElement(SenseiScheduleBoard, {
    rows, schedules: [{ ...slot, sensei_id: 's0', kelas_nama: 'Level 3' }], rules, date: '2026-11-06',
  }));
  assert.equal((markup.match(/class="sheet-row sheet-columns"/g) || []).length, 26);
  assert.equal((markup.match(/Data realisasi mengajar belum tersedia/g) || []).length, 26);
  assert.ok(markup.includes('&lt;Sensei&gt;'));
  assert.ok(markup.includes('21.30'));
  assert.ok(markup.includes('Level 3'));
  assert.ok(markup.includes('1,5'));
});
