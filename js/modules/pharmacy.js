// 약제부: 처방 감사 → 조제 → 병동별 집계 → 불출, 원외처방전, 마약류 관리
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const F = H.flow;
  const V = H.view;

  const isRx = (o) => (o.cat === 'MED' || o.cat === 'INJ') && !o.outside;
  const where = (o) => o.encType === 'ER' ? '응급실' : o.encType === 'OPD' ? '외래 주사실' : o.ward;
  const pLine = (p, o) => `<b>${esc(p.name)}</b> <span class="muted small">${H.sexAge(p)} · ${esc(where(o))}${o.encType === 'IPD' ? ' ' + esc((H.enc(o.encId) || {}).room || '') : ''}</span>`;

  function groupByPatient(orders) {
    const g = {};
    orders.forEach((o) => { (g[o.patientId] = g[o.patientId] || []).push(o); });
    return Object.entries(g).sort((a, b) => (b[1].some((o) => o.stat) - a[1].some((o) => o.stat)) || a[1][0].at - b[1][0].at);
  }

  function tabAudit() {
    const list = S.where('orders', (o) => isRx(o) && o.status === '전송');
    if (!list.length) return UI.empty('감사할 처방이 없습니다', '의사가 약·주사 처방을 전송하면 여기에 나타납니다.');
    return `${UI.note('처방 감사: 약사가 처방을 검토하는 단계입니다. 알레르기·중복·용량·상호작용을 확인하고 문제가 있으면 반려합니다.', 'info')}
      <div class="gap-m" style="margin-top:.8rem">${groupByPatient(list).map(([pid, os]) => {
        const p = H.pat(pid);
        const w = F.dur(p, os.map((o) => ({ id: o.id, code: o.code, dose: o.dose, freq: o.freq })));
        return `<div class="panel"><div class="panel-h">${pLine(p, os[0])}<span class="grow"></span>${(p.allergies || []).map((a) => UI.flag('알레르기: ' + a.name, 'red')).join(' ')}
          ${UI.btn('이 환자 모두 승인', 'ph.okAll', { kind: 'pri', size: 'sm', icon: 'check', data: { pid } })}</div><div class="panel-b gap-s">
          ${w.length ? UI.note(`<b>점검 결과</b><ul style="margin:.3rem 0 0;padding-left:1.2rem">${w.map((x) => `<li style="color:${x.level === 'red' ? 'var(--t-stat)' : 'inherit'}">${esc(x.text)}</li>`).join('')}</ul>`, w.some((x) => x.level === 'red') ? 'danger' : 'warn') : UI.note('점검 결과 문제 없음', 'ok')}
          ${UI.table([{ h: '처방 시각' }, { h: '약' }, { h: '용량·방법' }, { h: '수량' }, { h: '처방의' }, { h: '' }], os.map((o) => [
            `<span class="num small">${H.t.mdhm(o.at)}</span>${o.stat ? ' ' + UI.chip('응급', 'stat') : ''}`, `<b>${esc(o.name)}</b>${o.note ? `<div class="small muted">${esc(o.note)}</div>` : ''}`,
            `<span class="small">${esc(V.doseText(o))}</span>`, `<span class="num">${o.qty || 1}</span>`, `<span class="small">${esc(o.by)}</span>`,
            `<div class="row" style="flex-wrap:nowrap;gap:.3rem">${UI.btn('승인', 'ph.ok', { size: 'sm', kind: 'pri', data: { id: o.id } })}${UI.btn('반려', 'ph.reject', { size: 'sm', kind: 'warn', data: { id: o.id } })}</div>`]))}
        </div></div>`;
      }).join('')}</div>`;
  }

  function tabDispense() {
    const list = S.where('orders', (o) => isRx(o) && o.status === '감사완료');
    if (!list.length) return UI.empty('조제할 처방이 없습니다', '감사 승인된 처방이 여기로 옵니다.');
    return `${UI.note('조제: 응급(STAT) 처방부터 먼저 조제합니다. 고위험 약물과 마약류는 2명이 확인합니다.', 'info')}
      <div style="margin-top:.8rem">${UI.table([{ h: '구분' }, { h: '환자' }, { h: '약' }, { h: '용량·방법' }, { h: '수량' }, { h: '' }],
        list.sort((a, b) => b.stat - a.stat || a.at - b.at).map((o) => { const p = H.pat(o.patientId); const it = H.M.item(o.code); return [
          `${o.stat ? UI.chip('응급', 'stat') : UI.chip(o.otype || '정규', 'plain')}`, pLine(p, o),
          `<b>${esc(o.name)}</b> ${it.highAlert ? UI.chip('고위험', 'stat') : ''}${it.narcotic ? UI.chip(it.narcotic, 'purple') : ''}`,
          `<span class="small">${esc(V.doseText(o))}</span>`, `<span class="num">${o.qty || 1}</span>`,
          UI.btn('조제 완료', 'ph.make', { size: 'sm', kind: 'pri', data: { id: o.id } })]; }))}</div>
      <div class="btn-row end" style="margin-top:.8rem">${UI.btn('일반 처방 모두 조제 완료', 'ph.makeAll', { kind: 'pri', icon: 'check' })}</div>`;
  }

  function tabAgg() {
    const list = S.where('orders', (o) => isRx(o) && o.status === '조제완료');
    if (!list.length) return UI.empty('불출할 약이 없습니다', '조제 완료된 약이 병동별로 모입니다.');
    const byWard = {};
    list.forEach((o) => { const w = where(o); (byWard[w] = byWard[w] || []).push(o); });
    return `${UI.note('병동별 집계표: 같은 병동으로 가는 약을 한 번에 모아 올려 보냅니다(불출). 병동 간호사는 받은 약을 확인한 뒤 투약합니다.', 'info')}
      <div class="gap-m" style="margin-top:.8rem">${Object.entries(byWard).map(([w, os]) => {
        const agg = {};
        os.forEach((o) => { agg[o.code] = agg[o.code] || { name: o.name, qty: 0, pts: new Set(), types: new Set() }; agg[o.code].qty += o.qty || 1; agg[o.code].pts.add(o.patientId); agg[o.code].types.add(o.stat ? '응급' : o.otype || '정규'); });
        return `<div class="panel"><div class="panel-h"><h3>${esc(w)}</h3>${UI.chip(`${os.length}건`, 'plain')}<span class="grow"></span>${UI.btn(`${w}(으)로 불출`, 'ph.send', { kind: 'pri', icon: 'send', data: { w } })}</div><div class="panel-b grid2">
          <div>${UI.sec('약품별 합계')}${UI.table([{ h: '약품' }, { h: '구분' }, { h: '총 수량', cls: 'num' }, { h: '환자 수', cls: 'num' }], Object.values(agg).map((a) => [esc(a.name), [...a.types].join('·'), `<span class="num">${a.qty}</span>`, `<span class="num">${a.pts.size}</span>`]))}</div>
          <div>${UI.sec('환자별')}${UI.table([{ h: '환자' }, { h: '약' }, { h: '수량', cls: 'num' }], os.map((o) => { const p = H.pat(o.patientId); return [`${esc(p.name)} <span class="small muted">${esc((H.enc(o.encId) || {}).room || '')}</span>`, esc(o.name), `<span class="num">${o.qty || 1}</span>`]; }))}</div>
        </div></div>`;
      }).join('')}</div>`;
  }

  function tabOutside() {
    const encs = {};
    S.where('orders', (o) => o.outside && o.at >= H.t.startOfDay() - 86400000).forEach((o) => { (encs[o.encId] = encs[o.encId] || []).push(o); });
    const rows = Object.entries(encs).map(([eid, os]) => { const e = H.enc(eid); const p = H.pat(e.patientId); return [`<span class="num small">${H.t.mdhm(os[0].at)}</span>`, `<b>${esc(p.name)}</b> ${H.sexAge(p)}`, `${esc(e.dept)} ${esc(H.M.doctor(e.doctorId).name)}`, os.map((o) => esc(o.name)).join(', '), UI.btn('처방전 보기', 'paper.rx', { size: 'sm', icon: 'print', data: { enc: eid } })]; });
    return `${UI.note('외래 환자의 먹는 약은 병원 밖 약국에서 조제합니다(의약분업). 병원은 원외처방전만 발행합니다.', 'info')}<div style="margin-top:.8rem">${UI.table([{ h: '발행 시각' }, { h: '환자' }, { h: '진료과' }, { h: '약' }, { h: '' }], rows, { empty: UI.empty('오늘 발행한 원외처방전이 없습니다') })}</div>`;
  }

  function tabNarc() {
    const list = S.where('orders', (o) => { const it = H.M.item(o.code); return it && it.narcotic && !o.outside; }).sort((a, b) => b.at - a.at);
    return `${UI.note('마약류는 처방·조제·불출·투약·남은 양 폐기까지 모두 기록하고 식약처 마약류통합관리시스템에 보고합니다.', 'info')}<div style="margin-top:.8rem">${UI.table([{ h: '처방 시각' }, { h: '환자' }, { h: '약' }, { h: '분류' }, { h: '상태' }, { h: '투약 기록', cls: 'num' }, { h: '식약처 보고' }], list.map((o) => {
      const p = H.pat(o.patientId); const used = S.where('mar', (m) => m.orderId === o.id && m.status === '투약').length;
      return [`<span class="num small">${H.t.mdhm(o.at)}</span>`, esc(p.name), esc(o.name), UI.chip(H.M.item(o.code).narcotic, 'purple'), F.chip(o), `<span class="num">${used}회</span>`, o.status === '불출' ? UI.chip('보고 완료 (가상)', 'done') : UI.chip('불출 후 보고', 'plain')];
    }), { empty: UI.empty('마약류 처방이 없습니다') })}</div>`;
  }

  H.reg({
    id: 'pharmacy', title: '약제부', actor: '약사', layout: 'full',
    channels: () => ['pharmacy'],
    render() {
      const tab = A.ms('tab', 'audit');
      const cnt = (st) => S.where('orders', (o) => isRx(o) && o.status === st).length;
      return `<div class="panel">${UI.tabs('ph.tab', [
        { id: 'audit', label: '처방 감사', icon: 'clip', cnt: cnt('전송') || '' }, { id: 'make', label: '조제', icon: 'pill', cnt: cnt('감사완료') || '' },
        { id: 'agg', label: '병동별 집계·불출', icon: 'send', cnt: cnt('조제완료') || '' }, { id: 'out', label: '원외처방전', icon: 'print' }, { id: 'narc', label: '마약류 관리', icon: 'alert' },
      ], tab)}<div class="panel-b">${{ audit: tabAudit, make: tabDispense, agg: tabAgg, out: tabOutside, narc: tabNarc }[tab]()}</div></div>`;
    },
    side() {
      const today = S.where('orders', (o) => isRx(o) && o.at >= H.t.startOfDay());
      return `<div class="panel"><div class="panel-h"><h3>오늘 약제부 현황</h3></div><div class="panel-b"><dl class="kv">
        <dt>오늘 받은 처방</dt><dd class="num">${today.length}건</dd><dt>감사 대기</dt><dd class="num">${today.filter((o) => o.status === '전송').length}건</dd>
        <dt>응급 처방</dt><dd class="num">${today.filter((o) => o.stat).length}건</dd><dt>반려</dt><dd class="num">${S.where('orders', (o) => o.status === '반려').length}건</dd>
        <dt>불출 완료</dt><dd class="num">${today.filter((o) => o.status === '불출').length}건</dd></dl></div></div>
        <div class="panel"><div class="panel-h"><h3>약제부 업무 순서</h3></div><div class="panel-b small"><ol style="margin:0;padding-left:1.2rem;line-height:1.9"><li>처방 감사 (약사 검토)</li><li>조제 (약 준비)</li><li>병동별 집계표 확인</li><li>불출 (병동으로 올림)</li><li>병동 간호사 수령 확인 → 투약</li></ol></div></div>`;
    },
    acts: {
      'ph.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'ph.ok': (el) => { F.advance(S.get('orders', el.dataset.id), '감사완료'); UI.toast('감사 승인', 'ok'); A.render(); },
      'ph.okAll': (el) => { S.where('orders', (o) => o.patientId === el.dataset.pid && isRx(o) && o.status === '전송').forEach((o) => F.advance(o, '감사완료')); UI.toast('이 환자 처방 모두 승인', 'ok'); A.render(); },
      'ph.reject': (el) => {
        const o = S.get('orders', el.dataset.id);
        UI.modal({ title: `처방 반려 — ${o.name}`, size: 'narrow', body: `<form data-submit="ph.rejectGo" class="gap-m"><input type="hidden" name="id" value="${o.id}">
          ${UI.select('why', '반려 사유', ['알레르기 약물', '중복 처방', '용량 과다', '약물 상호작용', '신기능에 맞지 않는 용량', '처방 정보 불충분'], '알레르기 약물')}
          ${UI.textarea('memo', '의사에게 전할 말', '', { h: '3rem' })}
          <div class="btn-row end">${UI.btn('반려하고 의사에게 알림', '', { type: 'submit', kind: 'danger', size: 'lg' })}</div></form>` });
      },
      'ph.rejectGo': (f, d) => {
        const o = S.get('orders', d.id); const p = H.pat(o.patientId);
        F.cancel(o, `${d.why}${d.memo ? ' — ' + d.memo : ''}`, '반려');
        H.notify('doctor', `약제부 반려: ${p.name} ${o.name} (${d.why}) — 처방을 다시 확인해 주세요`, { patientId: p.id, level: 'stat' });
        UI.close(); UI.toast('반려 — 처방 의사에게 알렸습니다', 'warn'); A.render();
      },
      'ph.make': async (el) => {
        const o = S.get('orders', el.dataset.id); const it = H.M.item(o.code);
        if (it.highAlert || it.narcotic) {
          const ok = await UI.confirm({ title: '2인 확인', text: `${it.name}\n${it.narcotic ? '마약류' : '고위험 약물'}입니다. 다른 약사와 함께 약 이름·용량·환자를 확인했습니까?`, ok: '2명이 확인함' });
          if (!ok) return;
          o.doubleCheck = true;
        }
        F.advance(o, '조제완료'); UI.toast('조제 완료', 'ok'); A.render();
      },
      'ph.makeAll': () => {
        const list = S.where('orders', (o) => isRx(o) && o.status === '감사완료' && !H.M.item(o.code).highAlert && !H.M.item(o.code).narcotic);
        list.forEach((o) => F.advance(o, '조제완료'));
        UI.toast(`${list.length}건 조제 완료${S.where('orders', (o) => isRx(o) && o.status === '감사완료').length ? ' — 고위험·마약류는 하나씩 2인 확인하세요' : ''}`, 'ok'); A.render();
      },
      'ph.send': (el) => {
        const w = el.dataset.w;
        const list = S.where('orders', (o) => isRx(o) && o.status === '조제완료' && where(o) === w);
        list.forEach((o) => F.advance(o, '불출', { arrivedAt: Date.now() }));
        const code = w === '응급실' ? 'ER' : w;
        if (w !== '외래 주사실') H.notify('ward:' + code, `약제부에서 약 ${list.length}건이 올라왔습니다 — 수령 확인 후 투약`, {});
        else H.notify('inj', `약제부에서 주사실로 약 ${list.length}건 불출${list.some((o) => (H.M.item(o.code) || {}).chemo) ? ' (항암제 포함 — 2인 확인)' : ''}`, {});
        H.log('약 불출', `${w} ${list.length}건`);
        UI.toast(`${w}(으)로 ${list.length}건 불출`, 'ok'); A.render();
      },
    },
  });
})();
