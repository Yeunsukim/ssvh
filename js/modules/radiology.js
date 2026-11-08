// 영상의학과: 검사 접수 → 촬영 → 판독 → PACS
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const F = H.flow;

  const whereOf = (o) => { const e = H.enc(o.encId); return !e ? '-' : e.type === 'OPD' ? '외래' : e.type === 'ER' ? `응급 ${e.room}` : `${e.ward} ${e.room}-${e.bed}`; };
  const pLine = (p, o) => `<b>${esc(p.name)}</b> <span class="muted small">${H.sexAge(p)} · ${esc(p.mrn)} · ${esc(whereOf(o))}</span>`;
  const rad = (st) => S.where('orders', (o) => o.cat === 'RAD' && o.status === st).sort((a, b) => b.stat - a.stat || a.at - b.at);

  function tabRecv() {
    const list = rad('전송');
    return `${UI.note('검사 접수: 검사 종류에 따라 촬영실과 시간을 정합니다. 조영제 검사는 조영제 알레르기·신장 기능·동의서를 꼭 확인합니다.', 'info')}
      <div style="margin-top:.8rem">${UI.table([{ h: '처방 시각' }, { h: '환자' }, { h: '검사' }, { h: '장비' }, { h: '주의' }, { h: '' }], list.map((o) => {
        const p = H.pat(o.patientId); const it = H.M.item(o.code); const warn = [];
        if (it.contrast) { warn.push(UI.chip('조영제', 'prog')); if ((p.allergies || []).some((a) => a.cls === 'contrast')) warn.push(UI.chip('조영제 알레르기!', 'stat')); const cr = F.lastLab(p.id, 'Cr'); if (cr && cr.v > 1.5) warn.push(UI.chip(`크레아티닌 ${cr.v}`, 'stat')); }
        if (it.portable) warn.push(UI.chip('병상 이동 촬영', 'sent'));
        return [`<span class="num small">${H.t.mdhm(o.at)}</span>${o.stat ? ' ' + UI.chip('응급', 'stat') : ''}`, pLine(p, o), `<b>${esc(o.name)}</b>`, esc(it.mod), warn.join(' ') || '-', UI.btn('접수', 'rd.recv', { size: 'sm', kind: 'pri', data: { id: o.id } })];
      }), { empty: UI.empty('접수할 영상 검사가 없습니다') })}</div>`;
  }
  function tabShoot() {
    const list = rad('검사접수');
    return `${UI.note('촬영: 방사선사가 환자를 확인하고 촬영합니다. 가임기 여성은 임신 여부를 꼭 묻고, 금속(목걸이·속옷 철사)을 빼게 합니다.', 'info')}
      <div style="margin-top:.8rem">${UI.table([{ h: '접수 시각' }, { h: '환자' }, { h: '검사' }, { h: '예약' }, { h: '' }], list.map((o) => [`<span class="num small">${H.t.mdhm(o.hist[o.hist.length - 1].at)}</span>${o.stat ? ' ' + UI.chip('응급', 'stat') : ''}`, pLine(H.pat(o.patientId), o), `<b>${esc(o.name)}</b>`, esc(o.room || '-'), UI.btn('촬영하기', 'rd.shoot', { size: 'sm', kind: 'pri', icon: 'image', data: { id: o.id } })]), { empty: UI.empty('촬영 대기가 없습니다') })}</div>`;
  }
  function tabRead() {
    const list = rad('촬영완료');
    const sel = A.ms('sel', '');
    const o = list.find((x) => x.id === sel) || list[0];
    if (!o) return UI.empty('판독할 영상이 없습니다', '촬영이 끝난 영상이 여기에 모입니다.');
    const p = H.pat(o.patientId); const it = H.M.item(o.code);
    const e = H.enc(o.encId);
    return `<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)">
      <div class="gap-s">${UI.sec(`판독 대기 ${list.length}건`)}${list.map((x) => `<button class="prow ${x.id === o.id ? 'on' : ''}" style="border:1px solid var(--line);border-radius:6px" data-act="rd.sel" data-id="${x.id}"><span class="loc">${esc(H.M.item(x.code).mod)}</span><span class="nm">${esc(H.pat(x.patientId).name)}</span><span class="mk">${x.stat ? UI.chip('응급', 'stat') : ''}</span><span class="sub">${esc(x.name)}</span></button>`).join('')}
        ${UI.btn('PACS로 영상 크게 보기', 'pacs.open', { kind: 'pri', icon: 'image', block: true, data: { id: o.id } })}
        <div class="box"><h4>임상 정보 (처방의가 보낸 내용)</h4><dl class="kv"><dt>환자</dt><dd>${esc(p.name)} ${H.sexAge(p)}</dd><dt>진단</dt><dd>${esc((e.dx || []).map((d) => d.name).join(', ') || e.cc || '-')}</dd><dt>메모</dt><dd>${esc(o.note || '-')}</dd></dl></div></div>
      <form data-submit="rd.read" class="gap-m"><input type="hidden" name="id" value="${o.id}">
        <div style="background:#000;border-radius:6px;max-width:22rem">${H.sim.radImage(it.kind, H.sim.radReport(p, o).lesion, 0)}</div>
        ${UI.textarea('findings', '판독 소견 (Findings)', '', { h: '7rem', ph: '영상에서 보이는 것을 부위별로 씁니다' })}
        ${UI.textarea('impression', '결론 (Impression)', '', { h: '3rem' })}
        <div class="btn-row end">${UI.btn('판독 예시 불러오기', 'rd.fill', { icon: 'refresh', data: { id: o.id } })}${UI.btn('판독 완료 → 보고', '', { type: 'submit', kind: 'pri', icon: 'send' })}</div>
      </form></div>`;
  }
  function tabPacs() {
    const list = S.where('orders', (o) => o.cat === 'RAD' && o.shotAt).sort((a, b) => b.shotAt - a.shotAt);
    return UI.table([{ h: '촬영 시각' }, { h: '환자' }, { h: '검사' }, { h: '상태' }, { h: '결론' }, { h: '' }], list.map((o) => [`<span class="num small">${H.t.mdhm(o.shotAt)}</span>`, pLine(H.pat(o.patientId), o), esc(o.name), F.chip(o), o.result ? esc(o.result.impression) : '<span class="muted">판독 전</span>', UI.btn('보기', 'pacs.open', { size: 'sm', icon: 'image', data: { id: o.id } })]), { empty: UI.empty('저장된 영상이 없습니다') });
  }

  H.reg({
    id: 'radiology', title: '영상의학과', actor: '방사선사·영상의학과 의사', layout: 'full',
    channels: () => ['rad'],
    render() {
      const tab = A.ms('tab', 'recv');
      return `<div class="panel">${UI.tabs('rd.tab', [
        { id: 'recv', label: '검사 접수', icon: 'clip', cnt: rad('전송').length || '' }, { id: 'shoot', label: '촬영', icon: 'image', cnt: rad('검사접수').length || '' },
        { id: 'read', label: '판독', icon: 'edit', cnt: rad('촬영완료').length || '' }, { id: 'pacs', label: 'PACS 영상 목록', icon: 'eye' },
      ], tab)}<div class="panel-b">${{ recv: tabRecv, shoot: tabShoot, read: tabRead, pacs: tabPacs }[tab]()}</div></div>`;
    },
    acts: {
      'rd.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'rd.sel': (el) => { A.set('sel', el.dataset.id); A.render(); },
      'rd.recv': (el) => {
        const o = S.get('orders', el.dataset.id); const it = H.M.item(o.code); const p = H.pat(o.patientId);
        const rooms = { X선: ['일반촬영 1실', '일반촬영 2실', '이동식 촬영'], CT: ['CT 1실', 'CT 2실 (응급)'], MRI: ['MRI 1실'], 초음파: ['초음파 1실', '초음파 2실'], 유방촬영: ['유방촬영실'], 혈관조영: ['심혈관 중재실'] }[it.mod] || ['촬영실'];
        UI.modal({ title: `검사 접수 — ${o.name}`, size: 'narrow', body: `<form data-submit="rd.recvGo" class="gap-m"><input type="hidden" name="id" value="${o.id}">
          <p style="margin:0">${pLine(p, o)}</p>
          ${UI.fld('촬영실', UI.pick('room', it.portable ? ['이동식 촬영'] : rooms, it.portable ? '이동식 촬영' : rooms[o.stat && rooms[1] ? 1 : 0]))}
          ${UI.input('time', '촬영 예정 시각', H.t.hm(Date.now() + (o.stat ? 5 : 30) * 60000))}
          ${it.contrast ? `${UI.note('조영제 검사 확인 사항', 'warn')}<div class="gap-s">${UI.check('cAllergy', `조영제 알레르기 없음 확인${(p.allergies || []).some((a) => a.cls === 'contrast') ? ' — ⚠ 이 환자는 조영제 알레르기가 있습니다!' : ''}`, false)}${UI.check('cRenal', '최근 신장 기능(크레아티닌) 확인', false)}${UI.check('cConsent', '조영제 사용 동의서 받음', false)}${UI.check('cNpo', '검사 전 4~6시간 금식 안내', false)}</div>` : ''}
          <div class="btn-row end">${UI.btn('접수', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
      },
      'rd.recvGo': (f, d) => {
        const o = S.get('orders', d.id); const it = H.M.item(o.code); const p = H.pat(o.patientId);
        if (it.contrast && (!d.cAllergy || !d.cRenal || !d.cConsent)) return UI.toast('조영제 검사는 알레르기·신장 기능·동의서를 모두 확인해야 합니다', 'err');
        F.advance(o, '검사접수', { room: `${d.room} ${d.time}` });
        if (o.ward) H.notify('ward:' + o.ward, `영상 검사 예정: ${p.name} ${o.name} — ${d.room} ${d.time}${it.portable ? '' : ' (환자 이송 준비)'}`, { patientId: p.id });
        UI.close(); UI.toast('검사 접수 — 병동에 시간을 알렸습니다', 'ok'); A.render();
      },
      'rd.shoot': (el) => {
        const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId);
        const fertile = p.sex === 'F' && H.age(p.birth) >= 12 && H.age(p.birth) <= 55;
        UI.modal({ title: `촬영 — ${o.name}`, icon: 'image', size: 'narrow', body: `<form data-submit="rd.shootGo" class="gap-m"><input type="hidden" name="id" value="${o.id}">
          <p style="margin:0">${pLine(p, o)}</p>
          <div class="gap-s">${UI.check('c1', '환자 이름·생년월일 두 가지로 확인', false)}${fertile ? UI.check('c2', '가임기 여성 — 임신 가능성 없음 확인', false) : ''}${UI.check('c3', '금속·장신구 제거', false)}${UI.check('c4', '촬영 부위·좌우 확인', false)}</div>
          <div class="btn-row end">${UI.btn('촬영 완료 → PACS 전송', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'send' })}</div></form>` });
      },
      'rd.shootGo': (f, d) => {
        if (!d.c1) return UI.toast('환자 확인은 꼭 해야 합니다', 'err');
        if ('c2' in d && !d.c2) return UI.toast('가임기 여성은 임신 여부를 확인해야 합니다', 'err');
        const o = S.get('orders', d.id);
        F.advance(o, '촬영완료', { shotAt: Date.now() });
        UI.close(); UI.toast('촬영 완료 — 영상이 PACS에 저장되었습니다', 'ok'); A.render();
      },
      'rd.fill': (el) => {
        const o = S.get('orders', el.dataset.id); const r = H.sim.radReport(H.pat(o.patientId), o);
        const f = el.closest('form'); f.querySelector('[name=findings]').value = r.findings; f.querySelector('[name=impression]').value = r.impression;
      },
      'rd.read': (f, d) => {
        if (!d.findings || !d.impression) return UI.toast('판독 소견과 결론을 모두 써 주세요', 'warn');
        const o = S.get('orders', d.id); const p = H.pat(o.patientId);
        F.advance(o, '판독완료', { result: { at: Date.now(), by: H.who(), findings: d.findings, impression: d.impression, lesion: H.sim.radReport(p, o).lesion } });
        H.notify('doctor', `영상 판독 완료: ${p.name} ${o.name} — ${d.impression}`, { patientId: p.id, level: o.stat ? 'stat' : '' });
        if (o.ward) H.notify('ward:' + o.ward, `영상 판독 완료: ${p.name} ${o.name}`, { patientId: p.id });
        A.set('sel', ''); UI.toast('판독 보고 완료', 'ok'); A.render();
      },
    },
  });
})();
