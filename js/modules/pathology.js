// 병리과: 검체 확인 → 접수(병리번호) → 육안검사 → 슬라이드 제작 → 판독·보고
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const F = H.flow;

  const path = (st) => S.where('orders', (o) => o.cat === 'PATH' && o.status === st).sort((a, b) => a.at - b.at);
  const pLine = (p) => `<b>${esc(p.name)}</b> <span class="muted small">${H.sexAge(p)} · ${esc(p.mrn)}</span>`;

  const STEP = {
    '전송': { tab: 'arrive', btn: '검체 도착 확인', next: '검체확인', title: '검체 도착 확인' },
    '검체확인': { tab: 'recv', btn: '병리 접수', next: '병리접수', title: '병리 접수' },
    '병리접수': { tab: 'gross', btn: '육안검사 기록', next: '육안검사', title: '육안검사' },
    '육안검사': { tab: 'slide', btn: '슬라이드 제작 완료', next: '슬라이드제작', title: '슬라이드 제작' },
    '슬라이드제작': { tab: 'read', btn: '판독', next: '판독완료', title: '판독' },
  };
  const TABS = [
    { id: 'arrive', st: '전송', label: '검체 도착', icon: 'clip', help: '시술실·수술실·외래에서 보낸 검체가 도착하면 라벨·의뢰서·고정액(10% 포르말린)을 확인합니다. 고정액이 없거나 라벨이 다르면 받지 않습니다.' },
    { id: 'recv', st: '검체확인', label: '접수', icon: 'list', help: '접수하면 병리번호(예: S26-00012)가 붙습니다. 이후 모든 블록·슬라이드는 이 번호로 관리합니다.' },
    { id: 'gross', st: '병리접수', label: '육안검사', icon: 'eye', help: '육안검사: 병리의사가 검체의 크기·색·모양을 눈으로 보고 기록하고, 필요한 부분을 잘라 카세트에 담습니다.' },
    { id: 'slide', st: '육안검사', label: '슬라이드 제작', icon: 'micro', help: '조직을 파라핀에 굳혀(블록) 얇게 잘라 유리 슬라이드에 붙이고 염색(H&E)합니다. 필요하면 면역조직화학 염색을 추가합니다.' },
    { id: 'read', st: '슬라이드제작', label: '판독·보고', icon: 'edit', help: '병리의사가 현미경으로 보고 진단을 내립니다. 암 진단은 환자 치료 방향을 정하는 가장 중요한 결과입니다.' },
    { id: 'done', st: '판독완료', label: '보고 완료', icon: 'check', help: '보고된 결과는 처방 화면의 결과 조회 → 병리에서 볼 수 있습니다.' },
  ];

  function form(o) {
    const p = H.pat(o.patientId); const it = H.M.item(o.code); const sim = H.sim.pathReport(p);
    const st = o.status;
    let fields = '';
    if (st === '전송') fields = `<div class="gap-s">${UI.check('c1', '의뢰서와 검체 라벨의 환자 정보 일치', false)}${UI.check('c2', `고정액 확인 (${esc(it.spec)})`, false)}${UI.check('c3', '검체 개수 일치', false)}</div>`;
    if (st === '검체확인') fields = `<p class="small muted" style="margin:0">접수하면 병리번호가 자동으로 붙습니다.</p>`;
    if (st === '병리접수') fields = UI.textarea('gross', '육안 소견', '', { h: '5rem', ph: sim.gross });
    if (st === '육안검사') fields = `<div class="form-grid">${UI.input('blocks', '블록 수', '1', { type: 'number' })}${UI.input('slides', '슬라이드 수', '2', { type: 'number' })}${UI.fld('염색', UI.pick('stain', ['H&E (기본 염색)', 'H&E + 면역조직화학'], 'H&E (기본 염색)'))}</div>`;
    if (st === '슬라이드제작') fields = `${UI.textarea('micro', '현미경 소견', '', { h: '5rem' })}${UI.textarea('dx', '병리 진단', '', { h: '3rem' })}${UI.textarea('add', '추가 검사·의견', '', { h: '3rem' })}
      <button type="button" class="btn sm" data-act="pt.fill" data-id="${o.id}">${H.icon('refresh')}<span>판독 예시 불러오기</span></button>`;
    return `<form data-submit="pt.next" class="box" style="background:var(--surface)"><input type="hidden" name="id" value="${o.id}">
      <div class="row between">${pLine(p)}<div class="row">${it.frozen ? UI.chip('동결절편 — 수술 중, 20~30분 안에 회신', 'stat') : ''}<b>${esc(o.name)}</b>${o.pathNo ? UI.chip(o.pathNo, 'purple') : ''}</div></div>
      <p class="small muted" style="margin:.3rem 0 .6rem">의뢰 메모: ${esc(o.note || '-')} · 처방 ${H.t.mdhm(o.at)}</p>
      ${o.gross ? `<p class="small" style="margin:0 0 .5rem"><b>육안:</b> ${esc(o.gross)}</p>` : ''}${o.slides ? `<p class="small" style="margin:0 0 .5rem"><b>슬라이드:</b> ${esc(o.slides)}</p>` : ''}
      <div class="gap-s">${fields}</div>
      <div class="btn-row end" style="margin-top:.6rem">${UI.btn(STEP[st].btn, '', { type: 'submit', kind: 'pri', icon: 'check' })}</div></form>`;
  }

  H.reg({
    id: 'pathology', title: '병리과', actor: '병리사·병리의사', layout: 'full',
    channels: () => ['path'],
    render() {
      const tab = A.ms('tab', 'arrive');
      const t = TABS.find((x) => x.id === tab);
      const list = path(t.st);
      const body = tab === 'done'
        ? H.ui.table([{ h: '보고 시각' }, { h: '병리번호' }, { h: '환자' }, { h: '검사' }, { h: '진단' }, { h: '' }], list.map((o) => [`<span class="num small">${H.t.mdhm(o.result.at)}</span>`, `<span class="mono">${esc(o.pathNo)}</span>`, esc(H.pat(o.patientId).name), esc(o.name), `<b>${esc(o.result.dx)}</b>`, UI.btn('보고서', 'path.view', { size: 'sm', data: { id: o.id } })]), { empty: UI.empty('보고된 결과가 없습니다') })
        : `<div class="gap-m">${list.map(form).join('') || UI.empty('대기 중인 검체가 없습니다', '외래·병동에서 병리 검사를 처방하면 여기로 옵니다.')}</div>`;
      return `<div class="panel">${UI.tabs('pt.tab', TABS.map((x) => ({ id: x.id, label: x.label, icon: x.icon, cnt: x.id !== 'done' ? path(x.st).length || '' : '' })), tab)}<div class="panel-b gap-m">${UI.note(t.help, 'info')}${body}</div></div>`;
    },
    acts: {
      'pt.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'pt.fill': (el) => { const o = S.get('orders', el.dataset.id); const r = H.sim.pathReport(H.pat(o.patientId)); const f = el.closest('form'); f.querySelector('[name=micro]').value = r.micro; f.querySelector('[name=dx]').value = r.dx; f.querySelector('[name=add]').value = r.add || ''; },
      'pt.next': (f, d) => {
        const o = S.get('orders', d.id); const p = H.pat(o.patientId); const st = o.status;
        if (st === '전송' && (!d.c1 || !d.c2 || !d.c3)) return UI.toast('세 가지를 모두 확인해야 받을 수 있습니다', 'err');
        const extra = {};
        if (st === '검체확인') { const n = S.where('orders', (x) => x.pathNo).length + 12; extra.pathNo = `S${String(new Date().getFullYear()).slice(2)}-${String(n).padStart(5, '0')}`; }
        if (st === '병리접수') { if (!d.gross) { const g = H.sim.pathReport(p).gross; extra.gross = g; } else extra.gross = d.gross; }
        if (st === '육안검사') extra.slides = `블록 ${d.blocks}개 · 슬라이드 ${d.slides}장 · ${d.stain}`;
        if (st === '슬라이드제작') {
          if (!d.dx) return UI.toast('병리 진단을 써 주세요', 'warn');
          extra.result = { at: Date.now(), by: H.who(), gross: o.gross, micro: d.micro, dx: d.dx, add: d.add };
        }
        F.advance(o, STEP[st].next, extra);
        if (st === '슬라이드제작') {
          const cancer = /암|carcinoma|악성/i.test(d.dx);
          H.notify('doctor', `병리 결과 보고: ${p.name} — ${d.dx}`, { patientId: p.id, level: cancer ? 'stat' : '' });
          if (o.ward) H.notify('ward:' + o.ward, `병리 결과 보고: ${p.name}`, { patientId: p.id });
          if (o.orFlag) H.notify('or', `동결절편 결과: ${p.name} — ${d.dx}`, { patientId: p.id, level: 'stat' });
        }
        UI.toast(`${STEP[st].title} 완료`, 'ok'); A.render();
      },
    },
  });
})();
