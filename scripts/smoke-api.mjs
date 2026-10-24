process.env.NODE_ENV = 'test';
// A real database, but an ephemeral one: the suite gets SQLite's actual
// behaviour (constraints, upserts, ordering) without leaving voicepay.db
// behind or touching a developer's real data.
process.env.DATABASE_PATH = ':memory:';
const { app } = await import('../server/src/index.js');

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api`;

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name} ${detail}`); }
};

const call = async (method, path, body) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

console.log('\nhealth / defaults');
const health = await call('GET', '/health');
check('health ok', health.body.ok === true, JSON.stringify(health.body));
check('health reports store kind', health.body.store === 'memory', `store=${health.body.store}`);
check('health reports stats', typeof health.body.stats?.activity === 'number', JSON.stringify(health.body.stats));
const defs = await call('GET', '/defaults');
check('defaults ok', defs.body.ok === true);

console.log('\nsettings');
const s0 = await call('GET', '/settings/demo-user');
check('GET settings defaults source', s0.body.source === 'defaults', `source=${s0.body.source}`);
check('GET settings demoMode forced', s0.body.settings?.demoMode === true);

const s1 = await call('PUT', '/settings/demo-user', {
  settings: { language: 'hi', fontSize: 'large', speechRate: 9.9, evilField: 'nope' },
});
check('PUT settings ok', s1.body.ok === true, JSON.stringify(s1.body));
check('PUT clamps speechRate to 1.5', s1.body.settings?.speechRate === 1.5, `got ${s1.body.settings?.speechRate}`);
check('PUT rejects unknown field', Array.isArray(s1.body.ignoredFields) && s1.body.ignoredFields.includes('evilField'), JSON.stringify(s1.body.ignoredFields));

const s2 = await call('PUT', '/settings/someone-else', { settings: { language: 'hi' } });
check('PUT other user forbidden', s2.status === 403, `status=${s2.status}`);

// The API keeps its copy in a database, so a write is visible to the next read.
const s3 = await call('GET', '/settings/demo-user');
check('GET settings reads back the write', s3.body.settings?.language === 'hi', JSON.stringify(s3.body?.settings));
check('GET settings source is store after a write', s3.body.source === 'store', `source=${s3.body.source}`);

// A partial write must not wipe the fields it did not mention.
await call('PUT', '/settings/demo-user', { settings: { fontSize: 'large' } });
const s4 = await call('GET', '/settings/demo-user');
check('partial write keeps other fields', s4.body.settings?.language === 'hi' && s4.body.settings?.fontSize === 'large', JSON.stringify(s4.body?.settings));

const h1 = await call('PUT', '/settings/demo-user/helpers', { helperUid: 'helper-1' });
check('PUT helpers ok (was ReferenceError)', h1.body.ok === true, JSON.stringify(h1.body));
check('helpers list returned', Array.isArray(h1.body.helpers), JSON.stringify(h1.body));
const h2 = await call('PUT', '/settings/demo-user/helpers', { helperUid: 'helper-1', remove: true });
check('PUT helpers remove ok', h2.body.ok === true, JSON.stringify(h2.body));
const h3 = await call('PUT', '/settings/not-demo-user/helpers', { helperUid: 'x' });
check('PUT helpers forbidden for other user', h3.status === 403, `status=${h3.status}`);
const h4 = await call('PUT', '/settings/demo-user/helpers', {});
check('PUT helpers missing helperUid -> 400', h4.status === 400, `status=${h4.status}`);

console.log('\nprogress');
const p0 = await call('GET', '/progress/demo-user');
check('GET progress ok', p0.body.ok === true, JSON.stringify(p0.body));
const p1 = await call('PUT', '/progress/demo-user', { completedLessonId: 'lesson-otp' });
check('PUT progress ok', p1.body.ok === true, JSON.stringify(p1.body));
const p2 = await call('PUT', '/progress/demo-user', { completedLessonId: 'not-a-lesson' });
check('PUT progress unknown lesson -> 400', p2.status === 400, `status=${p2.status}`);
const p3 = await call('POST', '/progress/demo-user/practice', { messageId: 'nope', choice: 'safe' });
check('POST practice unknown message -> 404', p3.status === 404, `status=${p3.status}`);
const p4 = await call('POST', '/progress/demo-user/practice', { messageId: 'practice-otp', choice: 'banana' });
check('POST practice bad choice -> 400', p4.status === 400, `status=${p4.status}`);
const p5 = await call('POST', '/progress/demo-user/practice', { messageId: 'practice-otp', choice: 'fraud' });
check('POST practice scores a real message', p5.body.ok === true && typeof p5.body.correct === 'boolean', JSON.stringify(p5.body).slice(0, 160));

console.log('\nactivity');
const a0 = await call('GET', '/activity/demo-user');
check('GET activity starts empty', a0.body.ok === true && a0.body.total === 0, JSON.stringify(a0.body).slice(0, 120));

const a1 = await call('POST', '/activity/demo-user', {
  kind: 'safety',
  verdict: 'red',
  score: 88,
  meta: { ruleIds: ['otp-request'], severity: 3 },
});
check('POST activity ok', a1.status === 201 && a1.body.item?.kind === 'safety', JSON.stringify(a1.body).slice(0, 160));

// The whole privacy contract in one assertion: a caller that sends the pasted
// message must NOT have it stored. `text` is not on the allow-list, so it is
// dropped rather than saved.
const a2 = await call('POST', '/activity/demo-user', {
  kind: 'explain',
  verdict: 'explained',
  meta: { amount: 500, text: 'Rs 500 debited A/c 123456789', counterparty: 'SUNRISE TEXTILES' },
});
check('POST activity drops the pasted text', a2.body.item?.meta?.text === undefined, JSON.stringify(a2.body.item?.meta));
check('POST activity keeps derived facts', a2.body.item?.meta?.counterparty === 'SUNRISE TEXTILES', JSON.stringify(a2.body.item?.meta));

const a3 = await call('POST', '/activity/demo-user', { kind: 'not-a-kind' });
check('POST activity unknown kind -> 400', a3.status === 400, `status=${a3.status}`);

const a4 = await call('GET', '/activity/demo-user');
check('GET activity newest first', a4.body.items?.[0]?.kind === 'explain', JSON.stringify(a4.body.items?.map((i) => i.kind)));
check('GET activity scoped total', a4.body.total === 2, `total=${a4.body.total}`);

const a5 = await call('GET', '/activity/demo-user?kind=safety');
check('GET activity filtered by kind', a5.body.total === 1 && a5.body.items[0].kind === 'safety', JSON.stringify(a5.body).slice(0, 120));

const a6 = await call('GET', '/activity/demo-user?kind=banana');
check('GET activity unknown kind -> 400', a6.status === 400, `status=${a6.status}`);

const a7 = await call('GET', '/activity/demo-user/summary');
check('GET activity summary counts', a7.body.counts?.safety === 1 && a7.body.counts?.explain === 1, JSON.stringify(a7.body.counts));

// Activity for a different user must not appear in this user's history.
await call('POST', '/activity/another-user', { kind: 'send', verdict: 'sent-trusted', meta: { payeeName: 'Sita' } });
const a8 = await call('GET', '/activity/demo-user');
check('activity is scoped per user', a8.body.total === 2, `total=${a8.body.total}`);

const a9 = await call('DELETE', `/activity/demo-user/${a2.body.item.id}`);
check('DELETE activity one ok', a9.body.ok === true, JSON.stringify(a9.body));
const a10 = await call('GET', '/activity/demo-user');
check('DELETE activity one took effect', a10.body.total === 1, `total=${a10.body.total}`);

// Settings DELETE erases the whole account, activity included.
const a11 = await call('DELETE', '/settings/demo-user');
check('DELETE settings erases account', a11.body.deleted === true, JSON.stringify(a11.body));
const a12 = await call('GET', '/activity/demo-user');
check('DELETE settings cleared activity too', a12.body.total === 0, `total=${a12.body.total}`);
const a13 = await call('GET', '/settings/demo-user');
check('DELETE settings resets to defaults', a13.body.source === 'defaults', `source=${a13.body.source}`);

const a14 = await call('DELETE', '/settings/someone-else');
check('DELETE settings other user forbidden', a14.status === 403, `status=${a14.status}`);

console.log('\nguidance endpoints');
const cs = await call('POST', '/check-safety', { text: 'URGENT: share your OTP to verify your account now' });
check('check-safety returns a verdict', typeof cs.body.verdict === 'string', JSON.stringify(cs.body).slice(0, 120));
const ex = await call('POST', '/explain-transaction', { text: 'Rs 500 debited to SUNRISE TEXTILES via UPI' });
check('explain-transaction ok', ex.body.ok === true, JSON.stringify(ex.body).slice(0, 120));
const nf = await call('GET', '/does-not-exist');
check('unknown route -> 404 json', nf.status === 404 && nf.body.error === 'not.found');

console.log(failures === 0 ? '\nALL PASS\n' : `\n${failures} FAILURE(S)\n`);
server.close();
process.exit(failures === 0 ? 0 : 1);