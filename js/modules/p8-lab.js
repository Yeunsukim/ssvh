// 진단검사의학과 — 파트별 (자동화·면역, 혈액, 요검사, 미생물, 분자진단, 위탁, 혈액은행, 검증·보고, 정도관리)
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const F = H.flow;
  const DAY = 86400000;
  const ms = (k, d) => A.ms(k, d); const set = (k, v) => A.set(k, v);
  const pick = (name, opts, v) => UI.pick(name, opts.map((o) => (typeof o === 'object' ? o : { v: o, l: o })), v);
  const checks = (name, list, on = []) => `<div class="gap-s">${list.map((t) => UI.check(name, t, on.includes(t), { multi: true, value: t })).join('')}</div>`;

  const isLab = (o) => o.cat === 'LAB' && o.code !== 'L1026';
  const partOf = (o) => (H.M.item(o.code) || {}).part || '자동화';
  const whereOf = (o) => { const e = H.enc(o.encId); return !e ? '-' : e.type === 'OPD' ? '외래' : e.type === 'ER' ? `응급 ${e.room}` : `${e.ward} ${e.room}-${e.bed}`; };
  const pLine = (o) => { const p = H.pat(o.patientId); return `<b>${esc(p.name)}</b> <span class="muted small">${H.sexAge(p)} · ${esc(whereOf(o))}</span>${o.stat ? ' ' + UI.chip('응급', 'stat') : ''}`; };
  const inPart = (parts, st) => S.where('orders', (o) => isLab(o) && parts.includes(partOf(o)) && o.status === st).sort((a, b) => b.stat - a.stat || a.at - b.at);
  const ANALYZER = { 자동화: '화학분석기 (가상 C-800)', 면역: '면역분석기 (가상 I-600)', 혈액: '혈구분석기 (가상 H-500)', 응고: '응고분석기 (가상 CA-70)' };

  // ── 결과 입력 공통 ──
  function itemsFrom(o, d) { const it = H.M.item(o.code); return it.items.map((x) => { const v = d['v_' + x.c] || ''; const j = F.judge(x, v); return { c: x.c, n: x.n, u: x.u, v, flag: j.flag, dir: j.dir, ref: x.text ? x.normal : `${x.lo ?? ''}~${x.hi ?? ''}` }; }); }
  function prevVal(o, c) { const l = S.where('orders', (x) => x.id !== o.id && x.patientId === o.patientId && x.result && x.status === '결과보고').sort((a, b) => b.result.at - a.result.at); for (const x of l) { const r = x.result.items.find((y) => y.c === c); if (r) return H.num(r.v); } return null; }
  function delta(o, items) { return items.filter((r) => { const pv = prevVal(o, r.c); const v = H.num(r.v); return pv != null && v != null && pv !== 0 && Math.abs(v - pv) / Math.abs(pv) > 0.5; }).map((r) => `${r.n} ${prevVal(o, r.c)}→${r.v}`); }
  function entryModal(o, extra = '') {
    const it = H.M.item(o.code); const p = H.pat(o.patientId);
    UI.modal({ title: `결과 입력 — ${o.name}`, size: 'wide', body: `<form data-submit="lp.save" class="gap-m"><input type="hidden" name="id" value="${o.id}"><p style="margin:0">${pLine(o)}</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>항목</th><th>결과</th><th>단위</th><th>참고치</th><th>이전 결과</th></tr></thead><tbody>
      ${it.items.map((x) => `<tr><td>${esc(x.n)}</td><td><input name="v_${x.c}" value="" style="width:12rem" aria-label="${esc(x.n)}"></td><td class="small">${esc(x.u || '')}</td><td class="small num">${x.text ? esc(x.normal) : `${x.lo ?? ''} ~ ${x.hi ?? ''}`}</td><td class="small num">${prevVal(o, x.c) ?? '-'}</td></tr>`).join('')}</tbody></table></div>
      ${extra}<div class="btn-row end">${UI.btn('장비 결과 불러오기', 'lp.fill', { icon: 'refresh', data: { id: o.id } })}${UI.btn('결과 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
  }
  function saveResult(o, items, extra = {}) {
    const dl = delta(o, items);
    F.advance(o, '결과입력', { result: Object.assign({ at: Date.now(), by: H.who(), items, delta: dl }, extra) });
    return dl;
  }

  // ── 정도관리 ──
  const QC = { '화학분석기 (가상 C-800)': { c: 'Glu', n: '혈당', L1: [95, 3], L2: [280, 8] }, '면역분석기 (가상 I-600)': { c: 'TnI', n: '트로포닌', L1: [0.03, 0.004], L2: [1.2, 0.08] }, '혈구분석기 (가상 H-500)': { c: 'Hb', n: '혈색소', L1: [7.5, 0.2], L2: [14.8, 0.3] }, '응고분석기 (가상 CA-70)': { c: 'PT', n: 'PT', L1: [12, 0.4], L2: [30, 1.2] } };
  function westgard(vals) { // vals: z 값 (최근이 마지막)
    const z = vals[vals.length - 1]; const prev = vals[vals.length - 2];
    if (Math.abs(z) > 3) return { r: '거부', why: '1-3s (평균에서 3표준편차 넘음)' };
    if (prev != null && Math.abs(z) > 2 && Math.abs(prev) > 2 && Math.sign(z) === Math.sign(prev)) return { r: '거부', why: '2-2s (연속 2번 같은 쪽 2표준편차 넘음)' };
    if (Math.abs(z) > 2) return { r: '경고', why: '1-2s (2표준편차 넘음 — 다른 규칙 확인)' };
    return { r: '통과', why: '' };
  }
  const qcToday = (an) => { const l = S.where('recs', (r) => r.kind === 'qc' && r.an === an && r.at >= T.startOfDay()); if (!l.length) return null; return l.some((r) => r.res === '거부') ? '거부' : '통과'; };
  function lj(an, lv) {
    const q = QC[an]; const [m, sd] = q[lv]; const pts = S.where('recs', (r) => r.kind === 'qc' && r.an === an && r.lv === lv).sort((a, b) => a.at - b.at).slice(-20);
    const W = 520, Hh = 170, y = (z) => 85 - z * 22;
    let g = ''; [-3, -2, -1, 0, 1, 2, 3].forEach((k) => { g += `<line x1="40" x2="${W}" y1="${y(k)}" y2="${y(k)}" stroke="${Math.abs(k) === 3 ? 'var(--t-stat)' : Math.abs(k) === 2 ? 'var(--t-prog)' : 'var(--line)'}" stroke-dasharray="${k ? '4 3' : '0'}"/><text x="34" y="${y(k) + 4}" text-anchor="end" font-size="10" fill="var(--fg-3)">${k ? (k > 0 ? '+' : '') + k + 'SD' : '평균'}</text>`; });
    const xs = (i) => 50 + i * ((W - 60) / Math.max(1, pts.length - 1));
    const path = pts.map((r, i) => `${i ? 'L' : 'M'}${xs(i)} ${y(Math.max(-3.5, Math.min(3.5, (r.v - m) / sd)))}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${Hh}" class="chart" role="img" aria-label="레비-제닝스 그래프">${g}<path d="${path}" stroke="var(--accent)" fill="none" stroke-width="2"/>${pts.map((r, i) => { const z = (r.v - m) / sd; return `<circle cx="${xs(i)}" cy="${y(Math.max(-3.5, Math.min(3.5, z)))}" r="4" fill="${Math.abs(z) > 3 ? 'var(--t-stat)' : Math.abs(z) > 2 ? 'var(--t-prog)' : 'var(--accent)'}"/>`; }).join('')}<text x="44" y="12" font-size="11" fill="var(--fg-2)">${esc(q.n)} ${lv === 'L1' ? '낮은 농도' : '높은 농도'} — 평균 ${m}, 표준편차 ${sd}</text></svg>`;
  }
  const qcBadge = (parts) => { const ans = parts.includes('혈액') ? ['혈구분석기 (가상 H-500)', '응고분석기 (가상 CA-70)'] : parts.includes('면역') ? ['화학분석기 (가상 C-800)', '면역분석기 (가상 I-600)'] : []; return ans.map((a) => { const s = qcToday(a); return UI.chip(`${a.split(' (')[0]} 정도관리 ${s || '안 함'}`, s === '통과' ? 'done' : s ? 'stat' : 'prog'); }).join(' '); };

  // ── 미생물 ──
  const ORG = {
    'E. coli': { ko: '대장균 (E. coli)', gram: '그람 음성 막대균', ast: { 앰피실린: 'R', 세프트리악손: 'S', 시프로플록사신: 'S', '피페라실린·타조박탐': 'S', 이미페넴: 'S', 겐타마이신: 'S' } },
    MRSA: { ko: '메티실린 내성 황색포도알균 (MRSA)', gram: '그람 양성 알균 (포도송이 모양)', ast: { 옥사실린: 'R', 반코마이신: 'S', 리네졸리드: 'S', 클린다마이신: 'R', 에리스로마이신: 'R', '트리메토프림·설파': 'S' } },
    'S. pneumoniae': { ko: '폐렴구균 (S. pneumoniae)', gram: '그람 양성 쌍알균', ast: { 페니실린: 'S', 세프트리악손: 'S', 레보플록사신: 'S', 에리스로마이신: 'R', 반코마이신: 'S' } },
  };
  const orgFrom = (txt) => /대장균|coli/i.test(txt) ? 'E. coli' : /MRSA|메티실린/.test(txt) ? 'MRSA' : /폐렴구균|pneumoniae/i.test(txt) ? 'S. pneumoniae' : '';
  const MSTAGE = ['접수', '배양 중', '예비 보고', '동정·감수성', '최종 보고'];
  function microCard(o) {
    const p = H.pat(o.patientId); const it = H.M.item(o.code); const m = o.micro || { stage: '접수' }; const sc = H.sim.labValue(p, it.items[it.items.length - 1]); const org = m.org || orgFrom(sc);
    const blood = o.code === 'L1020';
    let body = '';
    if (m.stage === '접수') body = `<form data-submit="mb.culture" class="gap-s"><input type="hidden" name="id" value="${o.id}">${UI.fld('배지·배양 방법', `<div class="row">${(blood ? ['자동 혈액배양기 (호기·혐기병)'] : o.code === 'L1021' ? ['혈액 한천배지', '맥콘키 배지 (그람 음성 선택)'] : ['혈액 한천배지', '초콜릿 배지', '맥콘키 배지']).map((t) => UI.check('media', t, true, { multi: true, value: t })).join('')}</div>`)}${UI.btn('배양 시작 (35℃ 배양기)', '', { type: 'submit', kind: 'pri' })}</form>`;
    else if (m.stage === '배양 중') body = `<form data-submit="mb.prelim" class="gap-s"><input type="hidden" name="id" value="${o.id}">${UI.note(`${blood ? '혈액배양은 보통 1~5일 걸립니다. 기계가 균 자람을 알리면(양성 신호) 그람 염색합니다.' : '18~24시간 뒤 배지에 자란 집락(콜로니)을 봅니다.'} 실습에서는 바로 다음 단계로 갑니다.`, 'info')}
      <div class="q-block"><div class="q">균 자람</div>${pick('growth', [{ v: org ? 'Y' : 'N', l: org ? '자람 (양성)' : '자라지 않음' }, { v: org ? 'N' : 'Y', l: org ? '자라지 않음' : '자람' }], org ? 'Y' : 'N')}</div>
      <div class="q-block"><div class="q">그람 염색 (현미경)</div>${pick('gram', ['그람 양성 알균 (포도송이 모양)', '그람 양성 쌍알균', '그람 음성 막대균', '균 안 보임'], org ? ORG[org].gram : '균 안 보임')}</div>
      ${UI.btn('예비 보고', '', { type: 'submit', kind: 'pri' })}</form>`;
    else if (m.stage === '예비 보고') body = `<form data-submit="mb.id" class="gap-s"><input type="hidden" name="id" value="${o.id}">${m.growth === 'N' ? UI.note('균이 자라지 않았습니다 — 정해진 기간(혈액 5일, 소변 1일)이 지나면 "균 자라지 않음"으로 최종 보고합니다.', 'ok') : `<div class="q-block"><div class="q">균 동정 (자동 동정 장비 결과)</div>${pick('org', Object.keys(ORG).map((k) => ({ v: k, l: ORG[k].ko })), org)}</div>`}${UI.btn(m.growth === 'N' ? '최종 보고로' : '동정 완료 → 감수성 검사', '', { type: 'submit', kind: 'pri' })}</form>`;
    else if (m.stage === '동정·감수성') { const ast = m.org ? ORG[m.org].ast : {}; body = `<form data-submit="mb.final" class="gap-s"><input type="hidden" name="id" value="${o.id}">${m.org ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>항생제</th><th>감수성 (S 감수 · I 중간 · R 내성)</th></tr></thead><tbody>${Object.entries(ast).map(([ab, r]) => `<tr><td>${esc(ab)}</td><td><select name="ab_${esc(ab)}" aria-label="${esc(ab)}">${['S', 'I', 'R'].map((x) => `<option ${x === r ? 'selected' : ''}>${x}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>` : ''}${UI.btn('최종 보고 (검증으로)', '', { type: 'submit', kind: 'pri' })}</form>`; }
    return `<div class="box" style="background:var(--surface)"><div class="row between">${pLine(o)}<b>${esc(o.name)}</b></div>
      <div class="row" style="margin:.4rem 0">${MSTAGE.map((s, i) => `${i ? '<span class="muted">→</span>' : ''}${UI.chip(s, MSTAGE.indexOf(m.stage) >= i ? 'done' : 'plain')}`).join(' ')}</div>
      ${m.gram ? `<p class="small" style="margin:0 0 .4rem">그람 염색: <b>${esc(m.gram)}</b>${m.org ? ` · 동정: <b>${esc(ORG[m.org].ko)}</b>` : ''}</p>` : ''}${body}</div>`;
  }

  // ── 파트 화면 ──
  function autoPart(parts, title, help) {
    const list = inPart(parts, '검사접수');
    return `<div class="gap-m">${UI.note(help, 'info')}<div class="row">${qcBadge(parts)}</div>
      ${UI.table([{ h: '접수' }, { h: '환자' }, { h: '검사' }, { h: '파트·장비' }, { h: '' }], list.map((o) => [`<span class="num small">${T.hm(o.hist[o.hist.length - 1].at)}</span>`, pLine(o), `<b>${esc(o.name)}</b>`, `${esc(partOf(o))} · <span class="small">${esc(ANALYZER[partOf(o) === '혈액' && /응고|D-dimer/.test(o.name) ? '응고' : partOf(o)] || '수기 검사')}</span>`, UI.btn('결과 입력', 'lp.entry', { size: 'sm', kind: 'pri', data: { id: o.id } })]), { empty: UI.empty(`${title} 검사 대기가 없습니다`) })}
      ${list.length ? `<div class="btn-row end">${UI.btn('장비 결과 일괄 수신 (인터페이스)', 'lp.bulk', { kind: 'pri', icon: 'refresh', data: { parts: parts.join(',') } })}</div>` : ''}</div>`;
  }
  function tabRecv() {
    const list = S.where('orders', (o) => isLab(o) && o.status === '채혈완료');
    return `${UI.note('검체 접수: 바코드를 읽으면 검사 파트(자동화·혈액·미생물 등)로 자동 분류됩니다. 용혈·응고·양 부족·라벨 오류는 부적합으로 돌려보냅니다.', 'info')}
      <div style="margin-top:.8rem">${UI.table([{ h: '채혈' }, { h: '환자' }, { h: '검사' }, { h: '파트' }, { h: '용기' }, { h: '' }], list.map((o) => [`<span class="num small">${T.mdhm(o.specimenAt || o.at)}</span>`, pLine(o), `<b>${esc(o.name)}</b>`, UI.chip(partOf(o), partOf(o) === '미생물' ? 'purple' : partOf(o) === '위탁' ? 'prog' : 'sent'), esc(H.M.item(o.code).tube), `<div class="row" style="flex-wrap:nowrap;gap:.3rem">${UI.btn('접수', 'lp.recv', { size: 'sm', kind: 'pri', data: { id: o.id } })}${UI.btn('부적합', 'lb.bad', { size: 'sm', kind: 'warn', data: { id: o.id } })}</div>`]), { empty: UI.empty('도착한 검체가 없습니다') })}</div>
      ${list.length ? `<div class="btn-row end" style="margin-top:.8rem">${UI.btn('모두 접수', 'lp.recvAll', { kind: 'pri' })}</div>` : ''}`;
  }
  function tabUrine() {
    const list = inPart(['요검사'], '검사접수');
    return `<div class="gap-m">${UI.note('요검사(일반검사): ① 시험지(딥스틱)로 비중·산도·단백·잠혈·백혈구·아질산염을 보고 ② 원심분리한 침사를 현미경으로 봐서 고배율(HPF)당 적혈구·백혈구·세균을 셉니다.', 'info')}
      ${list.map((o) => `<form data-submit="lp.urine" class="box" style="background:var(--surface)"><input type="hidden" name="id" value="${o.id}"><div class="row between">${pLine(o)}<b>${esc(o.name)}</b></div>
        <div class="form-grid" style="margin-top:.5rem">${H.M.item(o.code).items.map((x) => UI.input('v_' + x.c, `${x.n} (정상 ${x.normal})`, '')).join('')}${UI.select('mRBC', '현미경 적혈구 /HPF', ['0~2', '3~5', '6~10', '많음'], '0~2')}${UI.select('mWBC', '현미경 백혈구 /HPF', ['0~5', '6~10', '10~20', '많음'], '0~5')}${UI.select('mBac', '세균', ['없음', '약간', '많음'], '없음')}</div>
        <div class="btn-row end" style="margin-top:.5rem">${UI.btn('시험지 판독 불러오기', 'lp.fillU', { data: { id: o.id } })}${UI.btn('결과 저장', '', { type: 'submit', kind: 'pri' })}</div></form>`).join('') || UI.empty('요검사 대기가 없습니다')}</div>`;
  }
  function tabMicro() {
    const list = S.where('orders', (o) => isLab(o) && partOf(o) === '미생물' && o.status === '검사접수');
    return `<div class="gap-m">${UI.note('미생물 검사 순서: 배양 → 그람 염색 예비 보고 → 균 동정 → 항생제 감수성 → 최종 보고. <b>혈액배양 양성</b>은 위험값처럼 바로 담당 의사·간호사에게 알립니다 (항생제를 맞게 바꾸기 위해).', 'info')}${list.map(microCard).join('') || UI.empty('미생물 검사 대기가 없습니다')}</div>`;
  }
  const MSTEP = ['핵산 추출', '유전자 증폭 (PCR)', '판독'];
  function tabMol() {
    const list = S.where('orders', (o) => isLab(o) && partOf(o) === '분자진단' && o.status === '검사접수');
    return `<div class="gap-m">${UI.note('분자진단: 검체에서 핵산(DNA·RNA)을 뽑고, 실시간 PCR로 늘려서 형광 신호가 나타나는 주기(Ct 값)를 봅니다. Ct 값이 40 미만이면 양성, 작을수록 바이러스·균이 많다는 뜻입니다. 오염을 막으려고 구역을 나눠서 작업합니다.', 'info')}
      ${list.map((o) => { const st = (o.mol || {}).step || 0; const it = H.M.item(o.code); const p = H.pat(o.patientId);
        return `<form data-submit="mo.step" class="box" style="background:var(--surface)"><input type="hidden" name="id" value="${o.id}"><div class="row between">${pLine(o)}<b>${esc(o.name)}</b></div>
          <div class="row" style="margin:.4rem 0">${MSTEP.map((s, i) => `${i ? '<span class="muted">→</span>' : ''}${UI.chip(s, st > i ? 'done' : st === i ? 'prog' : 'plain')}`).join(' ')}</div>
          ${st === 0 ? checks('c', ['검체 전처리 구역에서 작업 (오염 방지)', '자동 핵산 추출기 장착', '내부 대조 물질 넣음']) : st === 1 ? checks('c', ['증폭 구역으로 옮김', '양성·음성 대조 함께 돌림', '실시간 PCR 기기 시작 (약 90분)']) : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>표적</th><th>Ct 값</th><th>판정</th></tr></thead><tbody>${it.items.map((x) => { const v = H.sim.labValue(p, x); const pos = !/음성/.test(v); return `<tr><td>${esc(x.n)}</td><td><input name="ct_${x.c}" value="${pos ? (22 + Math.random() * 8).toFixed(1) : '측정 안 됨'}" style="width:8rem" aria-label="Ct"></td><td><select name="v_${x.c}" aria-label="판정"><option ${pos ? '' : 'selected'}>음성</option><option ${pos ? 'selected' : ''}>양성</option></select></td></tr>`; }).join('')}</tbody></table></div>`}
          <div class="btn-row end" style="margin-top:.5rem">${UI.btn(st < 2 ? `${MSTEP[st]} 완료` : '결과 저장', '', { type: 'submit', kind: 'pri' })}</div></form>`; }).join('') || UI.empty('분자진단 대기가 없습니다')}</div>`;
  }
  const ORGS = ['가상수탁검사센터 (서울)', '가상의학연구소', '가상임상검사재단'];
  function tabRef() {
    const wait = S.where('orders', (o) => isLab(o) && partOf(o) === '위탁' && o.status === '검사접수');
    return `<div class="gap-m">${UI.note('위탁검사: 병원에서 하지 않는 특수 검사는 수탁검사기관에 보냅니다. 검체 보관 조건(냉장·냉동)을 지키고, 발송·수령 기록을 남깁니다. 결과는 보통 2~7일 뒤 전산으로 받습니다.', 'info')}
      ${UI.table([{ h: '환자' }, { h: '검사' }, { h: '상태' }, { h: '' }], wait.map((o) => [pLine(o), `<b>${esc(o.name)}</b>`, o.ref ? `${UI.chip('발송함', 'prog')} <span class="small">${esc(o.ref.org)} · ${esc(o.ref.keep)} · ${T.mdhm(o.ref.at)}</span>` : UI.chip('발송 전', 'plain'), o.ref ? UI.btn('결과 수신', 'rf2.recv', { size: 'sm', kind: 'pri', data: { id: o.id } }) : UI.btn('위탁 발송', 'rf2.send', { size: 'sm', kind: 'pri', data: { id: o.id } })]), { empty: UI.empty('위탁검사 대기가 없습니다') })}</div>`;
  }
  function tabBank() {
    const list = S.where('orders', (o) => o.cat === 'BLOOD' && !F.isOff(o)).sort((a, b) => b.at - a.at);
    return `${autoPart(['혈액은행'], '혈액형', '혈액은행: ① 혈액형(ABO·Rh) 검사 → ② 수혈 처방이 오면 교차시험(환자 혈액과 혈액제제가 맞는지) → ③ 출고. 병동은 출고된 혈액을 2명이 확인 후 수혈합니다.')}<h3 style="margin:1rem 0 .4rem">수혈 처방</h3><div>${UI.table([{ h: '처방' }, { h: '환자' }, { h: '혈액형' }, { h: '혈액제제' }, { h: '상태' }, { h: '' }], list.map((o) => { const p = H.pat(o.patientId); const abo = F.lastLab(p.id, 'ABO'); const rh = F.lastLab(p.id, 'Rh'); return [`<span class="num small">${T.mdhm(o.at)}</span>`, pLine(o), abo ? `<b>${esc(abo.v)}형 ${esc(rh ? rh.v : '')}</b>` : '<span style="color:var(--t-stat)">검사 결과 없음</span>', esc(o.name), F.chip(o), o.status === '전송' ? UI.btn('교차시험 완료', 'lb.xm', { size: 'sm', kind: 'pri', data: { id: o.id } }) : o.status === '교차시험완료' ? UI.btn('혈액 출고', 'lb.issue', { size: 'sm', kind: 'pri', data: { id: o.id } }) : `<span class="mono small">${esc(o.bagNo || '')}</span>`]; }), { empty: UI.empty('수혈 처방이 없습니다') })}</div>`;
  }
  function tabVerify() {
    const list = S.where('orders', (o) => isLab(o) && o.status === '결과입력');
    return `${UI.note('검증·보고: 진단검사의학과 전문의가 결과를 확인합니다. <b>델타 체크</b>는 이전 결과와 50% 넘게 다르면 검체 바뀜·오류를 의심하라는 표시입니다. 위험값은 전화 보고 후 되읽기 기록.', 'info')}
      <div class="gap-m" style="margin-top:.8rem">${list.map((o) => { const crit = o.result.items.filter((r) => r.flag === 'C'); const dl = o.result.delta || [];
        return `<div class="box" style="background:var(--surface)${crit.length ? ';border-color:var(--t-stat)' : ''}"><div class="row between">${pLine(o)}<div class="row">${UI.chip(partOf(o), 'sent')}<b>${esc(o.name)}</b></div></div>
          <div class="row" style="margin:.5rem 0">${o.result.items.map((r) => `<span class="chip ${r.flag === 'C' ? 'solid-stat' : r.flag ? 'prog' : 'plain'}">${esc(r.n)} <b>${esc(r.v)}</b> ${esc(r.u || '')}</span>`).join('')}</div>
          ${dl.length ? UI.note(`델타 체크 — ${dl.map(esc).join(', ')} : 같은 환자 검체가 맞는지, 수액 맞는 팔에서 채혈하지 않았는지 확인`, 'warn') : ''}${o.result.ast ? `<p class="small" style="margin:0">감수성: ${Object.entries(o.result.ast).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}</p>` : ''}
          <div class="btn-row end">${UI.btn('다시 입력', 'lb.back', { size: 'sm', data: { id: o.id } })}${crit.length ? UI.btn('위험값 보고 후 결과 보고', 'lb.crit', { kind: 'danger', icon: 'alert', data: { id: o.id } }) : UI.btn('검증 완료 → 결과 보고', 'lb.report', { kind: 'pri', icon: 'send', data: { id: o.id } })}</div></div>`; }).join('') || UI.empty('검증할 결과가 없습니다')}</div>`;
  }
  function tabQC() {
    const an = ms('qcan', Object.keys(QC)[0]); const q = QC[an];
    const today = S.where('recs', (r) => r.kind === 'qc' && r.at >= T.startOfDay()).sort((a, b) => b.at - a.at);
    return `<div class="gap-m">${UI.note('정도관리(QC): 매일 환자 검사 전에 농도를 아는 관리 물질을 측정해 장비가 정확한지 봅니다. 레비-제닝스 그래프와 웨스트가드 규칙(1-2s 경고, 1-3s·2-2s 거부)으로 판정하고, 거부면 원인을 고친 뒤 다시 측정할 때까지 환자 결과를 보고하지 않습니다.', 'info')}
      ${UI.seg('qc.an', Object.keys(QC).map((k) => ({ v: k, l: `${k.split(' (')[0]} ${qcToday(k) ? '(' + qcToday(k) + ')' : ''}` })), an)}
      <div class="grid2">${['L1', 'L2'].map((lv) => `<div class="panel"><div class="panel-b">${lj(an, lv)}</div></div>`).join('')}</div>
      <form data-submit="qc.run" class="row box"><input type="hidden" name="an" value="${esc(an)}">${UI.input('L1', `${q.n} 낮은 농도 (평균 ${q.L1[0]})`, '', { type: 'number', step: 'any' })}${UI.input('L2', `${q.n} 높은 농도 (평균 ${q.L2[0]})`, '', { type: 'number', step: 'any' })}${UI.btn('측정값 불러오기', 'qc.fill', { icon: 'refresh' })}${UI.btn('정도관리 판정', '', { type: 'submit', kind: 'pri' })}</form>
      ${UI.table([{ h: '시각' }, { h: '장비' }, { h: '농도' }, { h: '측정값' }, { h: '판정' }, { h: '규칙' }, { h: '조치' }], today.map((r) => [`<span class="num small">${T.hm(r.at)}</span>`, esc(r.an.split(' (')[0]), r.lv === 'L1' ? '낮음' : '높음', `<span class="num">${r.v}</span>`, UI.chip(r.res, r.res === '통과' ? 'done' : r.res === '경고' ? 'prog' : 'stat'), esc(r.why || ''), esc(r.fix || '')]), { empty: '<p class="muted small">오늘 정도관리 기록이 없습니다</p>' })}</div>`;
  }
  function tabDone() {
    const list = S.where('orders', (o) => isLab(o) && o.status === '결과보고' && o.result && o.result.at >= T.startOfDay() - DAY).sort((a, b) => b.result.at - a.result.at);
    return UI.table([{ h: '보고' }, { h: '환자' }, { h: '파트' }, { h: '검사' }, { h: '이상 항목' }], list.map((o) => [`<span class="num small">${T.mdhm(o.result.at)}</span>`, esc(H.pat(o.patientId).name), esc(partOf(o)), esc(o.name), o.result.items.filter((r) => r.flag).map((r) => `${esc(r.n)} ${esc(r.v)} ${F.flagHtml(r.flag, r.dir)}`).join(' · ') || '<span class="muted">정상</span>']), { empty: UI.empty('보고된 결과가 없습니다') });
  }

  const old = H.mods.lab; // 기존 동작(부적합·위험값·혈액은행·보고)을 그대로 씀
  const cnt = (parts) => inPart(parts, '검사접수').length || '';
  H.reg({
    id: 'lab', title: '진단검사의학과', actor: '임상병리사', layout: 'full', channels: () => ['lab'],
    render() {
      const tab = ms('tab', 'recv');
      const tabs = [{ id: 'recv', label: '검체 접수', icon: 'flask', cnt: S.where('orders', (o) => isLab(o) && o.status === '채혈완료').length || '' }, { id: 'auto', label: '자동화 (화학·면역)', cnt: cnt(['자동화', '면역']) }, { id: 'hema', label: '혈액', cnt: cnt(['혈액']) }, { id: 'urine', label: '요검사', cnt: cnt(['요검사']) },
        { id: 'micro', label: '미생물', cnt: cnt(['미생물']) }, { id: 'mol', label: '분자진단', cnt: cnt(['분자진단']) }, { id: 'ref', label: '위탁검사', cnt: cnt(['위탁']) }, { id: 'bank', label: '혈액은행', icon: 'drop', cnt: S.where('orders', (o) => o.cat === 'BLOOD' && ['전송', '교차시험완료'].includes(o.status)).length || '' },
        { id: 'verify', label: '검증·보고', icon: 'check', cnt: S.where('orders', (o) => isLab(o) && o.status === '결과입력').length || '' }, { id: 'qc', label: '정도관리', icon: 'list' }, { id: 'done', label: '보고 완료' }];
      const BODY = { recv: tabRecv, auto: () => autoPart(['자동화', '면역'], '자동화', '자동화(진단화학·면역) 파트: 혈청 검체를 원심분리해서 화학분석기·면역분석기에 올립니다. 결과는 장비와 연결된 전산(인터페이스)으로 자동으로 들어옵니다. 용혈되면 칼륨이 거짓으로 높게 나옵니다.'),
        hema: () => autoPart(['혈액'], '혈액', '혈액 파트: 혈구분석기로 CBC, 응고분석기로 PT·aPTT를 봅니다. 장비가 이상 세포 신호를 내거나 수치가 크게 벗어나면 말초혈액 도말을 만들어 현미경으로 확인합니다.'), urine: tabUrine, micro: tabMicro, mol: tabMol, ref: tabRef, bank: tabBank, verify: tabVerify, qc: tabQC, done: tabDone }; const body = (BODY[tab] || Object.values(BODY)[0])();
      return `<div class="panel">${UI.tabs('lb.tab', tabs, tab)}<div class="panel-b">${body}</div></div>`;
    },
    acts: Object.assign({}, old ? old.acts : {}, {
      'lb.tab': (el) => { set('tab', el.dataset.v); A.render(); },
      'lp.recv': (el) => { const o = S.get('orders', el.dataset.id); F.advance(o, '검사접수'); UI.toast(`접수 → ${partOf(o)} 파트`, 'ok'); A.render(); },
      'lp.recvAll': () => { S.where('orders', (o) => isLab(o) && o.status === '채혈완료').forEach((o) => F.advance(o, '검사접수')); UI.toast('모두 접수 — 파트별로 나뉘었습니다', 'ok'); A.render(); },
      'lp.entry': (el) => entryModal(S.get('orders', el.dataset.id)),
      'lp.fill': (el) => { const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId); const f = el.closest('form'); H.M.item(o.code).items.forEach((x) => { const i = f.querySelector(`[name="v_${x.c}"]`); if (i && !i.value) i.value = H.sim.labValue(p, x); }); },
      'lp.save': (f, d) => { const o = S.get('orders', d.id); const items = itemsFrom(o, d); if (items.some((r) => r.v === '')) return UI.toast('모든 항목을 넣어 주세요', 'warn'); const dl = saveResult(o, items); UI.close(); UI.toast(dl.length ? `저장 — 델타 체크 경고: ${dl.join(', ')}` : '결과 저장 — 검증·보고로', dl.length ? 'warn' : 'ok'); A.render(); },
      'lp.bulk': (el) => {
        const parts = el.dataset.parts.split(','); const an = parts.includes('혈액') ? ['혈구분석기 (가상 H-500)'] : ['화학분석기 (가상 C-800)', '면역분석기 (가상 I-600)'];
        if (an.some((a) => qcToday(a) === '거부')) return UI.toast('오늘 정도관리가 "거부"입니다 — 장비를 고치고 정도관리를 다시 통과해야 결과를 받을 수 있습니다', 'err');
        if (an.some((a) => !qcToday(a))) UI.toast('오늘 정도관리를 아직 안 했습니다 — 정도관리 탭에서 먼저 하는 것이 원칙입니다', 'warn');
        const list = inPart(parts, '검사접수'); let warn = 0;
        list.forEach((o) => { const p = H.pat(o.patientId); const items = H.M.item(o.code).items.map((x) => { const v = H.sim.labValue(p, x); const j = F.judge(x, v); return { c: x.c, n: x.n, u: x.u, v, flag: j.flag, dir: j.dir, ref: x.text ? x.normal : `${x.lo ?? ''}~${x.hi ?? ''}` }; }); if (saveResult(o, items).length) warn++; });
        UI.toast(`장비 결과 ${list.length}건 수신${warn ? ` — 델타 체크 ${warn}건 확인` : ''}`, warn ? 'warn' : 'ok'); A.render();
      },
      'lp.fillU': (el) => { const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId); const f = el.closest('form'); H.M.item(o.code).items.forEach((x) => { const i = f.querySelector(`[name="v_${x.c}"]`); if (i && !i.value) i.value = H.sim.labValue(p, x); }); const pos = /많음|양성/.test(H.sim.labValue(p, { c: 'UWBC', text: true, normal: '음성' })); if (pos) { f.querySelector('[name=mWBC]').value = '많음'; f.querySelector('[name=mBac]').value = '많음'; } },
      'lp.urine': (f, d) => { const o = S.get('orders', d.id); const items = itemsFrom(o, d); if (items.some((r) => r.v === '')) return UI.toast('시험지 항목을 모두 넣어 주세요', 'warn'); items.push({ c: 'UM', n: '현미경 (적혈구·백혈구·세균)', u: '/HPF', v: `${d.mRBC} · ${d.mWBC} · ${d.mBac}`, flag: d.mWBC !== '0~5' || d.mBac !== '없음' ? 'A' : '', ref: '0~2 · 0~5 · 없음' }); saveResult(o, items); UI.toast('요검사 결과 저장', 'ok'); A.render(); },
      'mb.culture': (f, d) => { const o = S.get('orders', d.id); o.micro = { stage: '배양 중', media: d.media || [], at: Date.now(), by: H.who() }; S.save(); UI.toast('배양 시작', 'ok'); A.render(); },
      'mb.prelim': (f, d) => {
        const o = S.get('orders', d.id); const p = H.pat(o.patientId); Object.assign(o.micro, { stage: '예비 보고', growth: d.growth, gram: d.gram, prelimAt: Date.now() }); S.save();
        if (d.growth === 'Y') { const msg = `미생물 예비 보고: ${p.name} ${o.name} — 균 자람 (${d.gram})${o.code === 'L1020' ? ' ⚠ 혈액배양 양성' : ''}`; H.notify('doctor', msg, { patientId: p.id, level: o.code === 'L1020' ? 'stat' : '' }); if (o.ward) H.notify('ward:' + o.ward, msg, { patientId: p.id, level: o.code === 'L1020' ? 'stat' : '' }); }
        UI.toast(d.growth === 'Y' ? '예비 보고 — 의사·병동에 알렸습니다 (경험적 항생제 확인)' : '예비 보고: 균 자라지 않음', d.growth === 'Y' ? 'warn' : 'ok'); A.render();
      },
      'mb.id': (f, d) => { const o = S.get('orders', d.id); if (o.micro.growth === 'N') { const it = H.M.item(o.code); saveResult(o, it.items.map((x) => ({ c: x.c, n: x.n, u: '', v: x.c === 'SGram' ? o.micro.gram : it.items.length > 1 && x.c !== it.items[it.items.length - 1].c ? x.normal : '균 자라지 않음', flag: '', ref: x.normal }))); o.micro.stage = '최종 보고'; S.save(); UI.toast('최종 보고 — 검증으로', 'ok'); A.render(); return; } o.micro.org = d.org; o.micro.stage = '동정·감수성'; S.save(); UI.toast(`동정: ${ORG[d.org].ko}`, 'ok'); A.render(); },
      'mb.final': (f, d) => {
        const o = S.get('orders', d.id); const it = H.M.item(o.code); const org = ORG[o.micro.org]; const ast = {}; Object.keys(org.ast).forEach((ab) => { ast[ab] = d['ab_' + ab] || org.ast[ab]; });
        const res = Object.entries(ast).filter(([, v]) => v === 'R').map(([k]) => k);
        const items = it.items.map((x, i) => ({ c: x.c, n: x.n, u: '', v: x.c === 'SGram' ? o.micro.gram : `${org.ko}${res.length ? ` — 내성: ${res.join(', ')}` : ''}`, flag: 'A', ref: x.normal }));
        saveResult(o, items, { ast, org: org.ko }); o.micro.stage = '최종 보고'; S.save();
        if (/MRSA|내성/.test(org.ko)) H.notify('ic', `다제내성균 검출: ${H.pat(o.patientId).name} — ${org.ko} (접촉 격리 필요)`, { patientId: o.patientId, level: 'stat' });
        UI.toast('감수성 결과 저장 — 검증·보고로', 'ok'); A.render();
      },
      'mo.step': (f, d) => {
        const o = S.get('orders', d.id); o.mol = o.mol || { step: 0 };
        if (o.mol.step < 2) { if ((d.c || []).length < 3) return UI.toast('세 가지를 확인하세요', 'warn'); o.mol.step += 1; S.save(); A.render(); return; }
        const it = H.M.item(o.code); const items = it.items.map((x) => ({ c: x.c, n: x.n, u: 'Ct', v: d['v_' + x.c] === '양성' ? `양성 (Ct ${d['ct_' + x.c]})` : '음성', flag: d['v_' + x.c] === '양성' ? 'A' : '', ref: '음성' }));
        saveResult(o, items); if (items.some((r) => r.flag) && o.code === 'L1027') H.notify('ic', `호흡기 바이러스 양성: ${H.pat(o.patientId).name} — 비말 격리 검토`, { patientId: o.patientId }); UI.toast('분자진단 결과 저장', 'ok'); A.render();
      },
      'rf2.send': (el) => UI.modal({ title: '위탁 발송', size: 'narrow', body: `<form data-submit="rf2.sendGo" class="gap-m"><input type="hidden" name="id" value="${el.dataset.id}">${UI.select('org', '수탁기관', ORGS, ORGS[0])}${UI.fld('보관 조건', pick('keep', ['냉장 (2~8℃)', '냉동 (-20℃)', '실온'], '냉장 (2~8℃)'))}${checks('c', ['의뢰서·검체 라벨 일치', '혈청 분리 후 전용 용기', '온도 기록계 동봉', '운송 담당자 인계 서명'])}<div class="btn-row end">${UI.btn('발송', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }),
      'rf2.sendGo': (f, d) => { if ((d.c || []).length < 4) return UI.toast('발송 확인 4가지를 하세요', 'warn'); const o = S.get('orders', d.id); o.ref = { org: d.org, keep: d.keep, at: Date.now(), by: H.who() }; S.save(); UI.close(); UI.toast('위탁 발송 — 결과는 2~7일 뒤', 'ok'); A.render(); },
      'rf2.recv': (el) => { const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId); const items = H.M.item(o.code).items.map((x) => { const v = H.sim.labValue(p, x); const j = F.judge(x, v); return { c: x.c, n: x.n, u: x.u, v, flag: j.flag, dir: j.dir, ref: `${x.lo ?? ''}~${x.hi ?? ''}` }; }); saveResult(o, items, { refOrg: o.ref.org }); UI.toast(`${o.ref.org} 결과 수신 — 검증·보고로`, 'ok'); A.render(); },
      'qc.an': (el) => { set('qcan', el.dataset.v); A.render(); },
      'qc.fill': (el) => { const f = el.closest('form'); const q = QC[f.querySelector('[name=an]').value]; ['L1', 'L2'].forEach((lv) => { const [m, sd] = q[lv]; const z = Math.random() < 0.2 ? 2.4 : Math.random() * 2.4 - 1.2; f.querySelector(`[name=${lv}]`).value = (m + z * sd).toFixed(sd < 0.1 ? 3 : 1); }); },
      'qc.run': (f, d) => {
        const q = QC[d.an]; const out = [];
        ['L1', 'L2'].forEach((lv) => { const v = H.num(d[lv]); if (v == null) return; const [m, sd] = q[lv]; const prev = S.where('recs', (r) => r.kind === 'qc' && r.an === d.an && r.lv === lv).sort((a, b) => a.at - b.at).map((r) => (r.v - m) / sd); const w = westgard([...prev, (v - m) / sd]); H.addRec('qc', null, { an: d.an, lv, v, res: w.r, why: w.why, fix: w.r === '거부' ? '시약·보정 확인 후 재측정' : '' }); out.push(`${lv === 'L1' ? '낮은' : '높은'} 농도 ${w.r}`); });
        if (!out.length) return UI.toast('측정값을 넣어 주세요', 'warn');
        UI.toast(`정도관리: ${out.join(', ')}`, out.some((x) => x.includes('거부')) ? 'err' : out.some((x) => x.includes('경고')) ? 'warn' : 'ok'); A.render();
      },
    }),
  });
})();
