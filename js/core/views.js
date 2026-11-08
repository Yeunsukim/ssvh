// 여러 부서가 같이 쓰는 화면 조각
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const F = H.flow;

  const freqShort = (f) => (H.M.FREQ[f] ? H.M.FREQ[f].l.replace(/\s*\(.+\)/, '') : f || '');
  const doseText = (o) => {
    if (o.cat === 'MED' || o.cat === 'INJ') return `${o.dose}${o.unit} · ${H.M.ROUTE[o.route] ? H.M.ROUTE[o.route].replace(/\s*\(.+\)/, '') : o.route} · ${freqShort(o.freq)}${o.freq === 'PRN' || o.freq === 'STAT' || o.freq === 'ONCE' ? '' : ` × ${o.days}일`}`;
    if (o.cat === 'NUR') return freqShort(o.freq);
    return o.stat ? '즉시' : '';
  };

  const V = (H.view = {
    doseText, freqShort,
    catChip(o) { return UI.chip(H.M.CAT[o.cat].short, o.cat === 'MED' || o.cat === 'INJ' ? 'purple' : 'plain'); },

    // 처방 목록 표
    orderTable(orders, o = {}) {
      const rows = orders.map((x) => ({
        cls: o.selId === x.id ? 'sel' : '',
        cells: [
          `<span class="num small">${H.t.mdhm(x.at)}</span>`,
          V.catChip(x) + (x.stat ? ' ' + UI.chip('응급', 'stat') : '') + (x.verbal ? ' ' + UI.chip('구두', 'prog') : '') + (x.outside ? ' ' + UI.chip('원외', 'plain') : ''),
          `<b>${esc(x.name)}</b>${x.note ? `<div class="small muted">${esc(x.note)}</div>` : ''}${x.offReason ? `<div class="small" style="color:var(--t-stat)">사유: ${esc(x.offReason)}</div>` : ''}`,
          `<span class="small">${esc(doseText(x))}</span>`,
          `${F.chip(x)}${!x.nurseAck && x.encType !== 'OPD' && !F.isOff(x) ? ' ' + UI.chip('간호 미확인', 'prog') : ''}`,
          o.actions ? o.actions(x) : UI.btn('이력', 'order.hist', { size: 'sm', data: { id: x.id } }),
        ],
      }));
      return UI.table([{ h: '처방 시각' }, { h: '구분' }, { h: '처방 내용' }, { h: '용량·방법' }, { h: '진행 상태' }, { h: '' }], rows, { empty: UI.empty(o.empty || '처방이 없습니다'), maxH: o.maxH });
    },

    // 누적 검사 결과 (항목 × 날짜)
    labCumulative(pid) {
      const done = S.where('orders', (x) => x.patientId === pid && x.cat === 'LAB' && x.result && x.status === '결과보고').sort((a, b) => a.result.at - b.result.at);
      const pending = S.where('orders', (x) => x.patientId === pid && x.cat === 'LAB' && !F.isDone(x));
      if (!done.length && !pending.length) return UI.empty('검사 결과가 없습니다');
      const times = [...new Set(done.map((x) => x.result.at))].slice(-6);
      const rowsByTest = {};
      done.forEach((x) => {
        const it = H.M.item(x.code);
        rowsByTest[x.code] = rowsByTest[x.code] || { name: it.name, items: {} };
        x.result.items.forEach((r) => {
          const key = r.c;
          rowsByTest[x.code].items[key] = rowsByTest[x.code].items[key] || { n: r.n, u: r.u, ref: r.ref, vals: {} };
          rowsByTest[x.code].items[key].vals[x.result.at] = r;
        });
      });
      const rows = [];
      Object.values(rowsByTest).forEach((t) => {
        rows.push({ group: esc(t.name) });
        Object.values(t.items).forEach((r) => rows.push([
          `${esc(r.n)} <span class="muted small">${esc(r.u || '')}</span>`,
          `<span class="small muted num">${esc(r.ref || '')}</span>`,
          ...times.map((ts) => { const v = r.vals[ts]; return v ? `<span class="num">${esc(v.v)}</span> ${F.flagHtml(v.flag, v.dir)}` : '<span class="muted">·</span>'; }),
        ]));
      });
      const head = [{ h: '검사 항목' }, { h: '참고치' }, ...times.map((ts) => ({ h: H.t.mdhm(ts), cls: '' }))];
      return `${pending.length ? UI.note(`진행 중인 검사 ${pending.length}건: ${pending.map((x) => `${esc(x.name)} (${esc(x.status)})`).join(', ')}`, 'info') : ''}
        <div style="margin-top:.6rem">${rows.length ? UI.table(head, rows) : ''}</div>`;
    },

    // 영상 검사 목록
    radList(pid) {
      const list = S.where('orders', (x) => x.patientId === pid && x.cat === 'RAD').sort((a, b) => b.at - a.at);
      return UI.table([{ h: '처방 시각' }, { h: '검사' }, { h: '상태' }, { h: '판독 요약' }, { h: '' }], list.map((x) => [
        `<span class="num small">${H.t.mdhm(x.at)}</span>`, `<b>${esc(x.name)}</b>`, F.chip(x),
        x.result ? esc(x.result.impression) : '<span class="muted">판독 전</span>',
        x.shotAt ? UI.btn('PACS 보기', 'pacs.open', { size: 'sm', icon: 'image', kind: 'pri', data: { id: x.id } }) : '<span class="muted small">촬영 전</span>',
      ]), { empty: UI.empty('영상 검사가 없습니다') });
    },
    pathList(pid) {
      const list = S.where('orders', (x) => x.patientId === pid && x.cat === 'PATH').sort((a, b) => b.at - a.at);
      return UI.table([{ h: '처방 시각' }, { h: '검사' }, { h: '상태' }, { h: '병리 진단' }, { h: '' }], list.map((x) => [
        `<span class="num small">${H.t.mdhm(x.at)}</span>`, `<b>${esc(x.name)}</b>`, F.chip(x),
        x.result ? `<b>${esc(x.result.dx)}</b>` : '<span class="muted">판독 전</span>',
        x.result ? UI.btn('보고서', 'path.view', { size: 'sm', icon: 'doc', data: { id: x.id } }) : '',
      ]), { empty: UI.empty('병리 검사가 없습니다') });
    },

    // 오른쪽 보조 칸: 최근 활력징후
    sideVitals(pid) {
      const v = H.lastVs(pid);
      if (!v) return `<div class="panel"><div class="panel-h"><h3>최근 활력징후</h3></div><div class="panel-b muted small">기록 없음</div></div>`;
      const c = (k, val, warn) => `<div><div class="k">${k}</div><div class="v" style="${warn ? 'color:var(--t-stat)' : ''}">${val == null || val === '' ? '-' : esc(val)}</div></div>`;
      return `<div class="panel"><div class="panel-h"><h3>최근 활력징후</h3><span class="grow"></span><span class="small muted num">${H.t.mdhm(v.at)}</span></div><div class="panel-b"><div class="mini-vs">
        ${c('혈압', v.sbp ? `${v.sbp}/${v.dbp}` : '-', v.sbp >= 160 || v.sbp < 90)}${c('맥박', v.hr, v.hr > 110 || v.hr < 50)}
        ${c('호흡', v.rr, v.rr > 24 || v.rr < 10)}${c('체온', v.bt, v.bt >= 38)}${c('산소포화도', v.spo2 ? v.spo2 + '%' : '-', v.spo2 < 92)}${c('통증', v.pain != null ? v.pain + '점' : '-', v.pain >= 7)}
      </div></div></div>`;
    },
    sideCritical(pid) {
      const crit = S.where('orders', (x) => x.patientId === pid && x.cat === 'LAB' && x.result && x.status === '결과보고' && x.result.items.some((r) => r.flag === 'C'));
      if (!crit.length) return '';
      return `<div class="panel" style="border-color:var(--t-stat)"><div class="panel-h" style="background:var(--t-stat-soft)"><h3 style="color:var(--t-stat)">${H.icon('alert')} 위험값</h3></div><div class="panel-b gap-s">${crit.map((x) => x.result.items.filter((r) => r.flag === 'C').map((r) => `<div><b>${esc(r.n)} ${esc(r.v)}</b> <span class="small muted">${esc(r.u)} · ${H.t.mdhm(x.result.at)}</span></div>`).join('')).join('')}</div></div>`;
    },

    // 활력징후 그래프 (체온·맥박·혈압)
    vsChart(pid, hours = 72) {
      const list = S.where('vitals', (v) => v.patientId === pid && v.at > Date.now() - hours * 3600000).sort((a, b) => a.at - b.at);
      if (list.length < 2) return UI.empty('그래프를 그리려면 활력징후 기록이 2개 이상 필요합니다');
      const W = 760, Hh = 260, L = 46, R = 46, T = 16, B = 30;
      const t0 = list[0].at, t1 = list[list.length - 1].at;
      const x = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
      const yBT = (v) => T + (1 - (v - 35) / 5) * (Hh - T - B); // 35~40℃
      const yHR = (v) => T + (1 - (v - 40) / 160) * (Hh - T - B); // 40~200 (혈압도 같은 눈금)
      let grid = '';
      for (let b = 35; b <= 40; b++) { const y = yBT(b); grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${b}℃</text><text x="${W - R + 6}" y="${y + 4}">${Math.round(40 + ((b - 35) / 5) * 160)}</text>`; }
      const days = [];
      for (let d = H.t.startOfDay(t0) + 86400000; d < t1; d += 86400000) days.push(d);
      grid += days.map((d) => `<line class="grid" x1="${x(d)}" x2="${x(d)}" y1="${T}" y2="${Hh - B}" stroke-dasharray="3 3"/><text x="${x(d) + 4}" y="${Hh - 10}">${H.t.md(d)}</text>`).join('');
      const path = (sel, fn) => list.filter((v) => v[sel] != null && v[sel] !== '').map((v, i) => `${i ? 'L' : 'M'}${x(v.at).toFixed(1)} ${fn(Number(v[sel])).toFixed(1)}`).join(' ');
      const pts = (sel, fn, cls) => list.filter((v) => v[sel] != null && v[sel] !== '').map((v) => `<circle class="${cls}" cx="${x(v.at).toFixed(1)}" cy="${fn(Number(v[sel])).toFixed(1)}" r="3.5"/>`).join('');
      return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="활력징후 그래프">
        <rect class="band" x="${L}" y="${yBT(40)}" width="${W - L - R}" height="${yBT(38) - yBT(40)}" opacity=".5"/>
        ${grid}
        <path class="ln-sbp" d="${path('sbp', yHR)}"/><path class="ln-dbp" d="${path('dbp', yHR)}"/>
        <path class="ln-hr" d="${path('hr', yHR)}"/><path class="ln-bt" d="${path('bt', yBT)}"/>
        ${pts('bt', yBT, 'pt-bt')}${pts('hr', yHR, 'pt-hr')}${pts('sbp', yHR, 'pt-bp')}
      </svg>
      <div class="legend" style="margin-top:.4rem"><span><i style="border-color:var(--t-stat)"></i>체온 (왼쪽 눈금)</span><span><i style="border-color:var(--t-sent)"></i>맥박 (오른쪽 눈금)</span><span><i style="border-color:var(--t-done)"></i>혈압 수축기·이완기(점선)</span><span><i style="border-color:var(--t-stat-soft);background:var(--t-stat-soft)"></i>발열 구간 38℃ 이상</span></div>`;
    },

    // 원외처방전 (종이 양식)
    rxPaper(encId) {
      const e = H.enc(encId); const p = H.pat(e.patientId); const d = H.M.doctor(e.doctorId);
      const meds = S.where('orders', (x) => x.encId === encId && x.outside && x.cat === 'MED' && !F.isOff(x));
      const no = `${H.t.d(e.at).replace(/-/g, '')}-${String(e.qno || 1).padStart(5, '0')}`;
      return `<div class="paper">
        <h2>처 방 전</h2>
        <table><tr><th style="width:14%">교부번호</th><td class="mono">${no}</td><th style="width:14%">의료기관</th><td>SSV 병원 (상급종합병원)<br><span style="font-size:.75rem">요양기관기호 1236xxxx · 전화 02-000-0000</span></td></tr>
        <tr><th>환자 성명</th><td>${esc(p.name)} (${H.sexAge(p)})</td><th>등록번호</th><td class="mono">${esc(p.mrn)}</td></tr>
        <tr><th>보험 종류</th><td>${esc(p.ins)}</td><th>질병분류기호</th><td class="mono">${(e.dx || []).map((x) => esc(x.code)).join(', ') || '-'}</td></tr>
        <tr><th>처방 의사</th><td>${esc(d.name)} (${esc(d.dept)}) <span class="stamp">인</span></td><th>교부 일자</th><td class="mono">${H.t.d(Date.now())}</td></tr></table>
        <table style="margin-top:.8rem"><thead><tr><th>처방 의약품 명칭</th><th>1회 투약량</th><th>1일 투여 횟수</th><th>총 투약 일수</th><th>용법</th></tr></thead><tbody>
        ${meds.map((x) => `<tr><td>${esc(x.name)}</td><td style="text-align:center">${esc(x.dose)}${esc(x.unit)}</td><td style="text-align:center">${H.M.FREQ[x.freq] ? H.M.FREQ[x.freq].n || '필요시' : '-'}</td><td style="text-align:center">${x.freq === 'PRN' ? x.days : x.days}</td><td>${esc(freqShort(x.freq))}${x.note ? ' · ' + esc(x.note) : ''}</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center">원외 처방 약이 없습니다</td></tr>'}
        </tbody></table>
        <table style="margin-top:.8rem"><tr><th style="width:20%">사용 기간</th><td>교부일로부터 3일 이내</td><th style="width:20%">조제 약국</th><td>환자가 원하는 약국</td></tr></table>
        <p style="font-size:.75rem;margin:.8rem 0 0;color:#444">※ 교육용 가상 처방전입니다. 실제 약국에서 사용할 수 없습니다.</p>
      </div>`;
    },
    // 검체 라벨
    labelCards(orders) {
      return `<div class="label-row">${orders.map((x) => { const p = H.pat(x.patientId); const it = H.M.item(x.code); const e = H.enc(x.encId); return `<div class="label-card">
        <b>${esc(p.name)} ${H.sexAge(p)}</b><span>${esc(p.mrn)} · ${e.type === 'OPD' ? '외래' : e.type === 'ER' ? '응급' : esc(e.ward + ' ' + e.room)}</span>
        ${UI.barcode(x.id)}<span>${esc(x.id.toUpperCase())}</span>
        <span>${esc(it.name)}</span><span>용기: ${esc(it.tube || '-')}${x.stat ? ' · 응급' : ''}</span><span>${H.t.dhm(Date.now())}</span></div>`; }).join('')}</div>`;
    },
  });

  // PACS 보기 상태
  let pacs = { id: null, slice: 0, invert: false, zoom: 1 };
  function pacsBody() {
    const o = S.get('orders', pacs.id); const p = H.pat(o.patientId); const it = H.M.item(o.code);
    const slices = H.sim.SLICES[it.kind] || ['영상'];
    const lesion = o.result ? o.result.lesion : H.sim.radReport(p, o).lesion;
    const img = H.sim.radImage(it.kind, lesion, pacs.slice, { invert: pacs.invert });
    return `<div class="pacs-tools">
        <button data-act="pacs.tool" data-v="invert" class="${pacs.invert ? 'on' : ''}">흑백 반전</button>
        <button data-act="pacs.tool" data-v="zin">확대</button><button data-act="pacs.tool" data-v="zout">축소</button>
        <button data-act="pacs.tool" data-v="reset">원래대로</button>
      </div>
      <div class="pacs">
        <div class="pacs-thumbs">${slices.map((s, i) => `<button data-act="pacs.slice" data-v="${i}" class="${i === pacs.slice ? 'on' : ''}" aria-label="${esc(s)}">${H.sim.radImage(it.kind, lesion, i)}<div style="color:#8FE6D8;font-size:.7rem;padding:.2rem">${esc(s)}</div></button>`).join('')}</div>
        <div class="pacs-view"><div style="transform:scale(${pacs.zoom});transform-origin:center;transition:transform .15s;width:100%;max-width:30rem">${img}</div>
          <div class="pacs-ov tl">SSV 병원 PACS<br>${esc(p.name)} ${H.sexAge(p)}<br>${esc(p.mrn)}</div>
          <div class="pacs-ov tr">${esc(it.mod)} · ${esc(slices[pacs.slice])}<br>${H.t.dhm(o.shotAt || o.at)}<br>영상 ${pacs.slice + 1}/${slices.length}</div>
          <div class="pacs-ov bl">확대 ${Math.round(pacs.zoom * 100)}%</div><div class="pacs-ov br">교육용 가상 영상</div>
        </div>
      </div>
      <div class="box" style="margin-top:.8rem"><h4>판독 소견</h4>${o.result ? `<p class="pre" style="margin:.2rem 0">${esc(o.result.findings)}</p><p style="margin:.4rem 0 0"><b>결론: ${esc(o.result.impression)}</b></p><p class="small muted" style="margin:.3rem 0 0">판독: ${esc(o.result.by)} · ${H.t.dhm(o.result.at)}</p>` : '<p class="muted" style="margin:0">아직 판독 전입니다. (촬영 완료, 영상의학과 판독 대기)</p>'}</div>`;
  }

  H.common = {
    'order.hist': (el) => {
      const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId);
      UI.modal({ title: `처방 진행 이력 — ${o.name}`, icon: 'list',
        body: `<p class="muted" style="margin-top:0">${esc(p.name)} · ${esc(o.cat === 'MED' || o.cat === 'INJ' ? doseText(o) : H.M.CAT[o.cat].l)}</p>
          <div class="row" style="margin-bottom:1rem">${F.steps(o).map((s, i) => `${i ? '<span class="muted">→</span>' : ''}${UI.chip(s, o.hist.some((h) => h.s === s) ? 'done' : 'plain')}`).join(' ')}</div>
          <div class="timeline">${o.hist.map((h) => `<div class="ti"><div class="t">${H.t.dhm(h.at)}</div><b>${esc(h.s)}</b> <span class="muted small">${esc(h.by)}</span></div>`).join('')}</div>` });
    },
    'pacs.open': (el) => { pacs = { id: el.dataset.id, slice: 0, invert: false, zoom: 1 }; const o = S.get('orders', pacs.id); UI.modal({ title: `PACS 영상 보기 — ${o.name}`, icon: 'image', size: 'wide', body: pacsBody() }); },
    'pacs.slice': (el) => { pacs.slice = Number(el.dataset.v); UI.refreshModal(pacsBody()); },
    'pacs.tool': (el) => {
      const v = el.dataset.v;
      if (v === 'invert') pacs.invert = !pacs.invert;
      if (v === 'zin') pacs.zoom = Math.min(2.5, pacs.zoom + 0.25);
      if (v === 'zout') pacs.zoom = Math.max(0.5, pacs.zoom - 0.25);
      if (v === 'reset') { pacs.zoom = 1; pacs.invert = false; }
      UI.refreshModal(pacsBody());
    },
    'path.view': (el) => {
      const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId); const r = o.result;
      UI.modal({ title: '병리 검사 결과 보고서', icon: 'micro', body: `<div class="paper"><h2>병리 결과 보고서</h2>
        <table><tr><th>환자</th><td>${esc(p.name)} (${H.sexAge(p)})</td><th>등록번호</th><td class="mono">${esc(p.mrn)}</td></tr>
        <tr><th>병리번호</th><td class="mono">${esc(o.pathNo || '-')}</td><th>검사</th><td>${esc(o.name)}</td></tr></table>
        <h4 style="margin:1rem 0 .3rem">육안 소견</h4><p class="pre" style="margin:0">${esc(r.gross)}</p>
        <h4 style="margin:1rem 0 .3rem">현미경 소견</h4><p class="pre" style="margin:0">${esc(r.micro)}</p>
        <h4 style="margin:1rem 0 .3rem">병리 진단</h4><p style="margin:0;font-weight:700">${esc(r.dx)}</p>
        ${r.add ? `<h4 style="margin:1rem 0 .3rem">추가 검사·의견</h4><p style="margin:0">${esc(r.add)}</p>` : ''}
        <p style="margin-top:1rem;font-size:.8rem">판독: ${esc(r.by)} · ${H.t.dhm(r.at)}</p></div>` });
    },
    'paper.rx': (el) => UI.modal({ title: '원외처방전 — 출력 미리보기', icon: 'print', size: 'wide', body: `${UI.note('실제 병원에서는 이 양식이 출력되어 환자에게 2부(약국 제출용·환자 보관용) 전달됩니다.', 'info')}<div style="margin-top:.8rem">${V.rxPaper(el.dataset.enc)}</div>` }),
  };
})();
