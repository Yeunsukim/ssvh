// 의료정보팀: 퇴원 분석 → 미비 기록 → 질병·수술 코딩(KDRG) → 기록 사본·열람 → 통계
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const DAY = 86400000;

  const discharged = () => S.where('encounters', (e) => e.type === 'IPD' && e.status === '퇴원').sort((a, b) => (b.endAt || 0) - (a.endAt || 0));
  const pName = (e) => { const p = H.pat(e.patientId); return `<b>${esc(p.name)}</b> <span class="small muted">${H.sexAge(p)} · ${esc(e.dept)}</span>`; };

  function analyze(e) {
    const notes = S.where('notes', (n) => n.encId === e.id);
    const has = (t) => notes.some((n) => n.type === t);
    const days = H.fee.daysOf(e);
    const prog = notes.filter((n) => n.type === '경과기록').length;
    const ops = S.where('orders', (o) => o.encId === e.id && o.cat === 'OP' && !H.flow.isOff(o));
    const consent = ops.every((o) => o.op && o.op.preop && (o.op.preop.checks || []).some((c) => c.includes('동의서')));
    return [
      { item: '입원기록', ok: has('입원기록'), who: 'doctor' },
      { item: `경과기록 (재원 ${days}일 — 최소 ${Math.max(1, Math.floor(days / 2))}건)`, ok: prog >= Math.max(1, Math.floor(days / 2)), who: 'doctor', key: '경과기록' },
      { item: '퇴원요약', ok: has('퇴원요약'), who: 'doctor' },
      ...(ops.length ? [{ item: '수술기록', ok: has('수술기록') || ops.every((o) => o.op && o.op.note), who: 'doctor' }, { item: '수술·마취 동의서', ok: consent, who: 'ward', key: '동의서' }] : []),
      { item: '간호기록', ok: S.where('nnotes', (n) => n.encId === e.id || (n.patientId === e.patientId && n.at >= e.at && n.at <= (e.endAt || Date.now()))).length > 0, who: 'ward' },
      { item: '진단명(상병 코드)', ok: (e.dx || []).length > 0, who: 'doctor' },
      { item: '모든 의사 기록 전자서명', ok: notes.every((n) => n.signed), who: 'doctor', key: '전자서명' },
    ];
  }
  const openDefs = (eid) => S.where('defs', (d) => d.encId === eid && d.status !== '완료');

  function tabAnalysis() {
    const list = discharged().filter((e) => !(e.mrd && e.mrd.analyzed));
    return `<div class="gap-m">${UI.note('퇴원 분석: 퇴원한 환자의 의무기록이 빠짐없이 작성·서명되었는지 확인합니다. 빠진 기록은 "미비"로 등록해 담당 의사·간호사에게 작성을 요청합니다 (보통 퇴원 후 14일 안에 완료).', 'info')}
      ${list.map((e) => { const r = analyze(e); const miss = r.filter((x) => !x.ok);
        return `<div class="panel"><div class="panel-h">${pName(e)}<span class="grow"></span><span class="small muted">퇴원 ${e.endAt ? T.d(e.endAt) : '-'} · 주치의 ${esc(H.M.doctor(e.doctorId).name)}</span></div><div class="panel-b gap-m">
          <div class="row">${r.map((x) => UI.chip(`${x.ok ? '✓' : '✗'} ${x.item}`, x.ok ? 'done' : 'stat')).join('')}</div>
          <div class="btn-row end">${miss.length ? UI.btn(`미비 ${miss.length}건 등록 → 작성 요청`, 'mr.def', { kind: 'warn', data: { id: e.id } }) : ''}${UI.btn('분석 완료', 'mr.done', { kind: 'pri', data: { id: e.id } })}</div></div></div>`; }).join('') || UI.empty('분석할 퇴원 환자가 없습니다', '원무에서 퇴원 수납이 끝나면 여기에 나타납니다.')}</div>`;
  }
  function tabDefs() {
    const list = S.all('defs').slice().sort((a, b) => (a.status === '완료') - (b.status === '완료') || a.at - b.at);
    return `<div class="gap-m">${UI.note('미비 기록 관리: 퇴원 후 14일이 지나도 완성되지 않은 기록은 "장기 미비"로 의료기관 인증평가에서 감점됩니다. 의사가 기록을 쓰면 "완료 확인"을 누르세요. 실습에서는 의사 역할로 바로 작성해 볼 수 있습니다.', 'info')}
      ${UI.table([{ h: '등록' }, { h: '환자' }, { h: '빠진 기록' }, { h: '담당' }, { h: '경과' }, { h: '상태' }, { h: '' }], list.map((d) => { const e = H.enc(d.encId); const p = H.pat(e.patientId); const days = Math.floor((Date.now() - (e.endAt || d.at)) / DAY);
        return [`<span class="num small">${T.md(d.at)}</span>`, esc(p.name), `<b>${esc(d.item)}</b>`, esc(d.to), days >= 14 && d.status !== '완료' ? UI.chip(`퇴원 ${days}일 — 장기 미비`, 'stat') : `<span class="num">퇴원 ${days}일</span>`,
          UI.chip(d.status, d.status === '완료' ? 'done' : 'prog'),
          d.status === '완료' ? `<span class="small muted">${T.md(d.doneAt)}</span>` : `<div class="row" style="flex-wrap:nowrap;gap:.3rem">${d.item.startsWith('퇴원요약') || d.item.startsWith('경과') || d.item.startsWith('입원기록') || d.item.startsWith('수술기록') ? UI.btn('의사 역할로 작성', 'mr.write', { size: 'sm', data: { id: d.id } }) : ''}${UI.btn('완료 확인', 'mr.check', { size: 'sm', kind: 'pri', data: { id: d.id } })}${UI.btn('독촉', 'mr.remind', { size: 'sm', data: { id: d.id } })}</div>`]; }), { empty: UI.empty('미비 기록이 없습니다') })}</div>`;
  }
  const MDC = { A: '감염·기생충', C: '신생물 (암)', D: '혈액', E: '내분비·대사', F: '정신', G: '신경계', I: '순환기계', J: '호흡기계', K: '소화기계', M: '근골격계', N: '신장·비뇨기계', O: '임신·출산', P: '신생아', R: '증상·징후', S: '손상', Z: '건강 상태' };
  const DRG7 = { O9003: '충수절제술', O9005: '제왕절개 분만' };
  function kdrg(e, main, subs) {
    const ops = S.where('orders', (o) => o.encId === e.id && o.cat === 'OP' && !H.flow.isOff(o));
    const sev = subs.length >= 3 ? 3 : subs.length >= 1 ? 2 : 1;
    const area = MDC[(main || 'Z')[0]] || '기타';
    const drg = ops.find((o) => DRG7[o.code]);
    return { text: `${area} ${ops.length ? '수술' : '내과'} — ${ops.length ? ops.map((o) => o.name).join(', ') : (H.M.KCD.find((k) => k.code === main) || { name: main }).name}, 중증도 ${sev}단계`, drg: drg ? `7개 질병군 포괄수가(DRG) 대상: ${DRG7[drg.code]} — 입원 일수와 상관없이 정해진 금액으로 계산` : '' };
  }
  function tabCoding() {
    const list = discharged();
    const sel = A.ms('ce', list[0] ? list[0].id : '');
    const e = list.find((x) => x.id === sel) || list[0];
    if (!e) return UI.empty('코딩할 퇴원 환자가 없습니다');
    const cd = e.coding || {};
    const main = cd.main || ((e.dx || []).find((d) => d.main) || {}).code || '';
    const subs = cd.subs || (e.dx || []).filter((d) => !d.main).map((d) => d.code);
    const k = kdrg(e, main, subs);
    const ops = S.where('orders', (o) => o.encId === e.id && o.cat === 'OP' && !H.flow.isOff(o));
    return `<div class="gap-m">${UI.note('질병·수술 코딩: 퇴원 기록을 읽고 한국표준질병사인분류(KCD)로 주진단·부진단을, 수술·처치를 코드로 정리합니다. 이 자료로 환자분류체계(KDRG), 통계, 연구, 보험 청구가 이루어집니다.', 'info')}
      ${UI.seg('mr.ce', list.map((x) => ({ v: x.id, l: `${H.pat(x.patientId).name} (${T.md(x.endAt || x.at)})` })), e.id)}
      <form data-submit="mr.code" class="panel"><input type="hidden" name="id" value="${e.id}"><div class="panel-h">${pName(e)}${e.coding ? UI.chip('코딩 완료', 'done') : ''}</div><div class="panel-b gap-m">
        <div class="box"><h4>의사 기록에서 찾은 진단</h4>${(e.dx || []).map((d) => `${d.main ? '★ ' : ''}<span class="mono">${esc(d.code)}</span> ${esc(d.name)}`).join('<br>') || '없음'}</div>
        <div class="form-grid">${UI.select('main', '주진단 (입원하게 된 주된 이유)', H.M.KCD.map((x) => ({ v: x.code, l: `${x.code} ${x.name}` })), main, { cls: 'wide' })}</div>
        <div class="fld"><span class="lbl">부진단 (함께 있던 병·합병증)</span><div class="row">${H.M.KCD.filter((x) => (e.dx || []).some((d) => d.code === x.code) || subs.includes(x.code) || ['E11.9', 'I10', 'D64.9', 'E87.5', 'F05.9'].includes(x.code)).map((x) => UI.check('subs', `${x.code} ${x.name}`, subs.includes(x.code), { multi: true, value: x.code })).join('')}</div></div>
        <div class="box"><h4>수술·처치</h4>${ops.map((o) => `<span class="mono">${esc(o.code)}</span> ${esc(o.name)} · ${esc((o.op || {}).anes || '')}`).join('<br>') || '없음'}</div>
        <div class="form-grid">${UI.select('form', '퇴원 형태', ['집으로', '다른 병원으로 전원', '요양병원', '자의 퇴원', '사망'], cd.form || (e.dc || {}).form || '집으로')}${UI.select('result', '치료 결과', ['호전', '불변', '악화', '사망'], cd.result || '호전')}</div>
        ${UI.note(`<b>환자분류 (KDRG 근사):</b> ${esc(k.text)}${k.drg ? `<br><b>${esc(k.drg)}</b>` : ''}`, k.drg ? 'warn' : 'ok')}
        <div class="btn-row end">${UI.btn('코딩 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></div></form></div>`;
  }
  function tabCopy() {
    const pats = S.all('patients');
    const reqs = S.where('certs', (c) => c.type === 'copy').sort((a, b) => b.at - a.at);
    return `<div class="grid2"><form data-submit="mr.copy" class="panel"><div class="panel-h"><h3>진료기록 사본 발급·열람 신청</h3></div><div class="panel-b gap-m">
        ${UI.note('의료법 제21조: 환자 본인 또는 법이 정한 사람(가족·대리인)만 기록을 보거나 사본을 받을 수 있습니다. 서류가 부족하면 발급할 수 없습니다.', 'warn')}
        ${UI.select('pid', '환자', pats.map((p) => ({ v: p.id, l: `${p.name} (${p.mrn})` })), pats[0].id)}
        ${UI.fld('신청인', UI.pick('who', ['환자 본인', '가족 (배우자·직계존비속·배우자의 직계존속)', '대리인 (환자가 지정)'], '환자 본인'))}
        <div class="fld"><span class="lbl">받은 서류</span><div class="gap-s">${['신청인 신분증', '가족관계증명서', '환자의 동의서 (자필 서명)', '환자 신분증 사본', '위임장'].map((t) => UI.check('docs', t, false, { multi: true, value: t })).join('')}</div></div>
        ${UI.fld('발급 범위', `<div class="row">${['입원기록', '경과기록', '수술기록', '퇴원요약', '검사 결과', '영상 판독', '간호기록'].map((t) => UI.check('scope', t, ['퇴원요약', '검사 결과'].includes(t), { multi: true, value: t })).join('')}</div>`)}
        <div class="form-grid">${UI.fld('방식', UI.pick('how', ['사본 (종이)', '사본 (CD·전자)', '열람만'], '사본 (종이)'))}${UI.input('pages', '매수', '6', { type: 'number' })}</div>
        <div class="btn-row end">${UI.btn('발급', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></div></form>
      <div class="panel"><div class="panel-h"><h3>발급·열람 대장</h3></div><div class="panel-b">${UI.table([{ h: '일시' }, { h: '환자' }, { h: '신청인' }, { h: '범위' }, { h: '수수료', cls: 'num' }], reqs.map((c) => [`<span class="num small">${T.mdhm(c.at)}</span>`, esc(H.pat(c.patientId).name), esc((c.content || {}).who || ''), `<span class="small">${esc((c.content || {}).scope || '')}</span>`, `<span class="num">${H.won(c.price * (c.qty || 1))}</span>`]), { empty: UI.empty('기록이 없습니다') })}</div></div></div>`;
  }
  function tabStat() {
    const list = discharged(); const n = list.length;
    const alos = n ? (list.reduce((s, e) => s + H.fee.daysOf(e), 0) / n).toFixed(1) : '-';
    const withDef = list.filter((e) => openDefs(e.id).length).length;
    const byDept = {}; const byDx = {};
    S.where('encounters', (e) => e.type === 'IPD').forEach((e) => { byDept[e.dept] = (byDept[e.dept] || 0) + 1; const m = (e.dx || []).find((d) => d.main); if (m) byDx[`${m.code} ${m.name}`] = (byDx[`${m.code} ${m.name}`] || 0) + 1; });
    const bars = (obj) => { const max = Math.max(1, ...Object.values(obj)); return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `<div class="row"><span style="width:14rem" class="small">${esc(k)}</span><span style="flex:1;background:var(--surface-3);border-radius:4px;height:1.1rem;min-width:4rem"><span style="display:block;height:100%;width:${(v / max) * 100}%;background:var(--accent);border-radius:4px"></span></span><span class="num" style="width:3rem;text-align:right">${v}</span></div>`).join(''); };
    return `<div class="gap-m"><div class="grid3"><div class="box"><div class="small muted">퇴원 환자</div><div class="score-big">${n}명</div></div><div class="box"><div class="small muted">평균 재원 일수</div><div class="score-big">${alos}일</div></div><div class="box"><div class="small muted">미비 기록이 남은 퇴원</div><div class="score-big" style="${withDef ? 'color:var(--t-stat)' : ''}">${n ? Math.round((withDef / n) * 100) : 0}%</div></div></div>
      <div class="grid2"><div class="panel"><div class="panel-h"><h3>진료과별 입원 (재원+퇴원)</h3></div><div class="panel-b gap-s">${bars(byDept)}</div></div><div class="panel"><div class="panel-h"><h3>많은 주진단</h3></div><div class="panel-b gap-s">${bars(byDx)}</div></div></div></div>`;
  }

  H.reg({
    id: 'mrd', title: '의료정보팀', actor: '의무기록사·의료정보 간호사', layout: 'full',
    channels: () => ['mrd'],
    render() {
      const tab = A.ms('tab', 'ana');
      return `<div class="panel">${UI.tabs('mr.tab', [{ id: 'ana', label: '퇴원 분석', icon: 'clip', cnt: discharged().filter((e) => !(e.mrd && e.mrd.analyzed)).length || '' }, { id: 'def', label: '미비 기록', icon: 'alert', cnt: S.where('defs', (d) => d.status !== '완료').length || '' }, { id: 'code', label: '질병·수술 코딩', icon: 'list' }, { id: 'copy', label: '기록 사본·열람', icon: 'copy' }, { id: 'stat', label: '통계', icon: 'eye' }], tab)}
        <div class="panel-b">${{ ana: tabAnalysis, def: tabDefs, code: tabCoding, copy: tabCopy, stat: tabStat }[tab]()}</div></div>`;
    },
    acts: {
      'mr.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'mr.ce': (el) => { A.set('ce', el.dataset.v); A.render(); },
      'mr.def': (el) => {
        const e = H.enc(el.dataset.id); const p = H.pat(e.patientId); const d = H.M.doctor(e.doctorId);
        const miss = analyze(e).filter((x) => !x.ok);
        miss.forEach((m) => { if (!S.where('defs', (x) => x.encId === e.id && x.item === m.item && x.status !== '완료').length) S.add('defs', { id: H.uid('df'), encId: e.id, patientId: p.id, item: m.item, to: m.who === 'doctor' ? `${d.name} (${d.dept})` : `${e.ward} 병동 간호사`, status: '요청', at: Date.now(), by: H.who() }, true); });
        S.save(); H.notify('doctor', `미비 기록 요청: ${p.name} — ${miss.map((m) => m.item).join(', ')}`, { patientId: p.id });
        UI.toast(`미비 ${miss.length}건 등록 — 담당자에게 요청했습니다`, 'ok'); A.render();
      },
      'mr.done': (el) => { const e = H.enc(el.dataset.id); e.mrd = Object.assign(e.mrd || {}, { analyzed: Date.now(), by: H.who() }); S.save(); H.log('퇴원 분석 완료', H.pat(e.patientId).name, e.patientId); UI.toast('퇴원 분석 완료', 'ok'); A.render(); },
      'mr.check': (el) => {
        const d = S.get('defs', el.dataset.id); const e = H.enc(d.encId);
        const item = analyze(e).find((x) => x.item === d.item);
        if (item && !item.ok) return UI.toast('아직 기록이 없습니다 — 담당자에게 독촉하거나 작성을 기다리세요', 'warn');
        d.status = '완료'; d.doneAt = Date.now(); S.save(); UI.toast('미비 해결', 'ok'); A.render();
      },
      'mr.remind': (el) => { const d = S.get('defs', el.dataset.id); d.reminded = (d.reminded || 0) + 1; S.save(); H.notify('doctor', `미비 기록 독촉 (${d.reminded}회): ${H.pat(d.patientId).name} — ${d.item}`, { patientId: d.patientId, level: 'stat' }); UI.toast('독촉 알림을 보냈습니다', 'ok'); },
      'mr.write': (el) => {
        const d = S.get('defs', el.dataset.id); const e = H.enc(d.encId); const type = d.item.split(' ')[0].replace(/\(.*/, '');
        UI.modal({ title: `${type} 작성 (의사 역할)`, body: `<form data-submit="mr.writeGo" class="gap-m"><input type="hidden" name="id" value="${d.id}"><input type="hidden" name="type" value="${esc(type)}">
          ${type === '퇴원요약' ? `${UI.textarea('course', '입원 경과 요약', `${(e.dx || []).map((x) => x.name).join(', ')}로 입원하여 치료 후 호전되어 퇴원함.`, { h: '5rem' })}${UI.textarea('result', '퇴원 시 상태', '활력징후 안정, 통증 조절됨')}${UI.textarea('fu', '외래 추적', (e.dc || {}).fu || '2주 뒤 외래')}`
            : `${UI.textarea('S', 'S', '', { h: '3rem' })}${UI.textarea('O', 'O', '', { h: '3rem' })}${UI.textarea('A', 'A', '', { h: '3rem' })}${UI.textarea('P', 'P', '', { h: '3rem' })}`}
          <div class="btn-row end">${UI.btn('서명하고 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
      },
      'mr.writeGo': (f, d) => {
        const df = S.get('defs', d.id); const e = H.enc(df.encId); const content = {}; ['course', 'result', 'fu', 'S', 'O', 'A', 'P'].forEach((k) => { if (d[k]) content[k] = d[k]; });
        S.add('notes', { id: H.uid('no'), encId: e.id, patientId: e.patientId, type: d.type, at: Date.now(), by: `${H.M.doctor(e.doctorId).name} (의사 — 실습: ${H.who()})`, signed: true, content });
        df.status = '완료'; df.doneAt = Date.now(); S.save(); UI.close(); UI.toast(`${d.type} 작성 — 미비 해결`, 'ok'); A.render();
      },
      'mr.code': (f, d) => {
        const e = H.enc(d.id); const k = kdrg(e, d.main, d.subs || []);
        e.coding = { main: d.main, subs: d.subs || [], form: d.form, result: d.result, kdrg: k.text, drg: k.drg, at: Date.now(), by: H.who() };
        S.save(); H.log('질병 코딩', `${H.pat(e.patientId).name} ${d.main}`, e.patientId); UI.toast('코딩 저장', 'ok'); A.render();
      },
      'mr.copy': (f, d) => {
        const docs = d.docs || []; const need = d.who.startsWith('환자') ? ['신청인 신분증'] : d.who.startsWith('가족') ? ['신청인 신분증', '가족관계증명서', '환자의 동의서 (자필 서명)', '환자 신분증 사본'] : ['신청인 신분증', '위임장', '환자의 동의서 (자필 서명)', '환자 신분증 사본'];
        const lack = need.filter((x) => !docs.includes(x));
        if (lack.length) return UI.toast(`서류 부족: ${lack.join(', ')} — 발급할 수 없습니다`, 'err');
        const pages = d.how === '열람만' ? 0 : Math.max(1, Number(d.pages) || 1);
        const price = pages <= 5 ? 1000 : Math.round((5000 + (pages - 5) * 100) / pages);
        const e = S.where('encounters', (x) => x.patientId === d.pid).sort((a, b) => b.at - a.at)[0] || {};
        S.add('certs', { id: H.uid('ce'), no: `C${String(S.all('certs').length + 1).padStart(6, '0')}`, encId: e.id, patientId: d.pid, type: 'copy', name: `진료기록 ${d.how}`, price: pages ? price : 0, qty: pages || 1, content: { who: d.who, scope: (d.scope || []).join(', '), docs }, at: Date.now(), by: H.who() });
        H.log('진료기록 사본 발급', `${H.pat(d.pid).name} — ${d.who}`, d.pid); UI.toast(`${d.how} 처리 완료${pages ? ` — 수수료 ${H.won(price * pages)}` : ''}`, 'ok'); A.render();
      },
    },
  });
})();
