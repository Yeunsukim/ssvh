// 원무 수납·정산: 외래·응급 수납, 중간정산, 퇴원 수납, 영수증, 자격·산정특례, 제증명, 계약처 청구·미수
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const FE = () => H.fee;
  const won = (n) => H.won(n);

  const kindOf = (e) => e.type === 'OPD' ? '외래 수납' : e.type === 'ER' ? '응급실 수납' : e.dc && e.dc.review ? '퇴원 수납' : '중간 정산';
  const waiting = (e) => !e.billed && ((e.type === 'OPD' && e.status === '진료완료') || (e.type === 'ER' && ['귀가', '전원'].includes(e.status)) || (e.type === 'IPD' && e.status === '입원중' && e.dc));
  const curEnc = () => A.enc();

  function list() {
    const f = A.ms('f', 'wait');
    let encs;
    if (f === 'wait') encs = S.where('encounters', waiting);
    else if (f === 'ipd') encs = S.where('encounters', (e) => e.type === 'IPD' && e.status === '입원중');
    else encs = S.where('encounters', (e) => e.billed && e.billed >= T.startOfDay() - 3 * 86400000);
    encs.sort((a, b) => b.at - a.at);
    return {
      title: '수납 환자', filter: UI.seg('bl.f', [{ v: 'wait', l: '수납 대기' }, { v: 'ipd', l: '재원 중' }, { v: 'done', l: '수납 완료' }], f),
      rows: encs.map((e) => { const p = H.pat(e.patientId); const kind = kindOf(e); return { pid: p.id, encId: e.id, loc: { OPD: '외래', ER: '응급', IPD: e.ward }[e.type], name: p.name,
        marks: e.billed ? UI.chip('완료', 'done') : e.dc ? UI.chip(e.dc.review ? '퇴원 수납' : '퇴원 심사 중', e.dc.review ? 'stat' : 'prog') : UI.chip(kind, 'sent'), sub: `${H.sexAge(p)} · ${esc(p.ins)} · ${esc(e.dept)}` }; }),
      empty: f === 'wait' ? '수납 대기 환자가 없습니다. 외래 진료 완료·응급실 귀가·퇴원 심사가 끝나면 여기에 나타납니다.' : '환자가 없습니다',
    };
  }

  function tabCalc(e) {
    const c = FE().calc(e);
    const warn = [];
    if (c.pending.length) warn.push(`아직 시행되지 않은 처방 ${c.pending.length}건 (${c.pending.slice(0, 4).map((o) => esc(o.name)).join(', ')}${c.pending.length > 4 ? ' …' : ''}) — 계산에서 빠집니다. 퇴원 전에 시행하거나 취소해야 합니다.`);
    if (c.r.warn) warn.push(esc(c.r.warn));
    if (e.type === 'IPD' && e.dc && !e.dc.review) warn.push('퇴원 심사가 아직 끝나지 않았습니다 (보험 심사 화면).');
    return `<div class="gap-m">
      ${warn.map((w) => UI.note(w, 'warn')).join('')}
      <div class="grid3"><div class="box"><div class="muted small">진료비 총액</div><div class="score-big">${won(c.total)}</div></div>
        <div class="box"><div class="muted small">보험자 부담 (공단 등)</div><div class="score-big" style="color:var(--t-sent)">${won(c.ins)}</div><div class="small muted">${esc(c.r.payer)}</div></div>
        <div class="box" style="border-color:var(--accent)"><div class="muted small">환자 부담 (낼 돈)</div><div class="score-big" style="color:var(--accent)">${won(c.due)}</div><div class="small muted">본인부담 ${won(c.self)} + 비급여 ${won(c.non)}${c.prepaid ? ` − 이미 낸 돈 ${won(c.prepaid)}` : ''}</div></div></div>
      <div class="box"><h4>본인부담률</h4><div class="row">${UI.chip(c.r.label, 'sent')}${e.type === 'IPD' ? UI.chip(`입원 ${Math.round(c.r.ipd * 100)}%`, 'plain') : c.r.flatOpd != null ? UI.chip(`외래 정액 ${won(c.r.flatOpd)}`, 'plain') : UI.chip(`외래 ${Math.round(c.r.opd * 100)}%`, 'plain')}${UI.chip(`식대 ${Math.round(c.r.meal * 100)}%`, 'plain')}${c.r.notes.map((n) => UI.chip(n, 'purple')).join('')}</div>
        <p class="small muted" style="margin:.5rem 0 0">상급종합병원 기준(교육용 단순화): 건강보험 외래 60%·입원 20%·식대 50% / 의료급여 1종 외래 2,000원·입원 0% / 2종 외래 15%·입원 10% / 산재·자동차보험은 보험자가 부담 / 산정특례 암·심장·뇌 5%, 투석·희귀 10%</p></div>
      ${UI.table([{ h: '항목' }, { h: '본인부담금', cls: 'num' }, { h: '공단 부담금', cls: 'num' }, { h: '비급여', cls: 'num' }, { h: '합계', cls: 'num' }], Object.entries(c.groups).map(([g, x]) => [esc(g), `<span class="num">${won(x.self)}</span>`, `<span class="num">${won(x.ins)}</span>`, `<span class="num">${won(x.non)}</span>`, `<span class="num">${won(x.total)}</span>`]), { empty: UI.empty('계산할 항목이 없습니다') })}
      <div class="btn-row end">${UI.btn('세부산정내역 보기', 'bl.detail', { icon: 'list' })}${UI.btn('계산서 미리보기', 'bl.preview', { icon: 'doc' })}</div></div>`;
  }

  function tabPay(e) {
    const c = FE().calc(e); const kind = kindOf(e);
    const bills = S.where('bills', (b) => b.encId === e.id).sort((a, b) => b.at - a.at);
    if (e.billed) return `${UI.note(`수납 완료 — ${T.dhm(e.billed)}`, 'ok')}${billTable(bills)}`;
    const block = e.type === 'IPD' && e.dc && !e.dc.review;
    return `<div class="gap-m">
      ${block ? UI.note('퇴원 심사가 끝나야 퇴원 수납을 할 수 있습니다. 지금은 중간 정산만 할 수 있습니다.', 'warn') : ''}
      <form data-submit="bl.pay" class="panel"><div class="panel-h"><h3>${esc(block ? '중간 정산' : kind)}</h3></div><div class="panel-b gap-m">
        <div class="row"><span class="muted">받을 금액</span><span class="score-big" style="color:var(--accent)">${won(c.due)}</span></div>
        ${UI.fld('결제 방법', UI.pick('method', ['신용카드', '현금', '계좌이체', '현금 + 현금영수증'], '신용카드'))}
        ${UI.input('recv', '받은 돈 (현금일 때 — 거스름돈 계산)', '', { type: 'number' })}
        <div class="gap-s">${['환자 본인 확인 (신분증)', '계산서 내용 설명 (본인부담·비급여)', e.type === 'IPD' && !block ? '퇴원 약·다음 외래 예약 확인' : '처방전·다음 예약 안내'].map((t) => UI.check('c', t, false, { multi: true, value: t })).join('')}</div>
        <div class="btn-row end">${UI.btn(block || (e.type === 'IPD' && !e.dc) ? '중간 정산 수납' : '수납 완료', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div></div></form>
      ${bills.length ? billTable(bills) : ''}</div>`;
  }
  function billTable(bills) {
    return UI.table([{ h: '수납 시각' }, { h: '영수증 번호' }, { h: '구분' }, { h: '받은 금액', cls: 'num' }, { h: '결제' }, { h: '' }], bills.map((b) => [`<span class="num small">${T.mdhm(b.at)}</span>`, `<span class="mono small">${esc(b.no)}</span>`, esc(b.kind), `<span class="num">${won(b.paid)}</span>`, esc(b.method), UI.btn('영수증', 'bl.receipt', { size: 'sm', data: { id: b.id } })]));
  }

  function tabElig(e) {
    const p = H.pat(e.patientId); const sp = p.special;
    return `<div class="grid2">
      <form data-submit="bl.ins" class="panel"><div class="panel-h"><h3>자격 조회·변경</h3></div><div class="panel-b gap-m">
        ${UI.note('접수·수납할 때 국민건강보험공단 자격을 조회합니다. 자격이 바뀌면(예: 건강보험 → 의료급여, 산재 승인) 본인부담이 달라집니다.', 'info')}
        <div class="row">${UI.btn('공단 자격 조회 (가상)', 'bl.query', { icon: 'search' })}<span class="small muted">${p.eligAt ? `마지막 조회 ${T.mdhm(p.eligAt)}` : ''}</span></div>
        ${UI.select('ins', '보험 자격', ['건강보험', '의료급여 1종', '의료급여 2종', '산재보험', '자동차보험', '일반 (보험 없음)'], p.ins)}
        ${UI.input('payerNo', '산재 승인번호 / 자동차보험 사고접수번호 (해당 시)', (p.payerInfo || {}).no || '')}
        ${UI.input('payerName', '보험사·기관 이름 (해당 시)', (p.payerInfo || {}).name || '')}
        <div class="btn-row end">${UI.btn('자격 저장', '', { type: 'submit', kind: 'pri' })}</div></div></form>
      <form data-submit="bl.special" class="panel"><div class="panel-h"><h3>산정특례 등록</h3></div><div class="panel-b gap-m">
        ${UI.note('산정특례: 암·심장·뇌혈관·희귀질환·중증화상·투석 환자의 본인부담을 5~10%로 낮춰 주는 제도. 의사 진단 후 공단에 등록 신청합니다.', 'info')}
        ${sp ? UI.note(`현재 등록: <b>${esc(sp.code)}</b> ${esc(sp.name)}${sp.at ? ` (${T.d(sp.at)})` : ''}`, 'ok') : '<p class="muted" style="margin:0">등록된 산정특례가 없습니다.</p>'}
        ${UI.select('code', '산정특례 종류', [{ v: '', l: '등록 해제 / 없음' }, ...FE().SPECIAL.map((s) => ({ v: s.code, l: `${s.code} ${s.name} (${Math.round(s.rate * 100)}%)` }))], sp ? sp.code : '')}
        ${UI.check('doc', '의사의 산정특례 신청서·확진 검사 결과 확인', false)}
        <div class="btn-row end">${UI.btn('산정특례 저장', '', { type: 'submit', kind: 'pri' })}</div></div></form></div>`;
  }

  function certPaper(c) {
    const p = H.pat(c.patientId); const e = H.enc(c.encId) || {}; const d = H.M.doctor(e.doctorId);
    const head = (t) => `<h2>${t}</h2><table><tr><th>등록번호</th><td class="mono">${esc(p.mrn)}</td><th>성명</th><td>${esc(p.name)}</td><th>생년월일·성별</th><td>${esc(p.birth)} · ${p.sex === 'M' ? '남' : '여'}</td></tr><tr><th>주소</th><td colspan="5">${esc(p.address || '-')}</td></tr></table>`;
    const foot = `<p style="margin-top:1rem;font-size:.85rem">위와 같이 ${c.id === 'pay' ? '납입하였음을' : '진단(확인)함을'} 증명합니다. &nbsp; 발행일 ${T.d(c.at)} &nbsp; 발행번호 <span class="mono">${esc(c.no)}</span></p>
      <p style="font-size:.85rem">의료기관: SSV 병원 (상급종합병원) · 가상시 한빛로 1 &nbsp; 의사: ${esc(d.name)} (${esc(d.dept)}, 면허번호 가상-${String(Math.abs(d.name.charCodeAt(0) * 37)).slice(0, 5)}) <span class="stamp">인</span></p>
      <p style="font-size:.72rem;color:#555;margin:0">※ 교육용 가상 서류입니다. 실제로 쓸 수 없습니다.</p>`;
    const k = c.content || {};
    if (c.type === 'diag' || c.type === 'opinion') return `<div class="paper">${head(c.type === 'diag' ? '진 단 서' : '소 견 서')}
      <table style="margin-top:.6rem"><tr><th style="width:18%">병명</th><td>${(e.dx || []).map((x) => `${x.main ? '(주) ' : ''}${esc(x.name)}`).join('<br>') || '-'}</td><th style="width:16%">질병분류기호</th><td class="mono">${(e.dx || []).map((x) => esc(x.code)).join('<br>')}</td></tr>
      <tr><th>발병일</th><td>${esc(k.onset || '-')}</td><th>진단일</th><td>${esc(k.diagDate || T.d(c.at))}</td></tr>
      <tr><th>치료 내용·향후 소견</th><td colspan="3" class="pre">${esc(k.opinion || '')}</td></tr>
      <tr><th>입원·외래</th><td colspan="3">${e.type === 'IPD' ? `입원 ${T.d(e.at)} ~ ${e.endAt ? T.d(e.endAt) : '재원 중'}` : `외래 ${T.d(e.at)}`}</td></tr><tr><th>용도</th><td colspan="3">${esc(k.use || '-')}</td></tr></table>${foot}</div>`;
    if (c.type === 'admit') return `<div class="paper">${head('입·퇴원 확인서')}<table style="margin-top:.6rem"><tr><th>진료과</th><td>${esc(e.dept)}</td><th>병명</th><td>${(e.dx || []).map((x) => esc(x.name)).join(', ')}</td></tr><tr><th>입원 기간</th><td colspan="3">${T.d(e.at)} ~ ${e.endAt ? T.d(e.endAt) : '재원 중'} (${FE().daysOf(e)}일)</td></tr><tr><th>용도</th><td colspan="3">${esc(k.use || '-')}</td></tr></table>${foot}</div>`;
    if (c.type === 'opconf') { const op = S.where('orders', (o) => o.encId === e.id && o.cat === 'OP' && !H.flow.isOff(o)); return `<div class="paper">${head('수술 확인서')}<table style="margin-top:.6rem"><tr><th>수술명</th><td>${op.map((o) => esc(o.name)).join('<br>') || '수술 기록 없음'}</td><th>수술일</th><td>${op.map((o) => esc((o.op || {}).date || T.d(o.at))).join('<br>')}</td></tr><tr><th>마취</th><td>${op.map((o) => esc((o.op || {}).anes || '')).join('<br>')}</td><th>용도</th><td>${esc(k.use || '-')}</td></tr></table>${foot}</div>`; }
    if (c.type === 'pay') { const bs = S.where('bills', (b) => b.patientId === p.id && new Date(b.at).getFullYear() === new Date(c.at).getFullYear()); return `<div class="paper">${head('진료비 납입 확인서')}<table style="margin-top:.6rem"><thead><tr><th>수납일</th><th>구분</th><th>영수증 번호</th><th>납부 금액</th></tr></thead><tbody>${bs.map((b) => `<tr><td>${T.d(b.at)}</td><td>${esc(b.kind)}</td><td class="mono">${esc(b.no)}</td><td style="text-align:right">${won(b.paid)}</td></tr>`).join('') || '<tr><td colspan="4">납부 기록 없음</td></tr>'}<tr><th colspan="3">합계 (연말정산 의료비 공제용)</th><td style="text-align:right"><b>${won(bs.reduce((s, b) => s + b.paid, 0))}</b></td></tr></tbody></table>${foot}</div>`; }
    if (c.type === 'birth') return `<div class="paper">${head('출생 증명서')}<table style="margin-top:.6rem">${(() => { const b = H.recs(p.id, 'birth')[0] || {}; return `<tr><th>출생 일시</th><td>${b.at ? T.dhm(b.at) : esc(p.birth)}</td><th>성별</th><td>${p.sex === 'M' ? '남' : '여'}</td></tr><tr><th>체중</th><td>${b.weight || '-'}g</td><th>분만 방법</th><td>${esc(b.method || '-')}</td></tr><tr><th>어머니</th><td colspan="3">${esc(b.mother || '-')}</td></tr>`; })()}</table>${foot}</div>`;
    return `<div class="paper">${head('진료기록 사본 발급 확인')}<table style="margin-top:.6rem"><tr><th>발급 범위</th><td>${esc(k.scope || '-')}</td><th>매수</th><td>${c.qty}매</td></tr><tr><th>신청인</th><td colspan="3">${esc(k.who || '본인')}</td></tr></table>${foot}</div>`;
  }
  H.certPaper = certPaper;

  function tabCert(e) {
    const p = H.pat(e.patientId); const type = A.ms('cert', 'diag'); const ct = FE().CERTS.find((x) => x.id === type);
    const issued = S.where('certs', (c) => c.patientId === p.id).sort((a, b) => b.at - a.at);
    const fields = {
      diag: () => `${UI.input('onset', '발병일', T.d(e.at - 3 * 86400000), { type: 'date' })}${UI.input('diagDate', '진단일', T.d(e.at), { type: 'date' })}${UI.textarea('opinion', '치료 내용·향후 치료 소견 (의사가 씀)', `상기 환자는 위 병명으로 ${e.type === 'IPD' ? '입원' : '외래'} 치료 중이며, 향후 약 2주간 안정 가료가 필요할 것으로 사료됨.`, { h: '4rem' })}`,
      opinion: () => `${UI.textarea('opinion', '소견 (의사가 씀)', '상기 환자는 위 병명으로 치료 중이며 다른 병원 진료 시 참고 바랍니다.', { h: '4rem' })}`,
      copy: () => `${UI.input('scope', '발급 범위', '입원기록·경과기록·검사 결과지', { cls: 'wide' })}${UI.input('qty', '매수', '6', { type: 'number' })}${UI.select('who', '신청인', ['본인', '가족 (가족관계증명서·위임장·신분증 사본)', '대리인 (위임장·동의서·신분증 사본)'], '본인')}`,
    };
    return `<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
      <form data-submit="bl.cert" class="panel"><div class="panel-h"><h3>제증명 발급</h3></div><div class="panel-b gap-m">
        ${UI.seg('bl.certType', FE().CERTS.filter((c) => c.id !== 'birth' || p.bornAt).map((c) => ({ v: c.id, l: c.name })), type)}
        ${UI.note(`${esc(ct.name)} — 발급 수수료 ${ct.price ? won(ct.price) + (ct.perPage ? ' (1~5매 장당, 6매부터 장당 100원)' : '') : '무료'} · 비급여 (보건복지부 고시 상한 이내)`, 'info')}
        <div class="form-grid">${(fields[type] || (() => ''))()}${type !== 'copy' && type !== 'pay' ? UI.select('use', '용도', ['회사 제출', '보험사 청구', '학교 제출', '관공서 제출', '본인 보관'], '보험사 청구') : ''}</div>
        ${UI.check('id', '신청인 신분 확인 (개인정보 보호)', false)}
        <div class="btn-row end">${UI.btn('발급', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'print' })}</div></div></form>
      <div class="panel"><div class="panel-h"><h3>발급 기록</h3></div><div class="panel-b">${UI.table([{ h: '발급일' }, { h: '서류' }, { h: '수수료', cls: 'num' }, { h: '' }], issued.map((c) => [`<span class="num small">${T.mdhm(c.at)}</span>`, esc(c.name), `<span class="num">${won(c.price * (c.qty || 1))}</span>`, UI.btn('보기', 'bl.certView', { size: 'sm', data: { id: c.id } })]), { empty: UI.empty('발급한 서류가 없습니다') })}</div></div></div>`;
  }

  function contract() {
    const bills = S.where('bills', (b) => /근로복지공단|자동차보험사/.test(b.payer || '') && b.ins > 0).sort((a, b) => b.at - a.at);
    return `<div class="gap-m">${UI.note('계약처 청구·미수: 산재(근로복지공단)·자동차보험(보험사)·회사 계약 환자는 병원이 보험자에게 직접 청구하고, 돈이 들어올 때까지 "미수금"으로 관리합니다.', 'info')}
      ${UI.table([{ h: '수납일' }, { h: '환자' }, { h: '청구처' }, { h: '청구할 금액', cls: 'num' }, { h: '상태' }, { h: '' }], bills.map((b) => { const p = H.pat(b.patientId); const st = (b.contract || {}).status || '청구 전'; return [
        `<span class="num small">${T.md(b.at)}</span>`, `<b>${esc(p.name)}</b> <span class="small muted">${esc((p.payerInfo || {}).no || '')}</span>`, esc(b.payer), `<span class="num">${won(b.ins)}</span>`, UI.chip(st, st === '입금 완료' ? 'done' : st === '청구함' ? 'prog' : 'sent'),
        st === '청구 전' ? UI.btn('청구서 발행', 'bl.cClaim', { size: 'sm', kind: 'pri', data: { id: b.id } }) : st === '청구함' ? UI.btn('입금 확인', 'bl.cPaid', { size: 'sm', data: { id: b.id } }) : `<span class="small muted">${T.md(b.contract.at)}</span>`]; }), { empty: UI.empty('계약처 청구 건이 없습니다', '산재·자동차보험 환자를 수납하면 여기에 생깁니다.') })}
      <div class="row box"><span class="muted">미수금 합계</span><span class="score-big">${won(bills.filter((b) => ((b.contract || {}).status || '청구 전') !== '입금 완료').reduce((s, b) => s + b.ins, 0))}</span></div></div>`;
  }

  H.reg({
    id: 'billing', title: '원무 수납·정산', actor: '원무과 직원', layout: 'patient',
    channels: () => ['billing', 'reg'],
    list,
    render() {
      const tab = A.ms('tab', 'calc');
      const tabsAll = [{ id: 'calc', label: '진료비 계산', icon: 'list' }, { id: 'pay', label: '수납', icon: 'check' }, { id: 'elig', label: '자격·산정특례', icon: 'user' }, { id: 'cert', label: '제증명', icon: 'doc' }, { id: 'contract', label: '계약처 청구·미수', icon: 'building' }];
      if (tab === 'contract') return `<div class="panel">${UI.tabs('bl.tab', tabsAll, tab)}<div class="panel-b">${contract()}</div></div>`;
      const e = curEnc();
      if (!e) return `<div class="panel">${UI.tabs('bl.tab', tabsAll, tab)}<div class="panel-b">${UI.empty('왼쪽에서 환자를 고르세요', '수납 대기: 외래 진료 완료 · 응급실 귀가 · 퇴원 예정')}</div></div>`;
      const body = { calc: tabCalc, pay: tabPay, elig: tabElig, cert: tabCert }[tab](e);
      return `<div class="panel">${UI.tabs('bl.tab', tabsAll, tab)}<div class="panel-b">${body}</div></div>`;
    },
    side() {
      const today = S.where('bills', (b) => b.at >= T.startOfDay());
      return `<div class="panel"><div class="panel-h"><h3>오늘 수납 현황</h3></div><div class="panel-b"><dl class="kv"><dt>수납 건수</dt><dd class="num">${today.length}건</dd><dt>받은 돈</dt><dd class="num">${won(today.reduce((s, b) => s + b.paid, 0))}</dd>
        <dt>카드</dt><dd class="num">${won(today.filter((b) => b.method === '신용카드').reduce((s, b) => s + b.paid, 0))}</dd><dt>현금</dt><dd class="num">${won(today.filter((b) => b.method.startsWith('현금')).reduce((s, b) => s + b.paid, 0))}</dd>
        <dt>수납 대기</dt><dd class="num">${S.where('encounters', waiting).length}명</dd></dl></div></div>
        <div class="panel"><div class="panel-h"><h3>퇴원 수납 순서</h3></div><div class="panel-b small"><ol style="margin:0;padding-left:1.2rem;line-height:1.9"><li>의사 퇴원 결정</li><li>병동 퇴원 준비·교육</li><li>보험 심사 (퇴원 심사)</li><li>원무 계산·수납</li><li>퇴원 → 청구(EDI)</li></ol></div></div>`;
    },
    acts: {
      'bl.f': (el) => { A.set('f', el.dataset.v); A.render(); },
      'bl.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'bl.detail': () => { const c = FE().calc(curEnc()); UI.modal({ title: '진료비 세부산정내역', size: 'wide', body: FE().detail(c) }); },
      'bl.preview': () => { const c = FE().calc(curEnc()); UI.modal({ title: '진료비 계산서·영수증 — 미리보기', size: 'wide', body: FE().receipt(c, null) }); },
      'bl.receipt': (el) => { const b = S.get('bills', el.dataset.id); const c = FE().calc(H.enc(b.encId)); UI.modal({ title: '진료비 계산서·영수증', size: 'wide', body: `${FE().receipt(c, b)}<div style="margin-top:1rem">${FE().detail(c)}</div>` }); },
      'bl.pay': (f, d) => {
        const e = curEnc(); const p = H.pat(e.patientId); const c = FE().calc(e);
        if ((d.c || []).length < 2) return UI.toast('본인 확인과 계산서 설명을 확인하세요', 'warn');
        const final = !(e.type === 'IPD' && (!e.dc || !e.dc.review));
        const no = `R${T.d(Date.now()).replace(/-/g, '').slice(2)}-${String(S.all('bills').length + 1).padStart(5, '0')}`;
        const b = S.add('bills', { id: H.uid('bl'), no, encId: e.id, patientId: p.id, kind: final ? kindOf(e) : '중간 정산', at: Date.now(), total: c.total, ins: c.ins, self: c.self, non: c.non, paid: c.due, method: d.method, by: H.who(), payer: c.r.payer, label: c.r.label, groups: c.groups });
        if (final) {
          e.billed = Date.now();
          if (e.fromEnc) { const src = H.enc(e.fromEnc); if (src) src.billed = Date.now(); }
          if (e.type === 'IPD') { e.status = '퇴원'; e.endAt = e.endAt || Date.now(); H.notify('ward:' + e.ward, `퇴원 수납 완료: ${p.name} — 퇴원하실 수 있습니다`, { patientId: p.id }); H.notify('mrd', `퇴원: ${p.name} — 퇴원 분석 대상`, { patientId: p.id }); }
          H.notify('review', `수납 완료: ${p.name} (${b.kind}) — 청구 대상`, { patientId: p.id });
        }
        S.save();
        const change = d.recv ? Number(d.recv) - c.due : 0;
        H.log(b.kind, `${p.name} ${won(c.due)} ${d.method}`, p.id);
        UI.toast(`${b.kind} 완료 — ${won(c.due)}${change > 0 ? ` · 거스름돈 ${won(change)}` : ''}`, 'ok'); A.render();
        UI.modal({ title: '진료비 계산서·영수증', size: 'wide', body: FE().receipt(FE().calc(e), b) });
      },
      'bl.query': () => { const p = H.pat(curEnc().patientId); p.eligAt = Date.now(); S.save(); UI.toast(`공단 자격 조회: ${p.name} — ${p.ins} 자격 유지 확인 (가상)`, 'ok'); A.render(); },
      'bl.ins': (f, d) => { const p = H.pat(curEnc().patientId); const before = p.ins; p.ins = d.ins; p.payerInfo = { no: d.payerNo, name: d.payerName }; S.save(); H.log('자격 변경', `${p.name} ${before} → ${d.ins}`, p.id); UI.toast(`자격 저장: ${d.ins}`, 'ok'); A.render(); },
      'bl.special': (f, d) => {
        const p = H.pat(curEnc().patientId);
        if (d.code && !d.doc) return UI.toast('산정특례 신청서·확진 결과를 확인하세요', 'warn');
        if (!d.code) { delete p.special; } else { const s = FE().SPECIAL.find((x) => x.code === d.code); p.special = { code: s.code, name: `${s.name} (본인부담 ${Math.round(s.rate * 100)}%)`, at: Date.now() }; }
        S.save(); H.log('산정특례', `${p.name} ${d.code || '해제'}`, p.id); UI.toast(d.code ? '산정특례 등록 — 본인부담이 다시 계산됩니다' : '산정특례 해제', 'ok'); A.render();
      },
      'bl.certType': (el) => { A.set('cert', el.dataset.v); A.render(); },
      'bl.cert': (f, d) => {
        if (!d.id) return UI.toast('신청인 신분을 확인하세요', 'warn');
        const e = curEnc(); const ct = FE().CERTS.find((x) => x.id === A.ms('cert', 'diag'));
        const qty = ct.perPage ? Math.max(1, Number(d.qty) || 1) : 1;
        const price = ct.perPage ? (qty <= 5 ? 1000 : 5000 / qty + 100) : ct.price;
        const c = S.add('certs', { id: H.uid('ce'), no: `C${String(S.all('certs').length + 1).padStart(6, '0')}`, encId: e.id, patientId: e.patientId, type: ct.id, name: ct.name, price: Math.round(ct.perPage ? (qty <= 5 ? 1000 : (5000 + (qty - 5) * 100) / qty) : price), qty, content: d, at: Date.now(), by: H.who() });
        if (c.price > 0 && e.billed) S.add('bills', { id: H.uid('bl'), no: `R-C${c.no}`, encId: e.id, patientId: e.patientId, kind: '제증명', at: Date.now(), total: c.price * qty, ins: 0, self: 0, non: c.price * qty, paid: c.price * qty, method: '신용카드', by: H.who(), payer: '-', label: '비급여' });
        H.log('제증명 발급', `${ct.name}`, e.patientId);
        UI.toast(`${ct.name} 발급${c.price ? ` — 수수료 ${won(c.price * qty)}${e.billed ? ' 수납' : ' (진료비와 함께 수납)'}` : ''}`, 'ok'); A.render();
        UI.modal({ title: `${ct.name} — 출력 미리보기`, size: 'wide', body: certPaper(c) });
      },
      'bl.certView': (el) => { const c = S.get('certs', el.dataset.id); UI.modal({ title: c.name, size: 'wide', body: certPaper(c) }); },
      'bl.cClaim': (el) => { const b = S.get('bills', el.dataset.id); b.contract = { status: '청구함', at: Date.now() }; S.save(); UI.toast(`${b.payer}에 청구서를 보냈습니다`, 'ok'); A.render(); },
      'bl.cPaid': (el) => { const b = S.get('bills', el.dataset.id); b.contract = { status: '입금 완료', at: Date.now() }; S.save(); UI.toast('입금 확인 — 미수금이 정리되었습니다', 'ok'); A.render(); },
    },
  });
})();
