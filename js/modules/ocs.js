// 처방전달시스템(OCS) + 의사 진료기록(EMR) — 외래 / 입원 / 응급 화면 구성이 다름
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const F = H.flow;
  const V = H.view;

  const MODES = {
    opd: { id: 'ocs-opd', title: '외래 진료', type: 'OPD', cats: ['MED', 'INJ', 'LAB', 'RAD', 'PATH', 'PROC', 'EN', 'CV', 'CONSULT'], notes: ['초진기록', '재진기록'] },
    ipd: { id: 'ocs-ipd', title: '입원 진료', type: 'IPD', cats: ['MED', 'INJ', 'LAB', 'RAD', 'PATH', 'PROC', 'NUR', 'DIET', 'BLOOD', 'OP', 'CV', 'EN', 'CONSULT'], notes: ['입원기록', '경과기록', '퇴원요약'] },
    er: { id: 'ocs-er', title: '응급 진료', type: 'ER', cats: ['MED', 'INJ', 'LAB', 'RAD', 'PATH', 'PROC', 'NUR', 'BLOOD', 'OP', 'CV', 'EN', 'CONSULT'], notes: ['응급실 초진기록', '경과기록'] },
  };

  function make(key) {
    const MD = MODES[key];
    const ms = (k, d) => A.ms(k, d);
    const set = (k, v) => A.set(k, v);
    const enc = () => { const e = A.enc(); return e && e.type === MD.type ? e : null; };
    const pendKey = () => 'pend_' + (A.st.encId || '');
    const pend = () => ms(pendKey(), []) || [];
    const setPend = (list) => set(pendKey(), list);

    function list() {
      let encs = S.where('encounters', (e) => e.type === MD.type);
      if (key === 'opd') {
        encs = encs.filter((e) => e.at >= H.t.startOfDay() || ['대기', '진료중'].includes(e.status));
        const ord = { 진료중: 0, 대기: 1 };
        encs.sort((a, b) => (ord[a.status] ?? 2) - (ord[b.status] ?? 2) || a.at - b.at);
        return { title: '오늘 외래 환자', rows: encs.map((e) => { const p = H.pat(e.patientId); return { pid: p.id, encId: e.id, loc: `${e.dept.slice(0, 2)} ${e.qno || ''}`, name: p.name, marks: UI.chip(e.status, e.status === '진료중' ? 'prog' : e.status === '대기' ? 'sent' : 'done'), sub: `${H.sexAge(p)} · ${esc(e.cc || '')}` }; }), empty: '외래 환자가 없습니다. 원무 접수에서 외래 접수를 하세요.' };
      }
      if (key === 'ipd') {
        const w = ms('ward', 'all');
        encs = encs.filter((e) => e.status === '입원중' && (w === 'all' || e.ward === w)).sort((a, b) => (a.ward + a.room + a.bed).localeCompare(b.ward + b.room + b.bed));
        return { title: '입원 환자', filter: UI.seg('ocs.ward', [{ v: 'all', l: '전체' }, { v: '7A', l: '7A' }, { v: '8B', l: '8B' }, { v: 'ICU', l: '중환자실' }, { v: 'LD', l: '분만실' }, { v: 'NB', l: '신생아' }], w),
          rows: encs.map((e) => { const p = H.pat(e.patientId); return { pid: p.id, encId: e.id, loc: `${e.ward} ${e.room}-${e.bed}`, name: p.name, marks: marks(p, e), sub: `${H.sexAge(p)} · ${esc((e.dx.find((d) => d.main) || e.dx[0] || {}).name || '진단 전')}` }; }) };
      }
      encs = encs.filter((e) => ['대기', '진료중'].includes(e.status)).sort((a, b) => a.ktas - b.ktas || a.at - b.at);
      return { title: '응급실 환자 현황판', rows: encs.map((e) => { const p = H.pat(e.patientId); return { pid: p.id, encId: e.id, loc: `${e.room} ${e.bed}`, name: p.name, marks: UI.chip('KTAS ' + e.ktas, 'ktas' + e.ktas), sub: `${H.sexAge(p)} · 내원 ${Math.round((Date.now() - e.at) / 60000)}분 · ${esc(e.cc || '')}` }; }), empty: '응급실 환자가 없습니다' };
    }
    function marks(p, e) {
      const crit = S.where('orders', (o) => o.encId === e.id && o.cat === 'LAB' && o.result && o.status === '결과보고' && o.result.items.some((r) => r.flag === 'C') && !o.drSeen).length;
      const noti = S.where('comms', (c) => c.patientId === p.id && c.status === '보냄').length;
      return `${crit ? '<span class="dot stat" title="위험값"></span>' : ''}${noti ? '<span class="dot prog" title="간호사 노티"></span>' : ''}`;
    }

    // ── 처방 탭 ──
    function dxBox(e) {
      return `<div class="box"><div class="row between"><h4 style="margin:0">진단명 (상병)</h4><span class="small muted">주진단은 ★ 표시. 진단명은 처방전·보험 청구에 쓰입니다.</span></div>
        <div class="row" style="margin:.5rem 0">${(e.dx || []).map((d, i) => `<span class="chip ${d.main ? 'sent' : 'plain'}" style="font-size:.88rem">${d.main ? '★ ' : ''}<span class="mono">${esc(d.code)}</span> ${esc(d.name)}
          <button class="btn sm ghost" style="min-height:1.8rem;padding:0 .3rem" data-act="ocs.dxMain" data-i="${i}" title="주진단으로">★</button><button class="btn sm ghost" style="min-height:1.8rem;padding:0 .3rem" data-act="ocs.dxDel" data-i="${i}" aria-label="진단 지우기">${H.icon('x')}</button></span>`).join('') || '<span class="muted">아직 진단명이 없습니다</span>'}</div>
        <div class="row"><select class="inp" id="ocs-dx" style="max-width:30rem" aria-label="진단명 고르기">${H.M.KCD.map((k) => `<option value="${k.code}">${k.code} ${esc(k.name)}</option>`).join('')}</select>${UI.btn('진단 추가', 'ocs.dxAdd', { icon: 'plus' })}</div></div>`;
    }
    function searchResults() {
      const cat = ms('cat', 'MED');
      const q = (ms('q', '') || '').trim();
      if (cat === 'SET') return `<div class="grid2">${H.M.SETS.map((s) => `<button class="job" data-act="ocs.addSet" data-id="${s.id}" style="min-height:4.5rem"><b>${esc(s.name)}</b><span>${esc(s.desc)} · ${s.codes.length}개 항목</span></button>`).join('')}</div>`;
      const items = H.M.ALL.filter((x) => x.cat === cat && (!q || x.name.includes(q) || (x.ing || '').includes(q) || x.code.toLowerCase().includes(q.toLowerCase())));
      return `<div class="gap-s" style="max-height:20rem;overflow-y:auto">${items.map((x) => `<button class="btn block" style="justify-content:flex-start;text-align:left;white-space:normal" data-act="ocs.add" data-code="${x.code}">${H.icon('plus')}<span class="grow"><b>${esc(x.name)}</b> ${x.highAlert ? UI.chip('고위험', 'stat') : ''}${x.narcotic ? UI.chip(x.narcotic, 'purple') : ''}${x.contrast ? UI.chip('조영제', 'prog') : ''}
        <span class="small muted" style="display:block">${x.cat === 'MED' || x.cat === 'INJ' ? `<span>${esc(x.ing)}</span> · <span>기본</span> ${x.dose}${esc(x.unit)} · <span>${esc(H.view.freqShort(x.freq))}</span>` : x.tube ? `<span>용기</span>: <span>${esc(x.tube)}</span>` : x.mod ? esc(x.mod) : x.spec ? esc(x.spec) : x.cat === 'OP' ? `<span>${esc(x.dept)}</span> · <span>${esc(x.anes)}</span> · <span>약 ${x.min}분 — 수술실로 신청됩니다</span>` : x.cat === 'CV' ? `<span>약 ${x.min}분 — 심혈관센터로 신청</span>${x.contrast ? ' · <span>조영제 사용</span>' : ''}` : x.cat === 'EN' ? `<span>약 ${x.min}분 — 내시경실로 신청</span> · <span>${esc(x.prep)}</span>` : esc(x.code)}</span></span></button>`).join('') || UI.empty('찾는 처방이 없습니다')}</div>`;
    }
    function pendTable(p) {
      const rows = pend();
      if (!rows.length) return UI.empty('작성 중인 처방이 없습니다', '위에서 처방을 눌러 추가하세요.');
      const fq = Object.entries(H.M.FREQ).map(([k, v]) => ({ v: k, l: v.l }));
      const rt = Object.entries(H.M.ROUTE).map(([k, v]) => ({ v: k, l: v }));
      const sel = (i, f, opts, val) => `<select data-chg="ocs.edit" data-i="${i}" data-f="${f}">${opts.map((o) => `<option value="${o.v}"${o.v === val ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
      const inp = (i, f, val, w = '5rem', type = 'text') => `<input type="${type}" data-chg="ocs.edit" data-i="${i}" data-f="${f}" value="${esc(val == null ? '' : val)}" style="width:${w}">`;
      const ck = (i, f, val, label) => `<label class="chk ${val ? 'on' : ''}" style="min-height:2.4rem;padding:0 .5rem"><input type="checkbox" data-chg="ocs.edit" data-i="${i}" data-f="${f}"${val ? ' checked' : ''}>${label}</label>`;
      const body = rows.map((r, i) => {
        const it = H.M.item(r.code);
        const drug = it.cat === 'MED' || it.cat === 'INJ';
        return [
          `${V.catChip({ cat: it.cat })} <b>${esc(it.name)}</b>`,
          drug ? `<div class="row" style="gap:.3rem;flex-wrap:nowrap">${inp(i, 'dose', r.dose, '5rem', 'number')}<span class="small">${esc(it.unit)}</span></div>` : '-',
          drug ? sel(i, 'route', rt, r.route) : '-',
          drug || it.cat === 'NUR' ? sel(i, 'freq', fq, r.freq) : '-',
          drug ? inp(i, 'days', r.days, '4rem', 'number') : '-',
          `<div class="row" style="gap:.3rem">${['NUR', 'DIET', 'CONSULT'].includes(it.cat) ? '' : ck(i, 'stat', r.stat, '응급')}${key === 'opd' && it.cat === 'MED' ? ck(i, 'outside', r.outside, '원외') : ''}</div>`,
          inp(i, 'note', r.note, '10rem'),
          `<button class="btn sm ghost" data-act="ocs.del" data-i="${i}" aria-label="빼기">${H.icon('x')}</button>`,
        ];
      });
      return UI.table([{ h: '처방' }, { h: '1회 용량' }, { h: '방법' }, { h: '횟수' }, { h: '일수' }, { h: '구분' }, { h: '메모 (지시사항)' }, { h: '' }], body);
    }
    function durBox(p) {
      const w = F.dur(p, pend());
      if (!w.length) return pend().length ? UI.note(`${H.icon('check')} 처방 안전 점검(DUR): 문제 없음`, 'ok') : '';
      return UI.note(`<b>${H.icon('alert')} 처방 안전 점검 (DUR) 경고 ${w.length}건</b><ul style="margin:.4rem 0 0;padding-left:1.2rem">${w.map((x) => `<li style="color:${x.level === 'red' ? 'var(--t-stat)' : 'inherit'}">${esc(x.text)}</li>`).join('')}</ul>`, w.some((x) => x.level === 'red') ? 'danger' : 'warn');
    }
    function tabOrder(p, e) {
      const cat = ms('cat', 'MED');
      const verbal = ms('verbal', '');
      const cats = MD.cats.map((c) => ({ v: c, l: H.M.CAT[c].l }));
      if (key === 'er') cats.unshift({ v: 'SET', l: '묶음처방' });
      const showAll = ms('showAll', false);
      const orders = F.ofEnc(e.id).filter((o) => showAll || o.at >= H.t.startOfDay() || !F.isDone(o));
      return `<div class="gap-m">
        ${topActions(p, e)}
        ${dxBox(e)}
        ${verbal ? UI.note(`<b>구두처방 작성 중</b> — 간호사 노티에 대한 처방입니다. 전송하면 "구두처방"으로 표시되고, 간호사가 확인 서명을 해야 합니다. ${UI.btn('구두처방 취소', 'ocs.verbalOff', { size: 'sm' })}`, 'warn') : ''}
        <div class="box"><div class="row between" style="margin-bottom:.6rem"><h4 style="margin:0">처방 찾기</h4>
          ${key === 'ipd' ? `<div class="row"><span class="small muted">처방 구분</span>${UI.seg('ocs.otype', ['정규', '추가', '퇴원약'], ms('otype', '추가'))}</div>` : ''}</div>
          ${UI.seg('ocs.cat', cats, cat)}
          ${cat !== 'SET' ? `<div class="search fld" style="margin:.6rem 0">${H.icon('search')}<input class="inp" id="ocs-q" data-inp="ocs.q" value="${esc(ms('q', ''))}" placeholder="처방 이름·성분으로 찾기 (예: 세프트리악손, 혈당)" aria-label="처방 찾기"></div>` : '<div style="height:.6rem"></div>'}
          <div id="ocs-results">${searchResults()}</div></div>
        <div class="panel"><div class="panel-h"><h3>작성 중인 처방 (${pend().length})</h3><span class="grow"></span>${pend().length ? UI.btn('모두 지우기', 'ocs.clear', { size: 'sm' }) : ''}</div>
          <div class="panel-b gap-m">${pendTable(p)}<div id="ocs-dur">${durBox(p)}</div>
          <div class="btn-row end">${UI.btn(verbal ? '구두처방 전송' : '처방 전송', 'ocs.send', { kind: 'pri', size: 'lg', icon: 'send', disabled: !pend().length })}</div></div></div>
        <div class="panel"><div class="panel-h"><h3>전송된 처방</h3><span class="grow"></span>${UI.seg('ocs.showAll', [{ v: '', l: '오늘·진행 중' }, { v: '1', l: '전체' }], showAll ? '1' : '')}</div>
          <div class="panel-b">${V.orderTable(orders, { actions: (o) => `<div class="row" style="gap:.3rem;flex-wrap:nowrap">${UI.btn('이력', 'order.hist', { size: 'sm', data: { id: o.id } })}${!F.isDone(o) || (o.cat === 'NUR' || o.cat === 'DIET') && !F.isOff(o) || (o.status === '불출' && !F.isOff(o)) ? UI.btn('중단', 'ocs.dc', { size: 'sm', kind: 'warn', data: { id: o.id } }) : ''}</div>` })}</div></div>
      </div>`;
    }
    function topActions(p, e) {
      if (key === 'opd') {
        const hasRx = S.where('orders', (o) => o.encId === e.id && o.outside && !F.isOff(o)).length;
        return `<div class="row between box" style="background:var(--surface)"><div class="row">${UI.chip(e.status, e.status === '진료중' ? 'prog' : e.status === '대기' ? 'sent' : 'done')}<span><b>오신 이유:</b> ${esc(e.cc || '-')}</span></div>
          <div class="btn-row">${e.status === '대기' ? UI.btn('진료 시작 (환자 호출)', 'ocs.start', { kind: 'pri', icon: 'user' }) : ''}
          ${hasRx ? UI.btn('원외처방전 보기', 'paper.rx', { icon: 'print', data: { enc: e.id } }) : ''}
          ${UI.btn('입원 결정', 'ocs.admit', { icon: 'bed' })}${e.status !== '진료완료' ? UI.btn('진료 완료', 'ocs.finish', { kind: 'pri', icon: 'check' }) : ''}</div></div>`;
      }
      if (key === 'er') {
        const lkw = e.lkw ? `<span>${UI.chip('마지막 정상 시각 ' + H.t.hm(e.lkw) + ` (${Math.round((Date.now() - e.lkw) / 60000)}분 전)`, 'stat')}</span>` : '';
        return `<div class="box" style="background:var(--surface)"><div class="row between"><div class="row">${UI.chip('KTAS ' + e.ktas, 'ktas' + e.ktas)}<span><b>주호소:</b> ${esc(e.cc || '-')}</span>${lkw}<span class="small muted">${esc(e.arrival || '')} · 내원 ${H.t.hm(e.at)}</span></div>
          <div class="btn-row">${e.status === '대기' ? UI.btn('진료 시작', 'ocs.start', { kind: 'pri', icon: 'user' }) : ''}</div></div>
          <div class="row" style="margin-top:.6rem"><span class="small muted">퇴실 결정</span>${UI.btn('입원 결정', 'ocs.admit', { icon: 'bed' })}${UI.btn('귀가', 'ocs.home', { icon: 'home' })}${UI.btn('다른 병원으로 전원', 'ocs.transfer', { icon: 'send' })}</div></div>`;
      }
      return `<div class="row box" style="background:var(--surface)"><span><b>입원일</b> ${H.t.d(e.at)} (${Math.floor((Date.now() - e.at) / 86400000) + 1}일째)</span><span><b>식이</b> ${esc(e.diet || '-')}</span>
        ${e.dc ? UI.chip(`퇴원 예정 ${e.dc.date || ''} — ${e.dc.review ? '심사 완료' : e.dc.ward ? '심사 중' : '병동 준비 중'}`, 'prog') : ''}<span class="grow"></span>
        ${e.dc ? '' : UI.btn('퇴원 결정', 'ocs.discharge', { icon: 'home' })}</div>
        <p class="small muted" style="margin:0">정규 처방은 다음 날 아침 약까지 약제부가 한꺼번에 조제, 추가 처방은 바로 조제합니다. 퇴원 결정 전에 퇴원약(처방 구분: 퇴원약)과 퇴원요약을 준비하세요.</p>`;
    }

    // ── 진료기록 탭 ──
    function noteForm(type) {
      const soap = ['경과기록', '재진기록'].includes(type);
      if (soap) return `${UI.textarea('S', 'S — 환자가 말한 것 (주관적)', '', { h: '4rem' })}${UI.textarea('O', 'O — 관찰·검사 결과 (객관적)', '', { h: '4rem' })}${UI.textarea('A', 'A — 평가 (진단·상태 판단)', '', { h: '4rem' })}${UI.textarea('P', 'P — 계획 (처방·검사·교육)', '', { h: '4rem' })}`;
      if (type === '퇴원요약') return `${UI.textarea('course', '입원 경과 요약', '', { h: '6rem' })}${UI.textarea('result', '퇴원 시 상태', '')}${UI.textarea('meds', '퇴원약', '')}${UI.textarea('fu', '외래 추적 계획', '')}`;
      return `${UI.textarea('cc', '주호소 (CC)', '', { h: '3rem' })}${UI.textarea('hpi', '현병력 (언제부터 어떻게)', '', { h: '5rem' })}${UI.textarea('pmh', '과거력·약물·알레르기', '', { h: '3rem' })}${UI.textarea('pe', '신체 진찰', '', { h: '4rem' })}${UI.textarea('assess', '평가 (진단)', '', { h: '4rem' })}${UI.textarea('plan', '계획', '', { h: '4rem' })}`;
    }
    const LBL = { cc: '주호소', hpi: '현병력', pmh: '과거력', pe: '신체 진찰', assess: '평가', plan: '계획', S: 'S (주관적)', O: 'O (객관적)', A: 'A (평가)', P: 'P (계획)', course: '입원 경과', result: '퇴원 시 상태', meds: '퇴원약', fu: '추적 계획' };
    function noteCard(n) {
      return `<div class="box" style="background:var(--surface)"><div class="row between"><div class="row">${UI.chip(n.type, 'sent')}<b>${esc(n.by)}</b></div><span class="num small muted">${H.t.dhm(n.at)}</span></div>
        <dl class="kv" style="margin:.6rem 0 0">${Object.entries(n.content).filter(([, v]) => v).map(([k, v]) => `<dt>${esc(LBL[k] || k)}</dt><dd class="pre">${esc(v)}</dd>`).join('')}</dl></div>`;
    }
    function tabEmr(p, e) {
      const type = ms('ntype', MD.notes[0]);
      const notes = S.where('notes', (n) => n.patientId === p.id).sort((a, b) => b.at - a.at);
      return `<div class="grid2">
        <div class="panel"><div class="panel-h"><h3>진료기록 쓰기</h3></div><div class="panel-b"><form data-submit="ocs.note" class="gap-m">
          ${UI.seg('ocs.ntype', MD.notes, type)}
          <div class="row"><button type="button" class="btn sm" data-act="ocs.noteFill">${H.icon('edit')}<span>예시 문장 채우기</span></button><span class="small muted">처음이면 예시를 채운 뒤 고쳐 써 보세요.</span></div>
          <div class="form-grid" id="note-fields">${noteForm(type)}</div>
          <div class="btn-row end">${UI.btn('서명하고 저장', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div></form></div></div>
        <div class="panel"><div class="panel-h"><h3>기록 보기 (${notes.length})</h3></div><div class="panel-b gap-s" style="max-height:48rem;overflow-y:auto">${notes.map(noteCard).join('') || UI.empty('진료기록이 없습니다')}</div></div>
      </div>`;
    }
    // ── 결과조회 탭 ──
    function tabResult(p) {
      const sub = ms('rsub', 'lab');
      const body = {
        lab: () => V.labCumulative(p.id), rad: () => V.radList(p.id), path: () => V.pathList(p.id),
        vs: () => `${V.vsChart(p.id)}<div style="margin-top:.8rem">${UI.table([{ h: '시각' }, { h: '혈압' }, { h: '맥박' }, { h: '호흡' }, { h: '체온' }, { h: '산소포화도' }, { h: '통증' }, { h: '기록자' }], S.where('vitals', (v) => v.patientId === p.id).sort((a, b) => b.at - a.at).slice(0, 20).map((v) => [`<span class="num">${H.t.mdhm(v.at)}</span>`, `${v.sbp}/${v.dbp}`, v.hr, v.rr, v.bt, v.spo2, v.pain, `<span class="small">${esc(v.by)}</span>`]))}</div>`,
        nr: () => H.wardView ? H.wardView.notesList(p.id) : '',
        func: () => UI.table([{ h: '처방 시각' }, { h: '검사' }, { h: '상태' }, { h: '결과' }], S.where('orders', (o) => o.patientId === p.id && o.cat === 'PROC' && (H.M.item(o.code) || {}).func).sort((a, b) => b.at - a.at).map((o) => [`<span class="num small">${H.t.mdhm(o.at)}</span>`, `<b>${esc(o.name)}</b>`, F.chip(o), o.result ? `${esc(o.result.findings || '')}<br><b>${esc(o.result.impression || '')}</b>` : '<span class="muted">결과 전 — 기능검사실</span>']), { empty: UI.empty('기능검사가 없습니다') }),
      }[sub]();
      return `<div class="gap-m">${UI.seg('ocs.rsub', [{ v: 'lab', l: '진단검사' }, { v: 'rad', l: '영상 (PACS)' }, { v: 'path', l: '병리' }, { v: 'func', l: '기능검사' }, { v: 'vs', l: '활력징후' }, { v: 'nr', l: '간호기록' }], sub)}${body}</div>`;
    }
    // ── 간호사 노티 탭 ──
    function tabNoti(p) {
      const comms = S.where('comms', (c) => c.patientId === p.id).sort((a, b) => b.at - a.at);
      const cons = S.where('orders', (o) => o.cat === 'CONSULT' && o.patientId === p.id);
      return `<div class="gap-m">
        ${UI.sec('간호사가 보낸 알림 (SBAR)')}
        ${comms.map((c) => `<div class="box" style="background:var(--surface)${c.urgent ? ';border-color:var(--t-stat)' : ''}">
          <div class="row between"><div class="row">${c.urgent ? UI.chip('긴급', 'stat') : ''}${UI.chip(c.status, c.status === '보냄' ? 'sent' : 'done')}<b>${esc(c.from)}</b> → ${esc(c.to)}</div><span class="num small muted">${H.t.dhm(c.at)}</span></div>
          <dl class="kv" style="margin:.5rem 0"><dt>S 상황</dt><dd>${esc(c.S)}</dd><dt>B 배경</dt><dd>${esc(c.B)}</dd><dt>A 평가</dt><dd>${esc(c.A)}</dd><dt>R 요청</dt><dd>${esc(c.R)}</dd></dl>
          ${c.reply ? `<div class="bubble me"><b>의사 답변</b> <span class="small muted">${esc(c.replyBy)} · ${H.t.mdhm(c.replyAt)}</span><div>${esc(c.reply)}</div></div>` : `<form data-submit="ocs.reply" class="gap-s"><input type="hidden" name="id" value="${c.id}">${UI.textarea('reply', '답변', '', { h: '3rem', ph: '예: 확인했습니다. 아세트아미노펜 투여 후 1시간 뒤 체온 다시 알려 주세요.' })}
            <div class="btn-row">${UI.btn('답변 보내기', '', { type: 'submit', kind: 'pri', icon: 'send' })}${UI.btn('답변 + 구두처방 내기', 'ocs.verbal', { kind: 'warn', icon: 'edit', data: { id: c.id } })}</div></form>`}
        </div>`).join('') || UI.empty('간호사 노티가 없습니다')}
        ${UI.sec('협진 의뢰')}
        ${cons.map((o) => `<div class="box" style="background:var(--surface)"><div class="row between"><b>${esc(o.name)}</b>${F.chip(o)}</div><p class="small muted" style="margin:.2rem 0">${esc(o.note || '의뢰 내용 없음')} · ${H.t.mdhm(o.at)}</p>
          ${o.reply ? `<div class="bubble"><b>회신</b> ${esc(o.reply)}</div>` : `<form data-submit="ocs.consReply" class="row"><input type="hidden" name="id" value="${o.id}"><input class="inp grow" name="reply" placeholder="협진 회신 내용 (해당 과 의사로서)"> ${UI.btn('회신', '', { type: 'submit' })}</form>`}</div>`).join('') || '<p class="muted">협진 의뢰가 없습니다</p>'}
      </div>`;
    }

    function render() {
      const p = A.pat(); const e = enc();
      if (!p || !e) return `<div class="panel"><div class="panel-b">${UI.empty('왼쪽 목록에서 환자를 고르세요', key === 'opd' ? '외래 접수된 환자가 진료 순서대로 보입니다.' : key === 'er' ? '중증도(KTAS) 순서로 보입니다. 숫자가 작을수록 위급합니다.' : '병동·병실 순서로 보입니다.')}</div></div>`;
      const tab0 = ms('tab', 'order'); const tab = ['order', 'emr', 'result', 'noti'].includes(tab0) ? tab0 : 'order'; // 저장된 탭 값이 이상해도 처방 탭으로
      const notiN = S.where('comms', (c) => c.patientId === p.id && c.status === '보냄').length;
      const tabs = [{ id: 'order', label: '처방', icon: 'edit' }, { id: 'emr', label: '진료기록', icon: 'doc' }, { id: 'result', label: '결과 조회', icon: 'flask' }, { id: 'noti', label: '간호사 노티·협진', icon: 'chat', cnt: notiN || '' }];
      const body = { order: tabOrder, emr: tabEmr, result: tabResult, noti: tabNoti }[tab](p, e);
      return `<div class="panel">${UI.tabs('ocs.tab', tabs, tab)}<div class="panel-b">${body}</div></div>`;
    }

    // 예시 문장
    const SAMPLE = {
      초진기록: { cc: '', hpi: '__세 __ 환자로 __ 전부터 __ 증상 있어 내원함.', pmh: '고혈압·당뇨 여부, 복용 약, 알레르기 확인', pe: '활력징후: __. 의식 명료. 흉부 청진 __.', assess: '#1 ', plan: '검사: \n처방: \n교육: \n다음 외래: ' },
      재진기록: { S: '지난번보다 __ 좋아졌다고 함.', O: '혈압 __/__, 검사 결과 __', A: '__ 호전 중', P: '약 유지, __주 뒤 외래' },
      입원기록: { cc: '', hpi: '', pmh: '', pe: '', assess: '#1 ', plan: '' },
      경과기록: { S: '밤사이 __ 했다고 함.', O: '체온 __℃, 맥박 __회, 산소포화도 __%. 검사: __', A: '__ 호전/악화', P: '__ 유지, 내일 __ 추적' },
      퇴원요약: { course: '__로 입원하여 __ 치료 후 호전됨.', result: '증상 호전, 활력징후 안정', meds: '', fu: '__주 뒤 __과 외래' },
      '응급실 초진기록': { cc: '', hpi: '__분 전부터 __ 증상으로 __ 타고 내원.', pmh: '', pe: '', assess: '#1 ', plan: '묶음처방 시행, 결과 확인 후 __' },
    };

    return {
      id: MD.id, title: MD.title, actor: '의사', layout: 'patient',
      channels: () => ['doctor'],
      list, render,
      side() { const p = A.pat(); return p ? V.sideVitals(p.id) + V.sideCritical(p.id) : ''; },
      onPick() { const e = enc(); if (e) S.where('orders', (o) => o.encId === e.id && o.result && o.status === '결과보고').forEach((o) => { o.drSeen = true; }); },
      acts: {
        'ocs.tab': (el) => { set('tab', el.dataset.v); A.render(); },
        'ocs.ward': (el) => { set('ward', el.dataset.v); A.render(); },
        'ocs.cat': (el) => { set('cat', el.dataset.v); set('q', ''); A.render(); },
        'ocs.otype': (el) => { set('otype', el.dataset.v); A.render(); },
        'ocs.showAll': (el) => { set('showAll', !!el.dataset.v); A.render(); },
        'ocs.rsub': (el) => { set('rsub', el.dataset.v); A.render(); },
        'ocs.ntype': (el) => { set('ntype', el.dataset.v); A.render(); },
        'ocs.q': (el) => { set('q', el.value); A.part('#ocs-results', searchResults()); },
        'ocs.add': (el) => {
          const it = H.M.item(el.dataset.code);
          const list = pend();
          list.push({ code: it.code, dose: it.dose, unit: it.unit, route: it.route, freq: it.freq || 'ONCE', days: key === 'opd' ? 7 : 1, stat: key === 'er' && !['NUR', 'DIET', 'CONSULT'].includes(it.cat), prn: it.freq === 'PRN', outside: key === 'opd' && it.cat === 'MED', note: '' });
          setPend(list); A.render();
          UI.toast(`${it.name} 추가`, '');
        },
        'ocs.addSet': (el) => {
          const s = H.M.SETS.find((x) => x.id === el.dataset.id);
          const list = pend();
          s.codes.forEach((c) => { const it = H.M.item(c); list.push({ code: c, dose: it.dose, unit: it.unit, route: it.route, freq: it.freq || 'ONCE', days: 1, stat: !['NUR', 'DIET'].includes(it.cat), prn: it.freq === 'PRN', note: '' }); });
          setPend(list); A.render(); UI.toast(`${s.name} ${s.codes.length}개 항목 추가`, 'ok');
        },
        'ocs.edit': (el) => {
          const list = pend(); const r = list[Number(el.dataset.i)]; if (!r) return;
          const f = el.dataset.f;
          r[f] = el.type === 'checkbox' ? el.checked : el.value;
          if (f === 'freq') r.prn = el.value === 'PRN';
          setPend(list);
          if (el.type === 'checkbox') el.closest('label').classList.toggle('on', el.checked);
          const p = A.pat(); A.part('#ocs-dur', durBox(p));
        },
        'ocs.del': (el) => { const list = pend(); list.splice(Number(el.dataset.i), 1); setPend(list); A.render(); },
        'ocs.clear': () => { setPend([]); A.render(); },
        'ocs.send': async () => {
          const p = A.pat(); const e = enc(); const rows = pend(); if (!rows.length) return;
          const w = F.dur(p, rows);
          if (w.some((x) => x.level === 'red')) {
            const ok = await UI.confirm({ title: '처방 안전 경고', text: `빨간 경고가 ${w.filter((x) => x.level === 'red').length}건 있습니다.\n\n${w.filter((x) => x.level === 'red').map((x) => '• ' + x.text).join('\n')}\n\n그래도 전송할까요? (실제 병원에서는 사유를 적어야 합니다)`, ok: '사유 확인 후 전송', danger: true });
            if (!ok) return;
          }
          const verbal = ms('verbal', '');
          if (e.status === '대기') e.status = '진료중';
          const made = F.create(e, rows, { otype: key === 'ipd' ? ms('otype', '추가') : undefined, verbal: !!verbal });
          if (verbal) { const c = S.get('comms', verbal); if (c) { c.status = '처방함'; c.reply = c.reply || '구두처방 냄'; c.replyAt = Date.now(); c.replyBy = H.who(); c.orderIds = made.map((o) => o.id); } set('verbal', ''); }
          S.save(); setPend([]);
          UI.toast(`처방 ${made.length}건 전송 완료 — 각 부서로 전달되었습니다`, 'ok');
          A.render();
        },
        'ocs.dc': (el) => {
          const o = S.get('orders', el.dataset.id);
          UI.modal({ title: `처방 중단 — ${o.name}`, size: 'narrow', body: `<form data-submit="ocs.dcGo" class="gap-m"><input type="hidden" name="id" value="${o.id}">${UI.select('reason', '중단 사유', ['치료 종료', '부작용 발생', '다른 약으로 변경', '잘못 낸 처방', '환자 거부', '검사 불필요'], '치료 종료')}<div class="btn-row end">${UI.btn('처방 중단', '', { type: 'submit', kind: 'danger', size: 'lg' })}</div></form>` });
        },
        'ocs.dcGo': (f, d) => { const o = S.get('orders', d.id); F.cancel(o, d.reason); UI.close(); UI.toast('처방을 중단했습니다', 'ok'); A.render(); },
        'ocs.dxAdd': () => {
          const e = enc(); const code = document.getElementById('ocs-dx').value; const k = H.M.KCD.find((x) => x.code === code);
          if (e.dx.some((d) => d.code === code)) return UI.toast('이미 있는 진단명입니다', 'warn');
          e.dx.push({ code: k.code, name: k.name, main: !e.dx.length }); S.save(); H.log('진단 추가', `${k.code} ${k.name}`, e.patientId); A.render();
        },
        'ocs.dxDel': (el) => { const e = enc(); e.dx.splice(Number(el.dataset.i), 1); if (e.dx.length && !e.dx.some((d) => d.main)) e.dx[0].main = true; S.save(); A.render(); },
        'ocs.dxMain': (el) => { const e = enc(); e.dx.forEach((d, i) => { d.main = i === Number(el.dataset.i); }); S.save(); A.render(); },
        'ocs.start': () => { const e = enc(); e.status = '진료중'; e.startAt = Date.now(); S.save(); H.log('진료 시작', H.pat(e.patientId).name, e.patientId); A.render(); },
        'ocs.finish': async () => {
          const e = enc();
          if (!e.dx.length) return UI.toast('진단명을 먼저 넣어 주세요 (처방전·청구에 필요)', 'warn');
          if (!(await UI.confirm({ title: '진료 완료', text: '진료를 마칠까요?\n환자는 원무과(원무 수납·정산)에서 수납한 뒤, 원외처방전을 받아 약국으로 갑니다.', ok: '진료 완료' }))) return;
          e.status = '진료완료'; e.endAt = Date.now(); S.save(); H.notify('reg', `${H.pat(e.patientId).name} 외래 진료 완료 — 수납 대기`, { patientId: e.patientId });
          H.log('외래 진료 완료', H.pat(e.patientId).name, e.patientId); UI.toast('진료 완료', 'ok'); A.render();
        },
        'ocs.admit': () => {
          const e = enc();
          UI.modal({ title: '입원 결정', icon: 'bed', body: `<form data-submit="ocs.admitGo" class="gap-m"><div class="form-grid">
            ${UI.select('doc', '입원 진료과 · 주치의', H.M.DOCTORS.filter((d) => d.dept !== '응급의학과').map((d) => ({ v: d.id, l: `${d.dept} — ${d.name}` })), e.type === 'OPD' ? e.doctorId : 'dr1')}
            ${UI.fld('희망 병동', UI.pick('ward', [{ v: '7A', l: '7A 내과병동' }, { v: '8B', l: '8B 외과병동' }], '7A'))}
            ${UI.textarea('why', '입원 사유', '', { ph: '예: 정맥 항생제 치료 필요' })}</div>
            ${UI.note('입원 결정을 하면 원무과 "입원 수속"으로 넘어갑니다. 원무 접수 화면에서 병상을 배정해야 병동으로 올라갑니다.', 'info')}
            <div class="btn-row end">${UI.btn('입원 결정', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
        },
        'ocs.admitGo': (f, d) => {
          const e = enc(); const p = H.pat(e.patientId); const doc = H.M.DOCTORS.find((x) => x.id === d.doc);
          S.add('admreq', { id: H.uid('ar'), patientId: p.id, fromEnc: e.id, from: e.type === 'OPD' ? '외래' : '응급실', dept: doc.dept, doctorId: doc.id, ward: d.ward, why: d.why, status: '대기', at: Date.now() });
          if (e.type === 'OPD') { e.status = '진료완료'; e.endAt = Date.now(); }
          else e.dispo = '입원 결정';
          S.save(); H.notify('reg', `입원 결정: ${p.name} (${doc.dept}, ${d.ward} 희망) — 입원 수속 필요`, { patientId: p.id });
          H.log('입원 결정', `${p.name} → ${doc.dept}`, p.id); UI.close(); UI.toast('입원 결정 — 원무과 입원 수속으로 넘어갔습니다', 'ok'); A.render();
        },
        'ocs.discharge': () => {
          const e = enc();
          const hasSum = S.where('notes', (n) => n.encId === e.id && n.type === '퇴원요약').length;
          UI.modal({ title: '퇴원 결정', icon: 'home', body: `<form data-submit="ocs.dischargeGo" class="gap-m">
            ${hasSum ? UI.note('퇴원요약이 작성되어 있습니다.', 'ok') : UI.note('퇴원요약이 아직 없습니다. 퇴원 후 의료정보팀에서 "미비 기록"으로 요청하게 됩니다.', 'warn')}
            <div class="form-grid">${UI.fld('퇴원 날짜', UI.pick('date', [{ v: H.t.d(Date.now()), l: '오늘' }, { v: H.t.d(Date.now() + 86400000), l: '내일' }], H.t.d(Date.now())))}
              ${UI.fld('퇴원 형태', UI.pick('form', ['집으로', '다른 병원으로 전원', '요양병원', '자의 퇴원', '사망'], '집으로'))}
              ${UI.input('fu', '다음 외래', `${H.t.d(Date.now() + 14 * 86400000)} ${e.dept}`, { cls: 'wide' })}
              ${UI.textarea('memo', '병동·원무에 전할 말', '퇴원약 7일분, 상처 소독은 외래에서', { h: '3rem' })}</div>
            <div class="btn-row end">${UI.btn('퇴원 결정 → 병동·심사팀·원무에 알림', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
        },
        'ocs.dischargeGo': (f, d) => {
          const e = enc(); const p = H.pat(e.patientId);
          e.dc = { at: Date.now(), by: H.who(), date: d.date, form: d.form, fu: d.fu, memo: d.memo }; S.save();
          H.notify('ward:' + e.ward, `퇴원 결정: ${p.name} (${d.date}) — 퇴원 준비·교육을 해 주세요`, { patientId: p.id });
          H.notify('review', `퇴원 예정: ${p.name} — 퇴원 심사 대상`, { patientId: p.id });
          H.notify('billing', `퇴원 예정: ${p.name} ${d.date}`, { patientId: p.id });
          H.log('퇴원 결정', `${p.name} ${d.date} ${d.form}`, p.id); UI.close(); UI.toast('퇴원 결정 — 병동 준비 → 퇴원 심사 → 원무 수납 순서로 진행됩니다', 'ok'); A.render();
        },
        'ocs.home': async () => {
          const e = enc(); const p = H.pat(e.patientId);
          if (!(await UI.confirm({ title: '귀가 결정', text: `${p.name} 님을 귀가시킬까요?\n퇴실 전 귀가 교육과 원무 수납이 필요합니다.`, ok: '귀가' }))) return;
          e.status = '귀가'; e.endAt = Date.now(); e.dispo = '귀가'; S.save();
          H.notify('ward:ER', `${p.name} 귀가 결정 — 귀가 교육 후 퇴실`, { patientId: p.id }); H.log('응급실 귀가 결정', p.name, p.id); A.st.encId = null; A.render();
        },
        'ocs.transfer': () => UI.modal({ title: '다른 병원으로 전원', size: 'narrow', body: `<form data-submit="ocs.transferGo" class="gap-m">${UI.input('to', '전원 갈 병원', '가상 대학교병원')}${UI.select('why', '전원 사유', ['병상 부족', '전문 치료 필요 (해당 진료 불가)', '환자·보호자 희망', '집 가까운 병원'], '전문 치료 필요 (해당 진료 불가)')}<div class="btn-row end">${UI.btn('전원 결정', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }),
        'ocs.transferGo': (f, d) => { const e = enc(); const p = H.pat(e.patientId); e.status = '전원'; e.endAt = Date.now(); e.dispo = `전원 — ${d.to} (${d.why})`; S.save(); H.log('전원 결정', `${p.name} → ${d.to}`, p.id); UI.close(); UI.toast('전원 결정 — 진료의뢰서·영상 CD 준비(4단계 진료협력)', 'ok'); A.st.encId = null; A.render(); },
        'ocs.note': (f, d) => {
          const e = enc(); const type = ms('ntype', MD.notes[0]);
          const content = {}; Object.entries(d).forEach(([k, v]) => { if (v) content[k] = v; });
          if (!Object.keys(content).length) return UI.toast('내용을 써 주세요', 'warn');
          S.add('notes', { id: H.uid('no'), encId: e.id, patientId: e.patientId, type, at: Date.now(), by: H.who(), signed: true, content });
          H.log('진료기록 작성', type, e.patientId); UI.toast(`${type} 저장 (전자서명 완료)`, 'ok'); A.render();
        },
        'ocs.noteFill': () => {
          const type = ms('ntype', MD.notes[0]); const s = SAMPLE[type] || {};
          const e = enc(); const p = A.pat();
          Object.entries(s).forEach(([k, v]) => { const el = document.getElementById('f-' + k); if (el && !el.value) el.value = k === 'cc' ? e.cc || '' : k === 'pmh' ? `${p.hx || ''}${p.allergies.length ? ' / 알레르기: ' + p.allergies.map((a) => a.name).join(', ') : ''}` : v; });
        },
        'ocs.reply': (f, d) => { const c = S.get('comms', d.id); if (!d.reply) return UI.toast('답변을 써 주세요', 'warn'); c.reply = d.reply; c.replyAt = Date.now(); c.replyBy = H.who(); c.status = '답변함'; S.save(); H.notify('ward:' + (H.activeEnc(c.patientId) ? F.wardOf(H.activeEnc(c.patientId)) : ''), `의사 답변: ${H.pat(c.patientId).name} — ${d.reply}`, { patientId: c.patientId }); H.log('노티 답변', d.reply, c.patientId); A.render(); },
        'ocs.verbal': (el) => {
          const form = el.closest('form'); const reply = form.querySelector('textarea').value;
          const c = S.get('comms', el.dataset.id); if (reply) { c.reply = reply; c.replyAt = Date.now(); c.replyBy = H.who(); }
          S.save(); set('verbal', c.id); set('tab', 'order'); A.render(); UI.toast('처방 탭에서 구두처방을 작성하세요', '');
        },
        'ocs.verbalOff': () => { set('verbal', ''); A.render(); },
        'ocs.consReply': (f, d) => { const o = S.get('orders', d.id); if (!d.reply) return; F.advance(o, '회신완료', { reply: d.reply }); A.render(); },
      },
    };
  }
  ['opd', 'ipd', 'er'].forEach((k) => H.reg(make(k)));
})();
