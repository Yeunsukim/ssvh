// 진료비 계산 장치 (교육용 근사치 — 상급종합병원 기준)
// 처방 → 수가 항목 → 급여/비급여 → 자격·산정특례에 따른 본인부담 → 계산서·영수증
(function () {
  const H = window.H;
  const S = H.store;
  const F = H.flow;
  const esc = H.esc;
  const DAY = 86400000;

  const SPECIAL = [
    { code: 'V193', name: '암 산정특례', rate: 0.05 },
    { code: 'V191', name: '뇌혈관질환 산정특례 (개두술 등)', rate: 0.05 },
    { code: 'V192', name: '심장질환 산정특례 (관상동맥 중재술·개심술)', rate: 0.05 },
    { code: 'V001', name: '혈액투석 산정특례', rate: 0.10 },
    { code: 'V800', name: '희귀질환 산정특례', rate: 0.10 },
    { code: 'V247', name: '중증 화상 산정특례', rate: 0.05 },
  ];
  const BASE = {
    new: { code: 'AA157', name: '초진 진찰료 (상급종합병원)', price: 23300, group: '진찰료' },
    re: { code: 'AA257', name: '재진 진찰료 (상급종합병원)', price: 16700, group: '진찰료' },
    er: { code: 'V1100', name: '응급의료관리료 (권역응급의료센터)', price: 72000, group: '응급의료관리료' },
    erc: { code: 'AA157', name: '응급실 진찰료', price: 23300, group: '진찰료' },
    ward: { code: 'AB101', name: '입원료 (상급종합 일반병동 다인실)', price: 78000, group: '입원료' },
    icu: { code: 'AJ101', name: '중환자실 입원료', price: 360000, group: '입원료' },
    nicu: { code: 'AJ301', name: '신생아중환자실 입원료', price: 420000, group: '입원료' },
    nb: { code: 'AB201', name: '신생아실 입원료', price: 45000, group: '입원료' },
    meal: { code: 'FA101', name: '식대 (일반식, 1끼)', price: 5600, group: '식대' },
    tmeal: { code: 'FA201', name: '식대 (치료식, 1끼)', price: 7300, group: '식대' },
    room1: { code: 'X-1인', name: '상급병실료 차액 (1인실, 1일)', price: 250000, group: '병실 차액', non: true },
    room2: { code: 'X-2인', name: '상급병실료 차액 (2인실, 1일)', price: 120000, group: '병실 차액', non: true },
  };
  const ANES = { 전신마취: 450000, 척추마취: 250000, 경막외마취: 280000, 국소마취: 50000 };
  const GROUP = { MED: '투약 및 조제료', INJ: '주사료', LAB: '검사료', PATH: '검사료 (병리)', PROC: '처치 및 수술료', OP: '처치 및 수술료', BLOOD: '수혈료', CV: '처치 및 수술료', EN: '검사료' };
  const ORDER = ['진찰료', '입원료', '식대', '투약 및 조제료', '주사료', '마취료', '처치 및 수술료', '검사료', '검사료 (병리)', '영상진단료', 'CT 진단료', 'MRI 진단료', '수혈료', '응급의료관리료', '병실 차액', '제증명'];
  const CERTS = [
    { id: 'diag', name: '일반 진단서', price: 20000 }, { id: 'opinion', name: '진료 소견서', price: 10000 },
    { id: 'admit', name: '입·퇴원 확인서', price: 3000 }, { id: 'opconf', name: '수술 확인서', price: 3000 },
    { id: 'pay', name: '진료비 납입 확인서 (연말정산용)', price: 0 }, { id: 'copy', name: '진료기록 사본', price: 1000, perPage: true },
    { id: 'birth', name: '출생 증명서', price: 3000 },
  ];
  const floor10 = (n) => Math.floor(n / 10) * 10;

  const daysOf = (e) => Math.max(1, Math.ceil(((e.endAt || Date.now()) - e.at) / DAY));
  const ageDays = (p) => Math.floor((Date.now() - (p.bornAt || new Date(p.birth).getTime())) / DAY);
  const specialOf = (p) => (p.special ? SPECIAL.find((s) => s.code === p.special.code) || { code: p.special.code, name: p.special.name, rate: 0.1 } : null);
  const done = (o) => {
    if (F.isOff(o)) return false;
    if (o.cat === 'MED' || o.cat === 'INJ') return o.status === '불출' || !!o.done;
    if (o.cat === 'OP') return ['수술중', '회복실', '병동이송'].includes(o.status);
    if (o.cat === 'CV' || o.cat === 'EN') return F.stepIndex(o) >= 3;
    if (o.cat === 'LAB') return F.stepIndex(o) >= 1 || F.isDone(o);
    if (o.cat === 'RAD') return F.stepIndex(o) >= 2 || F.isDone(o);
    if (o.cat === 'PATH') return F.stepIndex(o) >= 2 || F.isDone(o);
    return F.isDone(o);
  };

  // 자격별 본인부담률
  function rateInfo(p, e) {
    const ins = p.ins || '건강보험';
    const r = { opd: 0.6, ipd: 0.2, meal: 0.5, label: ins, payer: '국민건강보험공단 (건강보험심사평가원 심사)', flatOpd: null, notes: [] };
    if (ins.startsWith('의료급여 1종')) Object.assign(r, { opd: 0, ipd: 0, meal: 0.2, flatOpd: 2000, payer: '시·군·구 의료급여 (심평원 심사)' });
    else if (ins.startsWith('의료급여 2종')) Object.assign(r, { opd: 0.15, ipd: 0.1, meal: 0.2, payer: '시·군·구 의료급여 (심평원 심사)' });
    else if (ins.startsWith('산재')) Object.assign(r, { opd: 0, ipd: 0, meal: 0, payer: '근로복지공단 (산재보험)' });
    else if (ins.startsWith('자동차')) Object.assign(r, { opd: 0, ipd: 0, meal: 0, payer: '자동차보험사 (지불보증)' });
    else if (ins.startsWith('일반')) Object.assign(r, { opd: 1, ipd: 1, meal: 1, payer: '없음 — 환자가 전액 부담' });
    const nhis = ins.startsWith('건강') || ins.startsWith('의료급여 2');
    if (ins.startsWith('건강') && e.type === 'ER' && e.ktas >= 4 && e.status !== '입원') { r.opd = 0.9; r.notes.push('경증 환자 응급실 이용 (본인부담 90%)'); }
    const sp = specialOf(p);
    if (sp && nhis) { r.opd = Math.min(r.opd, sp.rate); r.ipd = Math.min(r.ipd, sp.rate); r.notes.push(`${sp.name} ${sp.code} (${Math.round(sp.rate * 100)}%)`); }
    if (nhis && e.type === 'IPD' && ageDays(p) <= 28) { r.ipd = 0; r.notes.push('신생아 입원 본인부담 면제'); }
    const birth = p.obs && H.recs(p.id, 'birth')[0];
    if (nhis && e.type === 'IPD' && birth) { if (birth.method === '제왕절개') { r.ipd = Math.min(r.ipd, 0.05); r.notes.push('제왕절개 분만 (5%)'); } else { r.ipd = 0; r.notes.push('자연분만 입원 본인부담 면제'); } }
    const ops = S.where('orders', (o) => o.encId === e.id && o.cat === 'OP' && !F.isOff(o));
    if (nhis && !sp && ops.some((o) => o.code === 'O9008')) r.warn = '개두술 환자 — 뇌혈관질환 산정특례(V191) 등록이 필요합니다 (원무 자격 탭)';
    if (nhis && !sp && ops.some((o) => o.code === 'O9007')) r.warn = '관상동맥 중재술 환자 — 심장질환 산정특례(V192) 등록이 필요합니다';
    if (nhis && !sp && (e.dx || []).some((d) => d.code.startsWith('C'))) r.warn = '암 진단 환자 — 암 산정특례(V193) 등록 여부를 확인하세요';
    return r;
  }

  // 수가 항목 만들기
  function lines(e) {
    const p = H.pat(e.patientId); const out = []; const pend = [];
    const add = (b, qty, extra) => out.push(Object.assign({ code: b.code, name: b.name, price: b.price, qty, amount: b.price * qty, group: b.group, pay: !b.non }, extra || {}));
    const encIds = [e.id];
    if (e.fromEnc) { const src = H.enc(e.fromEnc); if (src && src.type === 'ER' && !src.billed) { encIds.push(src.id); add(BASE.er, 1); add(BASE.erc, 1); } }
    if (e.type === 'OPD') add(e.visit === '재진' ? BASE.re : BASE.new, 1);
    if (e.type === 'ER') { add(BASE.er, 1); add(BASE.erc, 1); }
    if (e.type === 'IPD') {
      const d = daysOf(e);
      const base = e.ward === 'ICU' ? BASE.icu : e.ward === 'NB' ? (e.room === 'NICU' ? BASE.nicu : BASE.nb) : BASE.ward;
      add(base, d, { unit: '일' });
      if (e.diet && !/금식|NPO/.test(e.diet) && e.ward !== 'NB') add(/당뇨|저염|저칼륨|치료/.test(e.diet) ? BASE.tmeal : BASE.meal, d * 3, { unit: '끼', meal: true });
      if (e.roomType && e.roomType.startsWith('1인')) add(BASE.room1, d, { unit: '일' });
      if (e.roomType && e.roomType.startsWith('2인')) add(BASE.room2, d, { unit: '일' });
    }
    S.where('orders', (o) => encIds.includes(o.encId) && !o.outside && !['NUR', 'DIET', 'CONSULT'].includes(o.cat)).forEach((o) => {
      if (F.isOff(o)) return;
      if (!done(o)) { pend.push(o); return; }
      const it = H.M.item(o.code); const price = it.price || 0;
      const qty = o.cat === 'MED' || o.cat === 'INJ' ? (o.qty || 1) : 1;
      let group = GROUP[o.cat] || '처치 및 수술료';
      if (o.cat === 'RAD') group = it.mod === 'CT' ? 'CT 진단료' : it.mod === 'MRI' ? 'MRI 진단료' : '영상진단료';
      out.push({ code: o.code, name: o.name, price, qty, amount: price * qty, group, pay: true, orderId: o.id, at: o.at });
      if (o.cat === 'OP') { const an = (o.op && o.op.anes) || it.anes; out.push({ code: 'L' + o.code.slice(1), name: `마취료 (${an})`, price: ANES[an] || 0, qty: 1, amount: ANES[an] || 0, group: '마취료', pay: true, orderId: o.id }); }
    });
    S.where('certs', (c) => c.encId === e.id && c.price > 0).forEach((c) => out.push({ code: 'CERT', name: c.name, price: c.price, qty: c.qty || 1, amount: c.price * (c.qty || 1), group: '제증명', pay: false, certId: c.id }));
    return { lines: out, pending: pend };
  }

  function calc(e) {
    const p = H.pat(e.patientId);
    const { lines: ls, pending } = lines(e);
    const r = rateInfo(p, e);
    const groups = {};
    let pay = 0, self = 0, ins = 0, non = 0;
    ls.forEach((l) => {
      const g = (groups[l.group] = groups[l.group] || { self: 0, ins: 0, non: 0, total: 0 });
      g.total += l.amount;
      if (!l.pay) { g.non += l.amount; non += l.amount; l.self = l.amount; l.ins = 0; return; }
      const rate = l.meal ? r.meal : e.type === 'IPD' ? r.ipd : r.opd;
      l.self = floor10(l.amount * rate); l.ins = l.amount - l.self; l.rate = rate;
      g.self += l.self; g.ins += l.ins; pay += l.amount; self += l.self; ins += l.ins;
    });
    if (r.flatOpd != null && e.type !== 'IPD') { const flat = Math.min(r.flatOpd, pay); Object.values(groups).forEach((g) => { g.ins += g.self; g.self = 0; }); (groups['진찰료'] || Object.values(groups)[0] || {}).self = flat; ins = pay - flat; self = flat; }
    const prepaid = S.where('bills', (b) => b.encId === e.id && !b.cancel).reduce((s, b) => s + b.paid, 0);
    const totalSelf = self + non;
    return { e, p, lines: ls, pending, groups, r, pay, self, ins, non, total: pay + non, totalSelf, prepaid, due: Math.max(0, totalSelf - prepaid) };
  }

  // 영수증 양식
  function receipt(c, bill) {
    const e = c.e, p = c.p; const won = (n) => (n ? n.toLocaleString('ko-KR') : '0');
    const period = e.type === 'IPD' ? `${H.t.d(e.at)} ~ ${H.t.d(e.endAt || Date.now())} (${daysOf(e)}일)` : H.t.d(e.at);
    const rows = ORDER.filter((g) => c.groups[g]).map((g) => { const x = c.groups[g]; return `<tr><td>${esc(g)}</td><td class="r">${won(x.self)}</td><td class="r">${won(x.ins)}</td><td class="r">${won(x.non)}</td><td class="r">${won(x.total)}</td></tr>`; }).join('');
    return `<div class="paper"><h2>진료비 계산서·영수증</h2>
      <style>.paper td.r{text-align:right;font-family:var(--mono)}</style>
      <table><tr><th>환자 등록번호</th><td class="mono">${esc(p.mrn)}</td><th>환자 성명</th><td>${esc(p.name)}</td><th>진료 기간</th><td>${period}</td></tr>
      <tr><th>진료과</th><td>${esc(e.dept)}</td><th>병실</th><td>${e.type === 'IPD' ? esc(`${e.ward} ${e.room}`) : e.type === 'ER' ? '응급실' : '외래'}</td><th>환자 구분</th><td>${esc(c.r.label)}</td></tr>
      <tr><th>영수증 번호</th><td class="mono">${esc(bill ? bill.no : '(수납 전)')}</td><th>적용</th><td colspan="3">${esc(c.r.notes.join(' / ') || '-')}</td></tr></table>
      <table style="margin-top:.6rem"><thead><tr><th rowspan="2">항목</th><th colspan="2">급여</th><th rowspan="2">비급여</th><th rowspan="2">합계</th></tr><tr><th>본인부담금</th><th>공단(보험자) 부담금</th></tr></thead>
      <tbody>${rows}<tr><th>합계</th><td class="r"><b>${won(c.self)}</b></td><td class="r"><b>${won(c.ins)}</b></td><td class="r"><b>${won(c.non)}</b></td><td class="r"><b>${won(c.total)}</b></td></tr></tbody></table>
      <table style="margin-top:.6rem"><tr><th>진료비 총액</th><td class="r">${won(c.total)}</td><th>환자 부담 총액</th><td class="r">${won(c.totalSelf)}</td></tr>
      <tr><th>이미 낸 금액</th><td class="r">${won(bill ? c.prepaid - bill.paid : c.prepaid)}</td><th>이번에 낸 금액</th><td class="r"><b>${won(bill ? bill.paid : 0)}</b></td></tr>
      <tr><th>보험자 청구처</th><td colspan="3">${esc(c.r.payer)}</td></tr>
      <tr><th>납부 방법</th><td>${esc(bill ? bill.method : '-')}</td><th>수납 일시</th><td>${bill ? H.t.dhm(bill.at) : '-'}</td></tr></table>
      <p style="font-size:.75rem;margin:.6rem 0 0;color:#444">SSV 병원 (상급종합병원) <span class="stamp">수납</span> ※ 교육용 가상 영수증이며 금액은 근사치입니다. 실제 수가와 다릅니다.</p></div>`;
  }
  function detail(c) {
    const won = (n) => n.toLocaleString('ko-KR');
    return `<div class="paper"><h2>진료비 세부산정내역</h2><style>.paper td.r{text-align:right;font-family:var(--mono)}</style>
      <table><thead><tr><th>항목</th><th>코드</th><th>명칭</th><th>단가</th><th>횟수</th><th>금액</th><th>급여</th><th>본인부담</th></tr></thead><tbody>
      ${ORDER.flatMap((g) => c.lines.filter((l) => l.group === g).map((l) => `<tr><td>${esc(g)}</td><td class="mono">${esc(l.code)}</td><td>${esc(l.name)}</td><td class="r">${won(l.price)}</td><td class="r">${l.qty}${esc(l.unit || '')}</td><td class="r">${won(l.amount)}</td><td>${l.pay ? '급여' : '비급여'}</td><td class="r">${won(l.self)}</td></tr>`)).join('')}
      </tbody></table></div>`;
  }

  // ── 보험 심사 규칙 (교육용) ──
  const INFECT = ['J18.9', 'N10', 'N39.0', 'A41.9', 'R65.1', 'K81.0', 'K35.8', 'J44.1', 'J06.9'];
  function audit(e) {
    const c = calc(e); const p = c.p; const dx = (e.dx || []).map((d) => d.code); const res = [];
    if (!dx.length) res.push({ type: '반송', code: 'D', name: '명세서 전체', cut: c.ins, reason: '주상병(진단명)이 없습니다 — 접수 불가, 상병 기재 후 다시 청구' });
    const sp = specialOf(p);
    if (sp && sp.code === 'V193' && !dx.some((d) => d.startsWith('C'))) res.push({ type: '반송', code: 'D', name: '산정특례 적용', cut: 0, reason: '암 산정특례(V193)를 적용했으나 암 상병(C코드)이 없습니다' });
    const seen = {};
    c.lines.filter((l) => l.orderId).forEach((l) => {
      const o = S.get('orders', l.orderId); const it = H.M.item(o.code); const day = H.t.d(o.at);
      const k = o.code + day;
      if (o.cat === 'LAB' || o.cat === 'RAD') { if (seen[k]) res.push({ type: '삭감', code: 'C', name: l.name, orderId: o.id, cut: l.ins, reason: '같은 날 같은 검사 중복 청구' }); seen[k] = 1; }
      if (o.code === 'L1008' && !dx.some((d) => ['A41.9', 'R65.1'].includes(d))) res.push({ type: '삭감', code: 'A', name: l.name, orderId: o.id, cut: l.ins, reason: '프로칼시토닌 검사는 패혈증 등 중증 세균 감염이 의심될 때 인정 — 해당 상병 없음' });
      if (o.code === 'J0218') { const alb = F.lastLab(p.id, 'Alb'); if (!alb || alb.v >= 2.5) res.push({ type: '삭감', code: 'B', name: l.name, orderId: o.id, cut: l.ins, reason: `알부민 주사는 혈청 알부민 2.5 미만 등일 때 인정 — 투여 전 알부민 ${alb ? alb.v : '검사 없음'}` }); }
      if (o.code === 'R3008' && !dx.some((d) => /^(I6|G45)/.test(d))) res.push({ type: '삭감', code: 'A', name: l.name, orderId: o.id, cut: l.ins, reason: '뇌 MRI는 뇌혈관질환 등 상병이 있을 때 급여 인정' });
      if (o.code === 'J0221' && !dx.includes('I63.9')) res.push({ type: '삭감', code: 'A', name: l.name, orderId: o.id, cut: l.ins, reason: '혈전용해제는 급성 뇌경색 상병이 있어야 인정' });
      if (H.M.clsHas(it, 'antibiotic') && !['J0233', 'J0225'].includes(o.code) && !dx.some((d) => INFECT.includes(d))) res.push({ type: '삭감', code: 'A', name: l.name, orderId: o.id, cut: l.ins, reason: '항생제 사용에 맞는 감염 상병이 없습니다' });
    });
    return { c, items: res, cutTotal: res.filter((x) => x.type === '삭감').reduce((s, x) => s + x.cut, 0), returned: res.some((x) => x.type === '반송') };
  }

  H.fee = { SPECIAL, CERTS, BASE, rateInfo, lines, calc, receipt, detail, audit, daysOf, specialOf, floor10 };
})();
