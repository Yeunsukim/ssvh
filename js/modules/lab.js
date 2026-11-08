// 채혈실 + 진단검사의학과(혈액은행 포함)
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const F = H.flow;
  const V = H.view;

  const isLab = (o) => o.cat === 'LAB' && o.code !== 'L1026';
  const whereOf = (o) => { const e = H.enc(o.encId); return !e ? '-' : e.type === 'OPD' ? '외래' : e.type === 'ER' ? `응급 ${e.room}` : `${e.ward} ${e.room}-${e.bed}`; };
  const pLine = (p, o) => `<b>${esc(p.name)}</b> <span class="muted small">${H.sexAge(p)} · ${esc(p.mrn)} · ${esc(whereOf(o))}</span>`;
  const group = (list) => { const g = {}; list.forEach((o) => { (g[o.patientId] = g[o.patientId] || []).push(o); }); return Object.entries(g).sort((a, b) => b[1].some((o) => o.stat) - a[1].some((o) => o.stat) || a[1][0].at - b[1][0].at); };

  // ───────── 채혈실 ─────────
  H.reg({
    id: 'phlebo', title: '채혈실', actor: '채혈 담당', layout: 'full',
    channels: () => ['phlebo'],
    render() {
      const f = A.ms('f', 'all');
      const wait = S.where('orders', (o) => isLab(o) && o.status === '전송' && (f === 'all' || (f === 'opd' ? o.encType === 'OPD' : f === 'er' ? o.encType === 'ER' : o.encType === 'IPD')));
      const done = S.where('orders', (o) => isLab(o) && o.specimenAt && o.specimenAt >= H.t.startOfDay()).sort((a, b) => b.specimenAt - a.specimenAt);
      return `<div class="panel"><div class="panel-h"><h3>채혈 대기</h3>${UI.chip(`${group(wait).length}명`, 'sent')}<span class="grow"></span>${UI.seg('pb.f', [{ v: 'all', l: '전체' }, { v: 'opd', l: '외래' }, { v: 'ipd', l: '병동' }, { v: 'er', l: '응급' }], f)}</div>
        <div class="panel-b gap-m">${UI.note('채혈 순서: ① 라벨 출력 → ② 환자 확인 (이름·생년월일 두 가지) → ③ 채혈 → ④ 라벨 붙이기 → ⑤ 채혈 완료 → 검사실로 보냄. 같은 환자의 검사는 용기(튜브) 색깔별로 묶어서 채혈합니다.', 'info')}
        ${group(wait).map(([pid, os]) => { const p = H.pat(pid); const tubes = {}; os.forEach((o) => { const t = H.M.item(o.code).tube; (tubes[t] = tubes[t] || []).push(o.name); });
          return `<div class="box" style="background:var(--surface)"><div class="row between">${pLine(p, os[0])}<div class="btn-row">${os.some((o) => o.stat) ? UI.chip('응급', 'stat') : ''}
            ${UI.btn('라벨 출력', 'pb.label', { icon: 'barcode', data: { pid } })}${UI.btn('채혈하기', 'pb.draw', { kind: 'pri', icon: 'drop', data: { pid } })}</div></div>
            <div class="row" style="margin-top:.5rem">${Object.entries(tubes).map(([t, names]) => `<span class="chip plain" title="${esc(names.join(', '))}">${esc(t)} · ${names.length}건</span>`).join('')}</div>
            <div class="small muted" style="margin-top:.3rem">${os.map((o) => esc(o.name)).join(' · ')}</div></div>`; }).join('') || UI.empty('채혈 대기 환자가 없습니다')}
        </div></div>
        <div class="panel"><div class="panel-h"><h3>오늘 채혈 완료</h3></div><div class="panel-b">${UI.table([{ h: '채혈 시각' }, { h: '환자' }, { h: '검사' }, { h: '진행' }], done.slice(0, 30).map((o) => [`<span class="num small">${H.t.hm(o.specimenAt)}</span>`, esc(H.pat(o.patientId).name), esc(o.name), F.chip(o)]), { empty: UI.empty('아직 없습니다') })}</div></div>`;
    },
    acts: {
      'pb.f': (el) => { A.set('f', el.dataset.v); A.render(); },
      'pb.label': (el) => {
        const os = S.where('orders', (o) => isLab(o) && o.status === '전송' && o.patientId === el.dataset.pid);
        UI.modal({ title: '검체 라벨 — 출력 미리보기', icon: 'barcode', size: 'wide', body: `${UI.note('실제로는 라벨 프린터로 출력해 채혈 용기에 붙입니다. 바코드에는 검체 번호가 들어 있어 검사 장비가 자동으로 읽습니다.', 'info')}<div style="margin-top:.8rem">${V.labelCards(os)}</div>` });
        os.forEach((o) => { o.labelAt = Date.now(); }); S.save();
      },
      'pb.draw': (el) => {
        const p = H.pat(el.dataset.pid);
        const os = S.where('orders', (o) => isLab(o) && o.status === '전송' && o.patientId === p.id);
        UI.modal({ title: `채혈 — ${p.name}`, icon: 'drop', body: `<form data-submit="pb.drawGo" class="gap-m"><input type="hidden" name="pid" value="${p.id}">
          <div class="box"><dl class="kv"><dt>환자</dt><dd>${esc(p.name)} · ${esc(p.birth)} · ${esc(p.mrn)}</dd><dt>검사</dt><dd>${os.map((o) => esc(o.name)).join(', ')}</dd></dl></div>
          <div class="gap-s">${UI.check('c1', '환자에게 이름을 직접 말하게 하고 확인함', false)}${UI.check('c2', '생년월일을 팔찌·라벨과 대조함', false)}${UI.check('c3', '라벨을 채혈 직후 환자 앞에서 붙임', false)}${UI.check('c4', '채혈 부위 지혈 확인, 수액 맞는 팔 반대편에서 채혈', false)}</div>
          ${os.some((o) => o.code === 'L1020') ? UI.note('혈액배양: 서로 다른 부위에서 2세트, 소독 후 30초 건조, 항생제 투여 전에 채혈', 'warn') : ''}
          <div class="btn-row end">${UI.btn('채혈 완료 → 검사실로', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'send' })}</div></form>` });
      },
      'pb.drawGo': (f, d) => {
        if (!d.c1 || !d.c2) return UI.toast('환자 확인 두 가지(이름·생년월일)는 꼭 해야 합니다', 'err');
        const os = S.where('orders', (o) => isLab(o) && o.status === '전송' && o.patientId === d.pid);
        const sp = S.add('specimens', { id: H.uid('sp'), patientId: d.pid, orderIds: os.map((o) => o.id), at: Date.now(), by: H.who() });
        os.forEach((o) => F.advance(o, '채혈완료', { specimenAt: Date.now(), specimenId: sp.id }));
        H.notify('lab', `${H.pat(d.pid).name} 검체 ${os.length}건 도착 예정`, { patientId: d.pid, level: os.some((o) => o.stat) ? 'stat' : '' });
        UI.close(); UI.toast(`채혈 완료 — ${os.length}건 검사실로 보냄`, 'ok'); A.render();
      },
    },
  });

  // ───────── 진단검사의학과 ─────────
  function tabRecv() {
    const list = S.where('orders', (o) => isLab(o) && o.status === '채혈완료');
    return `${UI.note('검체 접수: 도착한 검체가 검사하기에 알맞은지(용혈·응고·양 부족·라벨 오류) 확인하고 접수합니다. 부적합하면 다시 채혈을 요청합니다.', 'info')}
      <div style="margin-top:.8rem">${UI.table([{ h: '채혈 시각' }, { h: '환자' }, { h: '검사' }, { h: '용기' }, { h: '' }], list.map((o) => { const p = H.pat(o.patientId); return [
        `<span class="num small">${H.t.mdhm(o.specimenAt || o.at)}</span>${o.stat ? ' ' + UI.chip('응급', 'stat') : ''}`, pLine(p, o), `<b>${esc(o.name)}</b>`, esc(H.M.item(o.code).tube),
        `<div class="row" style="flex-wrap:nowrap;gap:.3rem">${UI.btn('접수', 'lb.recv', { size: 'sm', kind: 'pri', data: { id: o.id } })}${UI.btn('부적합', 'lb.bad', { size: 'sm', kind: 'warn', data: { id: o.id } })}</div>`]; }), { empty: UI.empty('도착한 검체가 없습니다', '채혈실이나 병동에서 채혈하면 여기에 나타납니다.') })}</div>
      ${list.length ? `<div class="btn-row end" style="margin-top:.8rem">${UI.btn('모두 접수', 'lb.recvAll', { kind: 'pri', icon: 'check' })}</div>` : ''}`;
  }
  function resultForm(o) {
    const p = H.pat(o.patientId); const it = H.M.item(o.code);
    const prev = o.result ? Object.fromEntries(o.result.items.map((r) => [r.c, r.v])) : {};
    return `<form data-submit="lb.save" class="box" style="background:var(--surface)"><input type="hidden" name="id" value="${o.id}">
      <div class="row between">${pLine(p, o)}<div class="row">${o.stat ? UI.chip('응급', 'stat') : ''}<b>${esc(o.name)}</b></div></div>
      <div class="tbl-wrap" style="margin-top:.6rem"><table class="tbl"><thead><tr><th>항목</th><th>결과</th><th>단위</th><th>참고치</th><th>판정</th></tr></thead><tbody>
      ${it.items.map((x) => { const v = prev[x.c] || ''; const j = F.judge(x, v); return `<tr><td>${esc(x.n)}</td><td><input name="v_${x.c}" value="${esc(v)}" data-inp="lb.judge" data-code="${o.code}" data-c="${x.c}" style="width:9rem" aria-label="${esc(x.n)} 결과"></td><td class="small">${esc(x.u || '')}</td><td class="small num">${x.text ? esc(x.normal) : `${x.lo ?? ''} ~ ${x.hi ?? ''}`}${x.chi != null || x.clo != null ? `<div class="small" style="color:var(--t-stat)">위험값 ${x.clo != null ? x.clo + ' 이하' : ''}${x.clo != null && x.chi != null ? ' · ' : ''}${x.chi != null ? x.chi + ' 이상' : ''}</div>` : ''}</td><td id="j-${o.id}-${x.c}">${F.flagHtml(j.flag, j.dir)}</td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="btn-row end" style="margin-top:.6rem">${UI.btn('장비 결과 불러오기 (사례값)', 'lb.fill', { icon: 'refresh', data: { id: o.id } })}${UI.btn('결과 저장', '', { type: 'submit', kind: 'pri', icon: 'check' })}</div></form>`;
  }
  function tabInput() {
    const list = S.where('orders', (o) => isLab(o) && o.status === '검사접수').sort((a, b) => b.stat - a.stat || a.at - b.at);
    return `${UI.note('결과 입력: 검사 장비에서 나온 값을 입력합니다. "장비 결과 불러오기"를 누르면 환자 사례에 맞는 값이 들어옵니다. 참고치를 벗어나면 높음↑·낮음↓, 위험값이면 빨갛게 표시됩니다.', 'info')}
      <div class="gap-m" style="margin-top:.8rem">${list.map(resultForm).join('') || UI.empty('입력할 검사가 없습니다', '검체 접수를 먼저 하세요.')}</div>`;
  }
  function tabVerify() {
    const list = S.where('orders', (o) => isLab(o) && o.status === '결과입력');
    return `${UI.note('결과 검증·보고: 임상병리사가 입력한 결과를 진단검사의학과 전문의가 확인한 뒤 보고합니다. 위험값은 처방 의사와 담당 간호사에게 바로 전화로 알리고 기록을 남깁니다.', 'info')}
      <div class="gap-m" style="margin-top:.8rem">${list.map((o) => { const p = H.pat(o.patientId); const crit = o.result.items.filter((r) => r.flag === 'C');
        return `<div class="box" style="background:var(--surface)${crit.length ? ';border-color:var(--t-stat)' : ''}"><div class="row between">${pLine(p, o)}<b>${esc(o.name)}</b></div>
          <div class="row" style="margin:.5rem 0">${o.result.items.map((r) => `<span class="chip ${r.flag === 'C' ? 'solid-stat' : r.flag ? 'prog' : 'plain'}">${esc(r.n)} <b class="num">${esc(r.v)}</b> ${esc(r.u || '')}${r.flag && r.flag !== 'C' ? (r.flag === 'H' ? ' ↑' : r.flag === 'L' ? ' ↓' : ' !') : ''}</span>`).join('')}</div>
          <div class="btn-row end">${UI.btn('다시 입력', 'lb.back', { size: 'sm', data: { id: o.id } })}${crit.length ? UI.btn('위험값 보고 후 결과 보고', 'lb.crit', { kind: 'danger', icon: 'alert', data: { id: o.id } }) : UI.btn('검증 완료 → 결과 보고', 'lb.report', { kind: 'pri', icon: 'send', data: { id: o.id } })}</div></div>`; }).join('') || UI.empty('검증할 결과가 없습니다')}</div>`;
  }
  function tabBank() {
    const list = S.where('orders', (o) => o.cat === 'BLOOD' && !F.isOff(o)).sort((a, b) => b.at - a.at);
    return `${UI.note('혈액은행: 수혈 처방이 오면 환자 혈액형을 확인하고 교차시험(환자 혈액과 혈액제제가 맞는지)을 한 뒤 혈액을 출고합니다. 병동은 출고된 혈액을 받아 2명이 확인 후 수혈합니다.', 'info')}
      <div style="margin-top:.8rem">${UI.table([{ h: '처방 시각' }, { h: '환자' }, { h: '혈액형 검사' }, { h: '혈액제제' }, { h: '상태' }, { h: '' }], list.map((o) => {
        const p = H.pat(o.patientId); const abo = F.lastLab(p.id, 'ABO'); const rh = F.lastLab(p.id, 'Rh');
        return [`<span class="num small">${H.t.mdhm(o.at)}</span>`, pLine(p, o), abo ? `<b>${esc(abo.v)}형 ${esc(rh ? rh.v : '')}</b>` : '<span style="color:var(--t-stat)">검사 결과 없음</span>', `<b>${esc(o.name)}</b>${o.note ? `<div class="small muted">${esc(o.note)}</div>` : ''}`, F.chip(o),
          o.status === '전송' ? UI.btn('교차시험 완료', 'lb.xm', { size: 'sm', kind: 'pri', data: { id: o.id } }) : o.status === '교차시험완료' ? UI.btn('혈액 출고', 'lb.issue', { size: 'sm', kind: 'pri', data: { id: o.id } }) : `<span class="small mono">${esc(o.bagNo || '')}</span>`];
      }), { empty: UI.empty('수혈 처방이 없습니다') })}</div>`;
  }
  function tabDone() {
    const list = S.where('orders', (o) => isLab(o) && o.status === '결과보고' && o.result && o.result.at >= H.t.startOfDay() - 86400000).sort((a, b) => b.result.at - a.result.at);
    return UI.table([{ h: '보고 시각' }, { h: '환자' }, { h: '검사' }, { h: '이상 항목' }], list.map((o) => [`<span class="num small">${H.t.mdhm(o.result.at)}</span>`, esc(H.pat(o.patientId).name), esc(o.name), o.result.items.filter((r) => r.flag).map((r) => `${esc(r.n)} ${esc(r.v)} ${F.flagHtml(r.flag, r.dir)}`).join(' · ') || '<span class="muted">정상</span>']), { empty: UI.empty('보고된 결과가 없습니다') });
  }

  H.reg({
    id: 'lab', title: '진단검사의학과', actor: '임상병리사', layout: 'full',
    channels: () => ['lab'],
    render() {
      const tab = A.ms('tab', 'recv');
      const cnt = (st) => S.where('orders', (o) => isLab(o) && o.status === st).length;
      return `<div class="panel">${UI.tabs('lb.tab', [
        { id: 'recv', label: '검체 접수', icon: 'flask', cnt: cnt('채혈완료') || '' }, { id: 'input', label: '결과 입력', icon: 'edit', cnt: cnt('검사접수') || '' },
        { id: 'verify', label: '검증·보고', icon: 'check', cnt: cnt('결과입력') || '' }, { id: 'bank', label: '혈액은행', icon: 'drop', cnt: S.where('orders', (o) => o.cat === 'BLOOD' && ['전송', '교차시험완료'].includes(o.status)).length || '' },
        { id: 'done', label: '보고 완료', icon: 'list' },
      ], tab)}<div class="panel-b">${{ recv: tabRecv, input: tabInput, verify: tabVerify, bank: tabBank, done: tabDone }[tab]()}</div></div>`;
    },
    side() {
      return `<div class="panel"><div class="panel-h"><h3>검사 진행 순서</h3></div><div class="panel-b small"><ol style="margin:0;padding-left:1.2rem;line-height:1.9"><li>처방 전송</li><li>채혈 (채혈실·병동)</li><li>검체 접수 (적합성 확인)</li><li>검사·결과 입력</li><li>검증 → 결과 보고</li><li>위험값은 즉시 전화 보고</li><li>처방 화면·병동에서 결과 조회</li></ol></div></div>`;
    },
    acts: {
      'lb.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'lb.recv': (el) => { F.advance(S.get('orders', el.dataset.id), '검사접수'); UI.toast('검체 접수', 'ok'); A.render(); },
      'lb.recvAll': () => { S.where('orders', (o) => isLab(o) && o.status === '채혈완료').forEach((o) => F.advance(o, '검사접수')); UI.toast('모두 접수', 'ok'); A.render(); },
      'lb.bad': (el) => {
        const o = S.get('orders', el.dataset.id);
        UI.modal({ title: '부적합 검체', size: 'narrow', body: `<form data-submit="lb.badGo" class="gap-m"><input type="hidden" name="id" value="${o.id}">${UI.select('why', '부적합 사유', ['용혈 (적혈구 터짐)', '응고됨', '검체 양 부족', '라벨 정보 불일치', '용기 잘못 사용', '수액 맞는 팔에서 채혈 (희석)'], '용혈 (적혈구 터짐)')}<div class="btn-row end">${UI.btn('재채혈 요청', '', { type: 'submit', kind: 'warn', size: 'lg' })}</div></form>` });
      },
      'lb.badGo': (f, d) => {
        const o = S.get('orders', d.id); const p = H.pat(o.patientId);
        F.advance(o, '전송', { rejectNote: d.why, specimenAt: null });
        H.notify('phlebo', `재채혈 요청: ${p.name} ${o.name} — ${d.why}`, { patientId: p.id, level: 'stat' });
        if (o.ward) H.notify('ward:' + o.ward, `재채혈 요청: ${p.name} ${o.name} — ${d.why}`, { patientId: p.id, level: 'stat' });
        UI.close(); UI.toast('재채혈을 요청했습니다', 'warn'); A.render();
      },
      'lb.judge': (el) => {
        const it = H.M.item(el.dataset.code).items.find((x) => x.c === el.dataset.c);
        const j = F.judge(it, el.value);
        const td = document.getElementById(`j-${el.closest('form').querySelector('[name=id]').value}-${el.dataset.c}`);
        if (td) td.innerHTML = F.flagHtml(j.flag, j.dir);
      },
      'lb.fill': (el) => {
        const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId); const it = H.M.item(o.code);
        const form = el.closest('form');
        it.items.forEach((x) => { const inp = form.querySelector(`[name="v_${x.c}"]`); if (inp && !inp.value) { inp.value = H.sim.labValue(p, x); inp.dispatchEvent(new Event('input', { bubbles: true })); } });
      },
      'lb.save': (f, d) => {
        const o = S.get('orders', d.id); const it = H.M.item(o.code);
        const items = it.items.map((x) => { const v = d['v_' + x.c] || ''; const j = F.judge(x, v); return { c: x.c, n: x.n, u: x.u, v, flag: j.flag, dir: j.dir, ref: x.text ? x.normal : `${x.lo ?? ''}~${x.hi ?? ''}` }; });
        if (items.some((r) => r.v === '')) return UI.toast('모든 항목에 결과를 넣어 주세요', 'warn');
        F.advance(o, '결과입력', { result: { at: Date.now(), by: H.who(), items } });
        UI.toast('결과 저장 — 검증·보고 탭에서 보고하세요', 'ok'); A.render();
      },
      'lb.back': (el) => { const o = S.get('orders', el.dataset.id); F.advance(o, '검사접수'); A.set('tab', 'input'); A.render(); },
      'lb.report': (el) => {
        const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId);
        o.result.at = Date.now(); o.result.verifiedBy = H.who();
        F.advance(o, '결과보고');
        if (o.ward) H.notify('ward:' + o.ward, `검사 결과 보고: ${p.name} ${o.name}`, { patientId: p.id });
        H.notify('doctor', `검사 결과 보고: ${p.name} ${o.name}`, { patientId: p.id });
        UI.toast('결과 보고 완료 — 처방 화면과 병동에서 볼 수 있습니다', 'ok'); A.render();
      },
      'lb.crit': (el) => {
        const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId); const crit = o.result.items.filter((r) => r.flag === 'C');
        UI.modal({ title: '위험값 보고 (Critical value)', icon: 'alert', body: `<form data-submit="lb.critGo" class="gap-m"><input type="hidden" name="id" value="${o.id}">
          ${UI.note(`<b>${esc(p.name)}</b> ${crit.map((r) => `${esc(r.n)} <b>${esc(r.v)}</b> ${esc(r.u || '')}`).join(', ')}`, 'danger')}
          <p class="small muted" style="margin:0">위험값은 정해진 시간(보통 30분) 안에 처방 의사나 담당 간호사에게 직접 전화로 알리고, 받은 사람이 값을 다시 읽어 확인(되읽기)해야 합니다.</p>
          <div class="form-grid">${UI.input('to', '전화 받은 사람 (이름·직종)', o.ward ? `${o.ward} 담당 간호사` : '처방 의사')}${UI.input('time', '보고 시각', H.t.hm(Date.now()))}</div>
          ${UI.check('readback', '받은 사람이 결과값을 다시 읽어 확인함 (되읽기)', false)}
          <div class="btn-row end">${UI.btn('위험값 보고 기록 + 결과 보고', '', { type: 'submit', kind: 'danger', size: 'lg' })}</div></form>` });
      },
      'lb.critGo': (f, d) => {
        if (!d.readback) return UI.toast('되읽기 확인을 해야 합니다', 'err');
        const o = S.get('orders', d.id); const p = H.pat(o.patientId);
        const txt = o.result.items.filter((r) => r.flag === 'C').map((r) => `${r.n} ${r.v}${r.u ? ' ' + r.u : ''}`).join(', ');
        o.result.at = Date.now(); o.result.verifiedBy = H.who(); o.result.critCall = { to: d.to, time: d.time, by: H.who() };
        F.advance(o, '결과보고');
        if (o.ward) H.notify('ward:' + o.ward, `⚠ 위험값: ${p.name} ${txt} — 주치의에게 바로 보고하세요`, { patientId: p.id, level: 'stat' });
        H.notify('doctor', `⚠ 위험값: ${p.name} ${txt}`, { patientId: p.id, level: 'stat' });
        H.log('위험값 보고', `${p.name} ${txt} → ${d.to}`, p.id);
        UI.close(); UI.toast('위험값 보고 완료', 'ok'); A.render();
      },
      'lb.xm': (el) => {
        const o = S.get('orders', el.dataset.id);
        if (!F.lastLab(o.patientId, 'ABO')) return UI.toast('혈액형 검사 결과가 없습니다. 혈액형 (ABO/Rh) 검사가 먼저 필요합니다', 'err');
        F.advance(o, '교차시험완료'); UI.toast('교차시험 적합', 'ok'); A.render();
      },
      'lb.issue': (el) => {
        const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId);
        F.advance(o, '출고', { bagNo: `26-${String(Math.floor(Math.random() * 900000) + 100000)}`, arrivedAt: Date.now() });
        if (o.ward) H.notify('ward:' + o.ward, `혈액 출고: ${p.name} ${o.name} (혈액번호 ${o.bagNo}) — 2명이 확인 후 수혈 시작`, { patientId: p.id, level: 'stat' });
        if (o.orFlag) H.notify('or', `혈액 출고: ${p.name} ${o.name} (혈액번호 ${o.bagNo}) — 수술실로 전달`, { patientId: p.id, level: 'stat' });
        UI.toast('혈액 출고 — 병동에 알렸습니다', 'ok'); A.render();
      },
    },
  });
})();
