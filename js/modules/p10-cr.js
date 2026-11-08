// 진료협력센터 실무 화면 — 회신/회송/의뢰 전체요약, 회신서, 진료의뢰·회송서 작성, 전원환자 관리(요양급여 의뢰서·회송서, 송·수신목록)
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const E = () => H.erp;
  const DAY = 86400000;
  const ms = (k, d) => A.ms(k, d); const set = (k, v) => A.set(k, v);
  const ck = (n, on, label) => `<label class="row" style="gap:.25rem;flex-wrap:nowrap"><input type="checkbox" name="${esc(n)}" ${on ? 'checked' : ''} aria-label="${esc(label || n)}">${label ? esc(label) : ''}</label>`;
  const radio = (n, opts, v) => `<span class="row" style="gap:.6rem">${opts.map((o) => `<label class="row" style="gap:.2rem;flex-wrap:nowrap"><input type="radio" name="${esc(n)}" value="${esc(o)}" ${o === v ? 'checked' : ''}>${esc(o)}</label>`).join('')}</span>`;
  const sec = (t) => `<div class="erp-sec" style="color:var(--fg)">■ ${esc(t)}</div>`;
  const ta = (n, v, h, l) => `<textarea name="${esc(n)}" style="width:100%;min-height:${h || '4rem'}" aria-label="${esc(l || n)}">${esc(v || '')}</textarea>`;
  const PARTNERS = ['가상내과의원 (김가상 원장)', '가상정형외과의원', '가상외과의원 (집 근처)', '가상요양병원', '가상가정의학과의원', '가상종합병원 (2차)', '보건소 (가상구)'];
  const ORGNO = (n) => `3${String(Math.abs([...n].reduce((s, c) => s * 31 + c.charCodeAt(0), 7)) % 10000000).padStart(7, '0')}`;
  const doc = (id) => (H.M.doctor(id) || { name: '-' }).name;
  const ediNo = () => `${T.d(Date.now()).replace(/-/g, '')}${String(Math.floor(Math.random() * 90000) + 10000)}`;
  const refs = (fn) => S.where('refs', fn || (() => true)).sort((a, b) => b.at - a.at);
  const patOf = (r) => (r.pid ? H.pat(r.pid) : S.all('patients').find((x) => x.name === r.pname)) || null;
  const lastEnc = (p, since) => S.where('encounters', (e) => e.patientId === p.id && (!since || e.at >= since - DAY)).sort((a, b) => b.at - a.at)[0];
  const PAL = ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'];

  // ═════════ 회신/회송/의뢰 전체요약 ═════════
  function months(n) { const out = []; const d = new Date(); d.setDate(1); for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); } return out; }
  function monthly(ym) {
    const r = S.where('recs', (x) => x.kind === 'refmon' && x.ym === ym)[0] || { reply: 0, back: 0, req: 0, inIpd: 0, inOpd: 0, backIpd: 0, backOpd: 0, reqIpd: 0, reqOpd: 0, first: 0, re: 0, fresh: 0, depts: {} };
    const live = refs((x) => T.d(x.at).slice(0, 7) === ym);
    const add = (k, n) => { r[k] = (r[k] || 0) + n; };
    const o = Object.assign({}, r, { depts: Object.assign({}, r.depts || {}) });
    live.forEach((x) => { if (x.dir === 'in') { o.req = (o.req || 0) + 1; o.reqOpd = (o.reqOpd || 0) + 1; o.first = (o.first || 0) + 1; o.depts[x.dept] = (o.depts[x.dept] || 0) + 1; if (x.reply) { o.reply = (o.reply || 0) + 1; o.inOpd = (o.inOpd || 0) + 1; } } else { o.back = (o.back || 0) + 1; o.backIpd = (o.backIpd || 0) + 1; } }); void add;
    return o;
  }
  function lineChart(labels, series, W = 620, Hh = 230) {
    const mx = Math.max(1, ...series.flatMap((s) => s.v)); const x = (i) => 40 + (i * (W - 50)) / Math.max(1, labels.length - 1); const y = (v) => Hh - 30 - (v / mx) * (Hh - 50);
    return `<svg viewBox="0 0 ${W} ${Hh}" class="chart" role="img" aria-label="월별 추이">${[0, 0.5, 1].map((f) => `<line x1="40" x2="${W - 10}" y1="${y(mx * f)}" y2="${y(mx * f)}" stroke="var(--line)"/><text x="34" y="${y(mx * f) + 4}" font-size="10" text-anchor="end" fill="var(--fg-3)">${Math.round(mx * f).toLocaleString()}</text>`).join('')}
      ${series.map((s, k) => `<polyline points="${s.v.map((v, i) => `${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="${PAL[k]}" stroke-width="2"/>${s.v.map((v, i) => (i % 3 === 0 || i === s.v.length - 1 ? `<text x="${x(i)}" y="${y(v) - 5}" font-size="9" text-anchor="middle" fill="${PAL[k]}">${v.toLocaleString()}</text>` : '')).join('')}`).join('')}
      ${labels.map((l, i) => (i % 6 === 0 || i === labels.length - 1 ? `<text x="${x(i)}" y="${Hh - 10}" font-size="10" text-anchor="middle" fill="var(--fg-2)">${l.slice(2).replace('-', '.')}</text>` : '')).join('')}
      ${series.map((s, k) => `<rect x="${50 + k * 110}" y="4" width="10" height="10" fill="${PAL[k]}"/><text x="${64 + k * 110}" y="13" font-size="11" fill="var(--fg-2)">${esc(s.n)}</text>`).join('')}</svg>`;
  }
  function donut(parts, center, W = 260) {
    const tot = parts.reduce((s, p) => s + p[1], 0) || 1; let a = -Math.PI / 2; const cx = W / 2, cy = 105, R = 80, r = 46;
    const arcs = parts.map(([l, v], k) => { const b = a + (v / tot) * Math.PI * 2; const big = b - a > Math.PI ? 1 : 0; const p = (t, rr) => `${cx + rr * Math.cos(t)},${cy + rr * Math.sin(t)}`; const s = `<path d="M${p(a, R)} A${R},${R} 0 ${big} 1 ${p(b - 0.0001, R)} L${p(b - 0.0001, r)} A${r},${r} 0 ${big} 0 ${p(a, r)} Z" fill="${PAL[k % PAL.length]}"/>`; a = b; return s; }).join('');
    return `<svg viewBox="0 0 ${W} 215" class="chart" role="img" aria-label="구성 비율">${arcs}<text x="${cx}" y="${cy + 6}" font-size="18" font-weight="700" text-anchor="middle" fill="var(--fg)">${esc(center)}</text></svg><div class="gap-s small">${parts.map(([l, v], k) => `<span class="row" style="gap:.3rem;flex-wrap:nowrap"><i style="display:inline-block;width:.7rem;height:.7rem;flex:none;background:${PAL[k % PAL.length]}"></i><span style="flex:1">${esc(l)}</span><b class="num">${v.toLocaleString()}</b><span class="muted num">${Math.round((v / tot) * 1000) / 10}%</span></span>`).join('')}</div>`;
  }
  const card = (t, body) => `<div class="panel"><div class="panel-h"><h3>📊 ${esc(t)}</h3></div><div class="panel-b">${body}</div></div>`;
  H.reg({
    id: 'cr-dash', title: '회신/회송/의뢰 전체요약', actor: '진료협력센터', layout: 'full', channels: () => ['ref'],
    render() {
      const tab = ms('tab', 'all'); const span = ms('span', 24); const ms_ = months(span + 1).slice(0, -1); const data = ms_.map(monthly); const cm = monthly(months(1)[0]);
      const sum = (k) => data.reduce((s, d) => s + (d[k] || 0), 0);
      const depts = {}; data.forEach((d) => Object.entries(d.depts || {}).forEach(([k, v]) => { depts[k] = (depts[k] || 0) + v; }));
      const topDept = Object.entries(depts).sort((a, b) => b[1] - a[1]); const deptParts = topDept.slice(0, 7).concat(topDept.length > 7 ? [['기타', topDept.slice(7).reduce((s, x) => s + x[1], 0)]] : []);
      const rate = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '-');
      const bar = `<div class="row between" style="background:var(--k-head);color:var(--k-head-fg);padding:.4rem .7rem;border-radius:4px"><b>📊 회신/회송/의뢰 ${{ all: '전체요약', reply: '회신 분석', back: '회송 분석', req: '의뢰 분석' }[tab]}</b><span class="row">입외구분 <select data-chg="cd.io" aria-label="입외구분" style="color:#222;background:#fff"><option>전체</option><option>입원</option><option>외래</option></select> 기간 ${[12, 24, 60].map((n) => `<button type="button" class="btn sm ${n === span ? 'pri' : ''}" data-act="cd.span" data-v="${n}">${n === 60 ? '5년' : n / 12 + '년'}</button>`).join('')}</span></div>`;
      let body;
      if (tab === 'all') body = `<div class="grid2" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">${card('회신/회송/의뢰 현황', lineChart(ms_, [{ n: '회신건수', v: data.map((d) => d.reply || 0) }, { n: '회송건수', v: data.map((d) => d.back || 0) }, { n: '의뢰건수', v: data.map((d) => d.req || 0) }]))}
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr));gap:.6rem">${card('회신 요약', donut([['외래', sum('inOpd')], ['입원', sum('inIpd')]], sum('reply').toLocaleString(), 220))}${card('회송 요약', donut([['외래', sum('backOpd')], ['입원', sum('backIpd')]], sum('back').toLocaleString(), 220))}${card('의뢰 요약', donut([['외래', sum('reqOpd')], ['입원', sum('reqIpd')]], sum('req').toLocaleString(), 220))}</div></div>
        <div class="grid2" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">${card('의뢰환자 현황 (의뢰·회신·회신율)', lineChart(ms_, [{ n: '의뢰환자수', v: data.map((d) => d.req || 0) }, { n: '회신건수', v: data.map((d) => d.reply || 0) }]) + `<p class="small" style="margin:0">기간 회신율 <b>${rate(sum('reply'), sum('req'))}</b> — 회신율은 상급종합병원 진료협력 평가 지표입니다.</p>`)}
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr));gap:.6rem">${card('의뢰환자 입원·외래', donut([['외래', sum('reqOpd')], ['입원', sum('reqIpd')]], sum('req').toLocaleString(), 220))}${card('의뢰환자 초·재진', donut([['초진', sum('first')], ['신환', sum('fresh')], ['재진', sum('re')]], sum('req').toLocaleString(), 220))}${card('의뢰환자 부서별', donut(deptParts.length ? deptParts : [['없음', 1]], sum('req').toLocaleString(), 220))}</div></div>`;
      else { const k = { reply: ['reply', 'inOpd', 'inIpd', '회신'], back: ['back', 'backOpd', 'backIpd', '회송'], req: ['req', 'reqOpd', 'reqIpd', '의뢰'] }[tab];
        body = `${card(`${k[3]} 월별 추이`, lineChart(ms_, [{ n: `${k[3]} 외래`, v: data.map((d) => d[k[1]] || 0) }, { n: `${k[3]} 입원`, v: data.map((d) => d[k[2]] || 0) }]))}
          ${card(`${k[3]} 월별 표`, E().grid([{ h: '년월' }, { h: '외래', n: 1 }, { h: '입원', n: 1 }, { h: '합계', n: 1 }].concat(tab === 'req' ? [{ h: '회신', n: 1 }, { h: '회신율', n: 1 }] : []), ms_.slice().reverse().map((m, i) => { const d = data[data.length - 1 - i]; return [m, (d[k[1]] || 0).toLocaleString(), (d[k[2]] || 0).toLocaleString(), (d[k[0]] || 0).toLocaleString()].concat(tab === 'req' ? [(d.reply || 0).toLocaleString(), rate(d.reply || 0, d.req || 0)] : []); }), { h: '22rem' }))}
          ${tab === 'req' ? card('진료과별 의뢰', E().grid([{ h: '진료과' }, { h: '의뢰', n: 1 }, { h: '비율', n: 1 }], topDept.map(([d, v]) => [esc(d), v.toLocaleString(), rate(v, sum('req'))]))) : ''}`; }
      return `<div class="gap-s">${E().tabs('cd.tab', [['all', '전체요약'], ['reply', '회신 분석'], ['back', '회송 분석'], ['req', '의뢰 분석']], tab)}${bar}${body}<div class="row">${UI.chip(`이번 달 (진행 중): 의뢰 ${(cm.req || 0).toLocaleString()} · 회신 ${(cm.reply || 0).toLocaleString()} · 회송 ${(cm.back || 0).toLocaleString()}`, 'sent')}</div><p class="small muted" style="margin:0">지난 달까지는 진료협력 통계(가상), 이번 달은 실습 중 처리한 의뢰·회신·회송이 실시간으로 더해집니다.</p></div>`;
    },
    acts: { 'cd.tab': (el) => { set('tab', el.dataset.v); A.render(); }, 'cd.span': (el) => { set('span', Number(el.dataset.v)); A.render(); }, 'cd.io': () => UI.toast('교육용: 입외구분 필터는 표시만 합니다', 'info') },
  });

  // ═════════ 회신서 ═════════
  const replyState = (r) => (r.replySent ? '발송' : r.reply ? '회신완료' : r.appt && Date.now() - r.at > 14 * DAY ? '기간초과' : r.pid ? '회신대기' : '접수전');
  function replyForm(r) {
    const p = patOf(r); const e = p && lastEnc(p, r.at); const f = r.replyForm || {}; const ns = e ? S.where('notes', (n) => n.encId === e.id) : [];
    const course = f.course || (ns.length ? ns.map((n) => `${T.d(n.at)} ${n.type}: ${Object.values(n.content || {}).filter(Boolean).join(' / ')}`).join('\n').slice(0, 600) : e ? `${T.d(e.at)} ${e.dept} 진료. ${e.cc || ''}` : '');
    const dx = e && e.dx && e.dx.length ? e.dx : [];
    return `<form data-submit="rp.save" class="gap-s"><input type="hidden" name="id" value="${r.id}">
      <div class="row">저장구분 <select name="mode" aria-label="저장구분"><option>2. 일반저장</option><option>1. 임시저장</option></select>${UI.btn('진료의뢰서 확인', 'rp.orig', { size: 'sm', data: { id: r.id } })}${UI.btn('처방내역 확인', 'rp.orders', { size: 'sm', data: { id: r.id } })}${UI.btn('발송 (중계시스템)', 'rp.send', { size: 'sm', kind: 'pri', data: { id: r.id } })}</div>
      <h3 style="text-align:center;letter-spacing:.6em;text-decoration:underline">회 신 서</h3>
      ${sec('의뢰병원')}${E().fields([{ l: '의뢰병원', txt: r.from || '-', w: 2 }, { l: '의뢰의사', txt: (r.from || '').match(/\((.*)\)/)?.[1] || '-' }])}
      ${sec('진료 내역')}${E().fields([{ l: '등록번호', txt: p ? p.mrn : '-', t: 'warn' }, { l: '환자이름', txt: r.pname, t: 'warn' }, { l: '유형', txt: e ? (e.type === 'IPD' ? '입원' : e.type === 'ER' ? '응급' : '외래') : '-' }, { l: '진료구분', txt: e ? e.visit || '초진' : '-' },
        { l: '진료일자', txt: e ? T.d(e.at) : (r.appt || '-') }, { l: '퇴원일자', txt: e && e.endAt ? T.d(e.endAt) : '-' }, { l: '진료과', txt: r.dept }, { l: '진료의사', txt: e ? doc(e.doctorId) : '-' }])}
      ${sec('상병코드')}${E().fields([{ l: '상병코드', txt: dx.map((d) => d.code).join(', ') || '-', t: 'warn', w: 'full' }, { l: '상병명', txt: dx.map((d) => d.name).join(', ') || '진료 기록에 진단이 없습니다', t: 'warn', w: 'full' }, { l: '구분', html: radio('dxk', ['임상적', '최종'], f.dxk || '최종'), w: 2 }])}
      ${sec('회신 내역')}${E().fields([{ l: '정보공개동의', html: ck('open', f.open !== false, '동의') }, { l: '진료경과', w: 'full', html: ta('course', course, '8rem', '진료경과') }, { l: '향후치료 의견', w: 'full', html: ta('plan', f.plan || '저희 병원에서 정밀 검사 후 치료 방침을 정했습니다. 안정되면 귀 의원에서 계속 진료 부탁드립니다.', '3.5rem', '향후치료 의견') }])}
      ${sec('회신 상세 내역')}${E().fields([{ l: '의뢰서날짜', txt: T.d(r.at) }, { l: '결과 첨부', n: 'att', v: f.att || '첨부안함', opts: ['첨부안함', '검사결과지', '영상 CD', '퇴원요약지'] }, { l: '지연사유', n: 'late', v: f.late || '', opts: ['', '검사 결과 대기', '환자 미내원', '의사 부재', '기타'] }, { l: '회신여부', n: 'need', v: f.need || '회신', opts: ['회신', '회신 불필요'] },
        { l: '불필요사유', n: 'noWhy', v: f.noWhy || '', opts: ['', '단순 검사 의뢰', '환자 요청', '재의뢰'] }, { l: '소견유무', txt: f.course ? '있음' : '없음' }, { l: '의뢰일자', txt: T.d(r.at) }, { l: '회신발송일', txt: r.replySent ? T.d(r.replySent) : '-' }, { l: '발송 여부', txt: r.replySent ? `발송 (${r.replyEdi})` : '미발송', t: r.replySent ? 'calc' : 'warn' }])}
      <div class="btn-row end">${UI.btn('저장', '', { type: 'submit', kind: 'pri' })}</div></form>`;
  }
  H.reg({
    id: 'cr-reply', title: '회신서', actor: '진료협력센터 간호사·의사', layout: 'full', channels: () => ['ref'],
    render() {
      const only = ms('only', ''); const list = refs((r) => r.dir === 'in' && r.status !== '거절 완료').filter((r) => !only || replyState(r) === only);
      const cur = list.find((r) => r.id === ms('sel', '')) || list[0]; const p = cur && patOf(cur); const i = p && E().info(p);
      return `<div class="erp">${E().bar([{ l: '조회', act: 'rp.q' }, { l: '저장', act: 'rp.saveBtn', kind: 'pri' }, { l: '삭제', act: 'rp.del', data: { id: cur ? cur.id : '' } }, { l: only === '기간초과' ? '전체 보기' : '기간초과', act: 'rp.late' }, { l: 'EMR 조회', act: 'rp.emr', data: { id: cur ? cur.id : '' } }, { l: '의뢰서 스캔 조회', act: 'rp.orig', data: { id: cur ? cur.id : '' } }])}
        ${p ? E().fields([{ l: '등록번호', txt: p.mrn, t: 'key' }, { l: '주민번호', txt: i.rrn }, { l: '휴대[환자]', txt: p.phone || '-' }, { l: '우편번호', txt: i.zip }, { l: '환자성명', txt: p.name, t: 'key' }, { l: '생년월일', txt: p.birth }, { l: '기타[자택]', txt: i.home || '-' }, { l: '하위주소', txt: p.address || '-' }]) : ''}
        <div class="erp-cols3" style="grid-template-columns:minmax(0,1fr) minmax(0,1.25fr)">${E().grid([{ h: '순번' }, { h: '진료' }, { h: '등록번호' }, { h: '환자이름' }, { h: '상태' }, { h: '진료일자' }, { h: '초재진' }, { h: '진료부서' }, { h: '진료의사' }, { h: '정보공개' }, { h: '의뢰병원' }], list.map((r, k) => { const pp = patOf(r); const e = pp && lastEnc(pp, r.at); const st = replyState(r); return { cells: [k + 1, e ? (e.type === 'IPD' ? '입원' : '외래') : '-', pp ? pp.mrn : '-', esc(r.pname), `<span style="${st === '기간초과' ? 'color:var(--t-stat);font-weight:700' : ''}">${st}</span>`, e ? T.d(e.at) : esc(r.appt || '-'), e ? e.visit || '초진' : '', esc(r.dept), e ? esc(doc(e.doctorId)) : '', (r.replyForm || {}).open === false ? 'N' : 'Y', esc(r.from || '')], on: cur && r.id === cur.id, act: 'rp.sel', data: { id: r.id } }; }), { h: '34rem', empty: '의뢰 받은 환자가 없습니다' })}
          <div>${cur ? (cur.pid || patOf(cur) ? replyForm(cur) : UI.note('아직 진료 예약 전입니다 — 진료협력센터(의뢰 받기)에서 예약을 먼저 잡으세요.', 'warn')) : UI.empty('의뢰 건을 고르세요')}</div></div></div>`;
    },
    acts: {
      'rp.sel': (el) => { set('sel', el.dataset.id); A.render(); }, 'rp.q': () => A.render(), 'rp.late': () => { set('only', ms('only', '') === '기간초과' ? '' : '기간초과'); A.render(); },
      'rp.saveBtn': () => { const f = document.querySelector('form[data-submit="rp.save"]'); if (f) f.requestSubmit(); },
      'rp.save': (f, d) => { const r = S.get('refs', d.id); r.replyForm = { dxk: d.dxk, open: !!d.open, course: d.course, plan: d.plan, att: d.att, late: d.late, need: d.need, noWhy: d.noWhy, mode: d.mode };
        if (d.mode.startsWith('2')) { r.reply = `${d.course}\n향후: ${d.plan}`; r.replyAt = Date.now(); if (!['회신 완료', '회신 발송'].includes(r.status)) r.status = '회신 완료'; } S.save(); H.log('회신서 저장', r.pname); UI.toast(d.mode.startsWith('2') ? '회신서 저장 — 발송하세요' : '임시저장', 'ok'); A.render(); },
      'rp.send': (el) => { const r = S.get('refs', el.dataset.id); if (!r.reply) return UI.toast('회신서를 먼저 일반저장 하세요', 'warn'); if (r.replyForm && r.replyForm.open === false) return UI.toast('정보공개 동의가 없으면 회신 내용을 보낼 수 없습니다', 'err'); r.replySent = Date.now(); r.replyEdi = ediNo(); r.status = '회신 발송'; S.save(); UI.toast(`진료의뢰회송 중계시스템으로 발송 (${r.replyEdi})`, 'ok'); A.render(); },
      'rp.del': (el) => { const r = S.get('refs', el.dataset.id); if (!r || r.replySent) return UI.toast('발송한 회신서는 지울 수 없습니다', 'warn'); r.replyForm = null; r.reply = null; if (r.status === '회신 완료') r.status = '예약 완료'; S.save(); A.render(); },
      'rp.orig': (el) => { const r = S.get('refs', el.dataset.id); if (!r) return; UI.modal({ title: '진료의뢰서 (받은 문서)', size: 'wide', body: `<div class="box gap-s"><h3 style="text-align:center">진 료 의 뢰 서</h3>${E().fields([{ l: '의뢰기관', txt: r.from, w: 2 }, { l: '기관기호', txt: ORGNO(r.from || '') }, { l: '환자', txt: `${r.pname} (${r.psex === 'F' ? '여' : '남'}/${r.page || '-'}세)` }, { l: '의뢰 진료과', txt: r.dept }, { l: '긴급도', txt: r.urgency || '일반' }, { l: '의뢰 사유', txt: r.reason, w: 'full' }, { l: '의뢰일', txt: T.mdhm(r.at) }])}</div>` }); },
      'rp.orders': (el) => { const r = S.get('refs', el.dataset.id); const p = patOf(r); const os = p ? S.where('orders', (o) => o.patientId === p.id && o.at >= r.at - DAY) : []; UI.modal({ title: `처방내역 — ${r.pname}`, size: 'wide', body: E().grid([{ h: '처방일' }, { h: '분류' }, { h: '처방' }, { h: '상태' }], os.map((o) => [T.d(o.at), esc((H.M.CAT[o.cat] || {}).l || o.cat), esc(o.name), esc(o.status)]), { empty: '처방이 없습니다' }) }); },
      'rp.emr': (el) => { const r = S.get('refs', el.dataset.id); const p = r && patOf(r); if (!p) return UI.toast('환자가 없습니다', 'warn'); const ns = S.where('notes', (n) => n.patientId === p.id).sort((a, b) => b.at - a.at); UI.modal({ title: `EMR — ${p.name}`, size: 'wide', body: ns.map((n) => `<div class="box"><b>${esc(n.type)}</b> <span class="small muted">${T.mdhm(n.at)} ${esc(n.by)}</span><div class="small" style="white-space:pre-wrap">${esc(Object.values(n.content || {}).join('\n'))}</div></div>`).join('') || UI.empty('기록이 없습니다') }); },
    },
  });

  // ═════════ 진료의뢰·회송서 작성 ═════════
  const OTABS = [['MED', '투약주사', (o) => ['MED', 'INJ'].includes(o.cat)], ['LAB', '검체검사', (o) => o.cat === 'LAB'], ['PATH', '병리검사', (o) => o.cat === 'PATH'], ['RAD', '영상검사', (o) => o.cat === 'RAD'], ['FUNC', '기능검사', (o) => o.cat === 'PROC' && (H.M.item(o.code) || {}).func], ['OP', '수술처치', (o) => ['OP', 'CV', 'EN'].includes(o.cat) || (o.cat === 'PROC' && !(H.M.item(o.code) || {}).func)], ['ALG', '알러지/부작용', null]];
  H.reg({
    id: 'cr-send', title: '진료의뢰·회송서 작성', actor: '진료협력센터 간호사·의사', layout: 'full', channels: () => ['ref'],
    render() {
      const pats = S.all('patients').filter((p) => S.where('encounters', (e) => e.patientId === p.id).length);
      let pid = ms('pid', (S.where('refs', (r) => r.dir === 'out' && r.status !== '회송 완료' && r.pid)[0] || {}).pid || pats[0].id); if (!H.pat(pid)) pid = pats[0].id; const p = H.pat(pid); const i = E().info(p);
      const draft = refs((r) => r.pid === pid && r.dir === 'out' && !['전송 완료', '회송 완료'].includes(r.status))[0] || null; const f = (draft && draft.form) || {};
      const consent = p.refConsent && p.refConsent.status === '동의';
      const encs = S.where('encounters', (e) => e.patientId === pid).sort((a, b) => b.at - a.at); const e0 = encs[0];
      const dxs = []; encs.forEach((e) => (e.dx || []).forEach((d) => { if (!dxs.some((x) => x.code === d.code)) dxs.push(Object.assign({ at: e.at, dept: e.dept }, d)); }));
      const os = S.where('orders', (o) => o.patientId === pid && !H.flow.isOff(o)).sort((a, b) => b.at - a.at); const ot = ms('ot', 'MED'); const bt = ms('bt', 'vs');
      const sel = (k) => (f.picked ? f.picked.includes(k) : true);
      const vs = H.lastVs(pid) || {};
      const bottom = { vac: E().fields([{ l: '접종일자', txt: '-' }, { l: '예방접종명', txt: '인플루엔자 (가상 기록)' }, { l: '백신명', txt: '-' }, { l: '접종차수', txt: '1' }]), vs: E().fields([{ l: '측정', txt: vs.at ? T.mdhm(vs.at) : '-' }, { l: '혈압', txt: vs.sbp ? `${vs.sbp}/${vs.dbp}` : '-' }, { l: '맥박', txt: vs.hr || '-' }, { l: '호흡', txt: vs.rr || '-' }, { l: '체온', txt: vs.bt || '-' }, { l: '산소포화도', txt: vs.spo2 || '-' }]),
        smoke: E().fields([{ l: '흡연', txt: /흡연/.test(p.hx || '') ? '흡연 (기록 참조)' : '비흡연' }, { l: '음주', txt: '-' }]), inf: E().fields([{ l: '법정감염병', txt: p.flags && p.flags.isolation ? p.flags.isolation : '없음', w: 2 }]),
        bg: E().fields([{ l: '혈액형', txt: p.blood || '-' }, { l: '최근 혈당', txt: (H.flow.lastLab(pid, 'Glu') || { v: '-' }).v }]), rad: E().grid([{ h: '촬영일' }, { h: '검사' }, { h: '판독 결론' }], os.filter((o) => o.cat === 'RAD' && o.result).map((o) => [T.d(o.shotAt || o.at), esc(o.name), esc(o.result.impression)]), { h: '8rem', empty: '판독 결과 없음' }) }[bt];
      return `<form data-submit="cs.save" class="erp"><input type="hidden" name="pid" value="${pid}"><input type="hidden" name="rid" value="${draft ? draft.id : ''}">
        ${E().bar([{ l: '동의서 조회', act: 'cs.consentView', data: { pid } }, { l: consent ? '동의 철회서 작성' : '동의서 작성', act: 'cs.consent', data: { pid } }, { l: '송/수신 문서 조회', act: 'cs.list' }, { l: `미전송 문서 (${refs((r) => r.dir === 'out' && r.status === '작성').length})`, act: 'cs.unsent' }, '|', `환자 <select data-chg="cs.pid" aria-label="환자">${pats.map((x) => `<option value="${x.id}" ${x.id === pid ? 'selected' : ''}>${esc(x.name)} (${x.mrn})</option>`).join('')}</select>`])}
        <div class="erp-cols3" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)">
          <div>${sec(`환자정보 [${consent ? '동의서 작성' : '동의서 미작성'}]`)}${E().fields([{ l: '수진자명', txt: p.name, t: 'key' }, { l: '나이', txt: `${H.age(p.birth)}세 ${p.sex === 'M' ? '남' : '여'}` }, { l: '주민번호', txt: i.rrn }, { l: '생년월일', txt: p.birth }, { l: '연락처', txt: p.phone || '-' }, { l: '동의상태', txt: consent ? `동의 (${T.d(p.refConsent.at)})` : '미작성', t: consent ? 'calc' : 'warn' }, { l: '주소', txt: p.address || '-', w: 'full' }], { cols: '12rem' })}</div>
          <div>${sec('전송정보')}${E().fields([{ l: '문서', w: 'full', html: radio('docType', ['진료의뢰서', '진료회송서', '진료회신서', '진료요약지'], f.docType || (draft && draft.docType) || '진료회송서') }, { l: '진료과', txt: e0 ? e0.dept : '-' }, { l: '진료의사', txt: e0 ? doc(e0.doctorId) : '-' }, { l: '면허번호', txt: e0 ? `제 ${String(e0.doctorId.replace(/\D/g, '') * 7919).padStart(5, '0')} 호` : '-' }, { l: '연락처', txt: '02-000-0000 (진료협력센터)' }], { cols: '12rem' })}</div>
          <div>${sec('수신 의료기관정보')}${E().fields([{ l: '수신병원', n: 'to', v: f.to || (draft && draft.to) || PARTNERS[2], opts: PARTNERS, t: 'req', w: 'full' }, { l: '기관기호', txt: ORGNO(f.to || (draft && draft.to) || PARTNERS[2]) }, { l: '진료과', n: 'toDept', v: f.toDept || (e0 ? e0.dept : ''), opts: [...new Set(H.M.DOCTORS.map((x) => x.dept))].concat(['가정의학과']) }, { l: '진료의사', n: 'toDoc', v: f.toDoc || '' }], { cols: '12rem' })}</div></div>
        <div class="erp-cols" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)"><div class="gap-s">
          ${sec('상병정보')}${E().grid([{ h: 'V' }, { h: '상병코드' }, { h: '상병명' }, { h: '진료일자' }, { h: '진료과' }], dxs.map((d) => [ck('pk_dx_' + d.code, sel('dx_' + d.code)), `<span class="mono">${esc(d.code)}</span>`, esc(d.name), T.d(d.at), esc(d.dept)]), { h: '8rem', empty: '상병이 없습니다' })}
          ${E().tabs('cs.ot', OTABS.map((x) => [x[0], x[1]]), ot)}
          ${ot === 'ALG' ? E().grid([{ h: '알레르기' }, { h: '분류' }, { h: '반응' }], (p.allergies || []).map((a) => [esc(a.name), esc(a.cls || ''), esc(a.reaction || '-')]), { h: '12rem', empty: '알려진 알레르기 없음' })
            : E().grid([{ h: 'V' }, { h: '처방일자' }, { h: '처방명' }, { h: '처방코드' }, { h: '용량' }, { h: '횟수' }, { h: '결과' }], os.filter(OTABS.find((x) => x[0] === ot)[2]).map((o) => [ck('pk_or_' + o.id, sel('or_' + o.id)), T.d(o.at), esc(o.name), `<span class="mono">${esc(o.code)}</span>`, esc(o.dose != null ? `${o.dose}${o.unit || ''}` : ''), esc(o.freq || ''), o.result ? esc(o.result.impression || (o.result.items || []).filter((r) => r.flag).map((r) => `${r.n} ${r.v}`).join(', ') || '정상') : esc(o.status)]), { h: '12rem', empty: '해당 처방이 없습니다' })}
          ${E().tabs('cs.bt', [['vac', '예방접종내역'], ['vs', '생체신호상태'], ['smoke', '흡연음주상태'], ['inf', '법정감염병'], ['bg', '혈당/혈액형'], ['rad', '영상판독정보']], bt)}${bottom}</div>
          <div class="gap-s">${sec('예약정보')}${E().fields([{ l: '예약일자', n: 'apDate', v: f.apDate || '', type: 'date' }, { l: '예약시간', n: 'apTime', v: f.apTime || '', }, { l: '예약메모', n: 'apMemo', v: f.apMemo || '', w: 'full' }], { cols: '12rem' })}
            ${sec('소견 및 의뢰/회송사유')}${E().fields([{ l: '소견 및 주의사항', w: 'full', html: ta('opinion', f.opinion || (e0 ? `${(e0.dx || []).map((x) => x.name).join(', ')} 치료함. ${(p.allergies || []).length ? '알레르기: ' + p.allergies.map((a) => a.name).join(', ') : ''}` : ''), '4rem') }, { l: '의뢰·회송 사유', w: 'full', html: ta('why', f.why || (draft ? draft.reason : ''), '4rem') }, { l: '과거병력', w: 'full', html: ta('hx', f.hx || p.hx || '', '3rem') }])}
            ${sec('의뢰/회송정보 (심평원 연계정보)')}${E().fields([{ l: '의뢰상태구분', n: 'hState', v: f.hState || '외래', opts: ['외래', '입원', '응급'] }, { l: '의뢰세부사유', n: 'hWhy', v: f.hWhy || '진단의뢰', opts: ['진단의뢰', '검사의뢰', '수술의뢰', '시술 및 약물치료 의뢰', '경과관찰 (회송)', '기타'] }, { l: '의뢰사유', w: 'full', html: radio('hBy', ['의사판단', '환자요청'], f.hBy || '의사판단') }], { cols: '12rem' })}
            ${sec('첨부파일')}<div class="box small">${(f.files || []).map((x) => `📎 ${esc(x)}`).join('<br>') || '첨부 없음'} <div class="row" style="margin-top:.3rem">${UI.btn('추가 (검사결과지)', 'cs.file', { size: 'sm', data: { pid } })}<span class="muted">10개 이하, 총 100MB 이하</span></div></div>
            <div class="btn-row end">${UI.btn('문서보기', 'cs.view', { data: { pid } })}${UI.btn('문서작성 (저장)', '', { type: 'submit' })}${UI.btn('전송', 'cs.send', { kind: 'pri', data: { pid } })}</div></div></div></form>`;
    },
    acts: {
      'cs.pid': (el) => { set('pid', el.value); A.render(); }, 'cs.ot': (el) => { set('ot', el.dataset.v); A.render(); }, 'cs.bt': (el) => { set('bt', el.dataset.v); A.render(); },
      'cs.consent': (el) => { const p = H.pat(el.dataset.pid); const on = p.refConsent && p.refConsent.status === '동의'; p.refConsent = { status: on ? '철회' : '동의', at: Date.now(), by: H.who() }; S.save(); UI.toast(on ? '정보제공 동의 철회 — 진료정보를 보낼 수 없습니다' : '진료정보 제공 동의서 작성 (환자 서명)', on ? 'warn' : 'ok'); A.render(); },
      'cs.consentView': (el) => { const p = H.pat(el.dataset.pid); UI.modal({ title: '진료정보 제공 동의서', size: 'narrow', body: UI.note(p.refConsent ? `${p.refConsent.status} — ${T.mdhm(p.refConsent.at)} (${esc(p.refConsent.by)})` : '작성된 동의서가 없습니다. 개인정보 보호법상 다른 의료기관에 진료정보를 보내려면 환자 동의가 필요합니다.', p.refConsent ? 'info' : 'warn') }); },
      'cs.list': () => { A.open('cr-transfer'); A.st['cr-transfer'] = Object.assign(A.st['cr-transfer'] || {}, { tab: 'list' }); A.render(); },
      'cs.unsent': () => { const l = refs((r) => r.dir === 'out' && r.status === '작성'); UI.modal({ title: '미전송 문서', size: 'wide', body: E().grid([{ h: '작성일' }, { h: '환자' }, { h: '문서' }, { h: '수신기관' }], l.map((r) => [T.mdhm(r.at), esc(r.pname), esc(r.docType || '-'), esc(r.to || '-')]), { empty: '미전송 문서가 없습니다' }) }); },
      'cs.file': (el) => { const f = el.closest('form'); const d = H.formData(f); const r = saveDoc(d); r.form.files = (r.form.files || []).concat([`검사결과지_${T.d(Date.now())}_${(r.form.files || []).length + 1}.pdf`]); S.save(); A.render(); },
      'cs.save': (f, d) => { saveDoc(d); UI.toast('문서 작성 (미전송) — 전송을 누르면 보냅니다', 'ok'); A.render(); },
      'cs.view': (el) => { const d = H.formData(el.closest('form')); const r = saveDoc(d); A.render(); UI.modal({ title: r.docType, size: 'wide', body: paper(r) }); },
      'cs.send': (el) => { const d = H.formData(el.closest('form')); const p = H.pat(d.pid); if (!(p.refConsent && p.refConsent.status === '동의')) return UI.toast('환자의 진료정보 제공 동의서가 없습니다 — "동의서 작성"을 먼저 하세요', 'err'); if (!d.why) return UI.toast('의뢰·회송 사유를 써 주세요', 'warn');
        const r = saveDoc(d); r.status = r.docType === '진료회송서' ? '회송 완료' : '전송 완료'; r.ediNo = ediNo(); r.sentAt = Date.now(); r.reply = r.reply || d.why; S.save();
        if (d.apDate) S.add('recs', { id: H.uid('rc'), kind: 'sms', patientId: p.id, at: Date.now(), by: H.who(), to: `${p.name} ${p.phone || ''}`, text: `[SSV병원] ${p.name}님, ${r.to} ${d.apDate} ${d.apTime || ''} 진료가 예약되었습니다. 진료의뢰·회송서는 전자로 전달했습니다.` });
        H.log(`${r.docType} 전송`, `${p.name} → ${r.to}`, p.id); UI.toast(`${r.docType} 전송 — 중계시스템 번호 ${r.ediNo}`, 'ok'); A.render(); },
    },
  });
  function saveDoc(d) {
    const p = H.pat(d.pid); const e0 = S.where('encounters', (e) => e.patientId === p.id).sort((a, b) => b.at - a.at)[0];
    let r = d.rid ? S.get('refs', d.rid) : null;
    if (!r) r = refs((x) => x.pid === p.id && x.dir === 'out' && !['전송 완료', '회송 완료'].includes(x.status))[0];
    if (!r) r = S.add('refs', { id: H.uid('rf'), dir: 'out', pid: p.id, pname: p.name, dept: e0 ? e0.dept : '', status: '작성', at: Date.now(), by: H.who() });
    const picked = Object.keys(d).filter((k) => k.startsWith('pk_') && d[k]).map((k) => k.slice(3));
    r.form = Object.assign(r.form || {}, { docType: d.docType, to: d.to, toDept: d.toDept, toDoc: d.toDoc, apDate: d.apDate, apTime: d.apTime, apMemo: d.apMemo, opinion: d.opinion, why: d.why, hx: d.hx, hState: d.hState, hWhy: d.hWhy, hBy: d.hBy, picked });
    Object.assign(r, { docType: d.docType, to: d.to, reason: d.why || r.reason || '', doctorId: e0 ? e0.doctorId : '' }); if (r.status === '회송서 작성 대기') r.status = '작성'; S.save(); return r;
  }
  function paper(r) {
    const p = patOf(r); const f = r.form || {}; const os = (f.picked || []).filter((k) => k.startsWith('or_')).map((k) => S.get('orders', k.slice(3))).filter(Boolean); const dx = (f.picked || []).filter((k) => k.startsWith('dx_')).map((k) => k.slice(3));
    return `<div class="box gap-s" style="background:var(--surface)"><h3 style="text-align:center;letter-spacing:.4em">${esc(r.docType || '진료의뢰서')}</h3>
      ${E().fields([{ l: '보내는 기관', txt: 'SSV 병원 (상급종합, 가상)' }, { l: '받는 기관', txt: `${r.to || '-'} ${f.toDept || ''}` }, { l: '환자', txt: p ? `${p.name} (${p.birth}, ${p.mrn})` : r.pname }, { l: '상병', txt: dx.join(', ') || '-', w: 2 }, { l: '사유', txt: f.why || r.reason || '-', w: 'full' }, { l: '소견', txt: f.opinion || '-', w: 'full' }, { l: '과거병력', txt: f.hx || '-', w: 'full' }, { l: '예약', txt: f.apDate ? `${f.apDate} ${f.apTime || ''} ${f.apMemo || ''}` : '-' }, { l: '중계번호', txt: r.ediNo || '미전송' }])}
      ${os.length ? E().grid([{ h: '처방일' }, { h: '처방' }, { h: '결과' }], os.map((o) => [T.d(o.at), esc(o.name), o.result ? esc(o.result.impression || (o.result.items || []).map((x) => `${x.n} ${x.v}`).join(', ')) : '-']), { h: '14rem' }) : ''}</div>`;
  }

  // ═════════ 전원환자 관리 ═════════
  const FORMS = { '80': '진료의뢰서', '97': '요양급여회송서', '98': '요양급여의뢰서', '81': '의료급여의뢰서', '00': '진료회신서' };
  const typeOf = (r) => (r.dir === 'in' ? (r.reply ? '회신' : '수신') : r.docType === '진료회송서' || /회송/.test(r.status) ? '회송' : '의뢰');
  function govForm(code, r) {
    const p = patOf(r); const i = p ? E().info(p) : {}; const f = (r.forms || {})[code] || {}; const e = p && lastEnc(p); const back = code === '97'; const reply = code === '00';
    const os = p ? S.where('orders', (o) => o.patientId === p.id && o.result).slice(-8) : [];
    return `<form data-submit="tr.save" class="gap-s"><input type="hidden" name="id" value="${r.id}"><input type="hidden" name="code" value="${code}">
      <h3 style="text-align:center;letter-spacing:.3em">${FORMS[code]}</h3>
      ${sec('A. 환자 정보')}${E().fields([{ l: '의뢰회송번호', txt: r.ediNo || '(전송 시 부여)', t: 'key', w: 2 }, { l: '의뢰회송구분', txt: back ? '회송' : reply ? '회신' : '의뢰' }, { l: '정보제공동의', txt: p && p.refConsent && p.refConsent.status === '동의' ? '동의' : '미동의', t: p && p.refConsent && p.refConsent.status === '동의' ? 'calc' : 'warn' },
        { l: '등록번호', txt: p ? p.mrn : '-' }, { l: '보험유형', txt: p ? p.ins : '-', t: code === '81' ? 'warn' : '' }, { l: '건강보험증번호', txt: i.insNo || '-' }, { l: '세대주성명', n: 'holder', v: f.holder || i.holder || '' },
        { l: '성명', txt: r.pname, t: 'req' }, { l: '주민등록번호', txt: i.rrn || '-' }, { l: '핸드폰번호', txt: p ? p.phone || '-' : '-' }, { l: '보호자번호', txt: i.tel2 || '-' }, { l: '주소', txt: p ? p.address || '-' : '-', w: 'full' }])}
      ${sec(back ? 'B. 회송 기본정보' : reply ? 'B. 회신 기본정보' : 'B. 의뢰 기본정보')}${E().fields([{ l: back ? '회송받을 요양기관' : reply ? '회신받을 요양기관' : '의뢰받을 요양기관', n: 'to', v: f.to || r.to || r.from || PARTNERS[0], opts: PARTNERS.concat(r.from && !PARTNERS.includes(r.from) ? [r.from] : []), t: 'req', w: 2 }, { l: '진료과', n: 'toDept', v: f.toDept || r.dept || '' },
        ...(back ? [{ l: '회송 사유', w: 'full', html: `<span class="row" style="gap:.6rem">${['급성기 치료 종료', '경과관찰', '만성질환 관리', '재활', '환자 요청'].map((t) => ck('why_' + t, (f.why || ['급성기 치료 종료']).includes(t), t)).join('')}</span>` }]
          : reply ? [{ l: '회신 내용', w: 'full', html: ta('replyText', f.replyText || r.reply || '', '4rem') }]
            : [{ l: '의뢰 기관유형', w: 'full', html: radio('orgType', ['회송환자 재의뢰 (패스트트랙)', '타기관 의뢰'], f.orgType || '타기관 의뢰') }, { l: '의뢰사유', w: 2, html: radio('by', ['의사판단', '환자요청'], f.by || '의사판단') },
              { l: '의뢰 세부사유', w: 'full', html: `<span class="row" style="gap:.6rem">${['진단의뢰', '검사의뢰', '수술의뢰', '시술 및 약물치료 의뢰', '기타'].map((t) => ck('why_' + t, (f.why || []).includes(t), t)).join('')}</span>` },
              { l: '긴급진료 필요', html: ck('urgent', f.urgent || r.urgency === '응급 전원', '필요') }, { l: '긴급진료 사유', n: 'urgWhy', v: f.urgWhy || '', w: 2 }]),
        ...(code === '81' ? [{ l: '의료급여 종별', n: 'mcType', v: f.mcType || '1종', opts: ['1종', '2종'] }, { l: '1차 의료급여기관 확인', html: ck('mc1', f.mc1, '확인') }] : []),
        { l: '의심되는 상병분류기호', n: 'sxCode', v: f.sxCode || ((e && e.dx && e.dx[0]) || {}).code || '' }, { l: '의심되는 상병명', n: 'sxName', v: f.sxName || ((e && e.dx && e.dx[0]) || {}).name || '', w: 2 }, { l: '주호소', n: 'cc', v: f.cc || (e && e.cc) || r.reason || '', w: 'full' }])}
      ${sec('C. 환자상태 및 진료소견')}${E().fields([{ l: '상병분류기호', txt: (e && e.dx || []).map((d) => d.code).join(', ') || '-' }, { l: '상병명', txt: (e && e.dx || []).map((d) => d.name).join(', ') || '-', w: 2 }, { l: '진료과', txt: e ? e.dept : '-' }, { l: '세부진료과목', n: 'subDept', v: f.subDept || '' }, { l: '진료소견', w: 'full', html: ta('opinion', f.opinion || (r.form || {}).opinion || '', '3.5rem') }])}
      ${sec('D. 진료정보')}${E().grid([{ h: 'V' }, { h: '서식명' }, { h: '내용' }, { h: '일자' }], os.map((o) => [ck('d_' + o.id, (f.d || []).includes(o.id)), esc((H.M.CAT[o.cat] || {}).l || o.cat), esc(o.name), T.d(o.at)]), { h: '9rem', empty: '결과가 있는 진료정보가 없습니다' })}
      ${sec('E. 영상정보')}${E().grid([{ h: '검사' }, { h: '판독' }, { h: '' }], os.filter((o) => o.cat === 'RAD').map((o) => [esc(o.name), esc((o.result || {}).impression || '-'), `<button type="button" class="btn sm" data-act="pacs.open" data-id="${o.id}">PACS 영상보기</button>`]), { h: '7rem', empty: '영상 없음' })}
      <div class="btn-row end">${UI.btn('작성내용 저장', '', { type: 'submit' })}${UI.btn('의뢰/회송서 전송', 'tr.send', { kind: 'pri', data: { id: r.id, code } })}</div></form>`;
  }
  function trList() {
    const io = ms('io', '수신'); const st = ms('lst', '1:접수전');
    const l = refs((r) => (io === '수신' ? r.dir === 'in' : r.dir === 'out' && r.sentAt)).filter((r) => st === '0:전체' || (st === '1:접수전' ? (io === '수신' ? r.status === '접수 대기' : !r.recvOk) : (io === '수신' ? r.status !== '접수 대기' : r.recvOk)));
    const cur = l.find((r) => r.id === ms('lsel', '')) || l[0]; const p = cur && patOf(cur); const bt = ms('lbt', 'sum');
    const ns = p ? S.where('notes', (n) => n.patientId === p.id) : []; const os = p ? S.where('orders', (o) => o.patientId === p.id && o.result) : [];
    const bottom = !cur ? '' : { sum: ns.filter((n) => n.type === '퇴원요약').map((n) => `<div class="small" style="white-space:pre-wrap">${esc(Object.values(n.content || {}).join('\n'))}</div>`).join('') || '퇴원요약지 없음', opd: ns.filter((n) => ['초진기록', '경과기록', '입원기록'].includes(n.type)).map((n) => `<div class="small">${T.d(n.at)} ${esc(n.type)}: ${esc(Object.values(n.content || {}).join(' / ').slice(0, 160))}</div>`).join('') || '기록 없음',
      lab: E().grid([{ h: '일자' }, { h: '검사' }, { h: '결과' }], os.filter((o) => o.cat === 'LAB').map((o) => [T.d(o.result.at), esc(o.name), esc(o.result.items.map((x) => `${x.n} ${x.v}`).join(', '))]), { h: '9rem', empty: '없음' }), etc: `의뢰 사유: ${esc(cur.reason || '-')}<br>${cur.reply ? `회신: ${esc(cur.reply)}` : ''}`,
      dicom: `<div class="row">${UI.btn('전체 다운로드 (가상)', 'tr.dl', { size: 'sm' })}${os.filter((o) => o.cat === 'RAD').map((o) => `<button type="button" class="btn sm" data-act="pacs.open" data-id="${o.id}">PACS ${esc(o.name)}</button>`).join('')}</div>`, non: '사진·스캔 파일 없음', appt: S.where('appts', (a) => p && a.pid === p.id).map((a) => `${a.date} ${a.time} ${esc(a.dept)} ${esc(a.status)}`).join('<br>') || '예약 없음' }[bt];
    return `<div class="gap-s"><div class="row">${radio('x', ['수신', '송신'], io).replace(/name="x"/g, 'name="x" data-chg="tr.io"')}<select data-chg="tr.lst" aria-label="접수 상태">${['1:접수전', '2:접수완료', '0:전체'].map((x) => `<option ${x === st ? 'selected' : ''}>${x}</option>`).join('')}</select>${UI.btn('조회', 'tr.q', { size: 'sm' })}${UI.btn('접수처리', 'tr.recv', { size: 'sm', kind: 'pri', data: { id: cur ? cur.id : '' } })}${UI.btn('출력 (보기)', 'tr.view', { size: 'sm', data: { id: cur ? cur.id : '' } })}</div>
      ${E().grid([{ h: 'No' }, { h: '보기' }, { h: '회신서' }, { h: '만족도' }, { h: '구분' }, { h: '의뢰회송번호' }, { h: '작성일자' }, { h: '환자명' }, { h: '성별' }, { h: '생년월일' }, { h: '전화번호' }, { h: '기관기호' }, { h: io === '수신' ? '송신기관' : '수신기관' }], l.map((r, k) => { const pp = patOf(r); return { cells: [k + 1, '📄', r.reply ? '있음' : '', r.sat || '', typeOf(r), r.ediNo || `R${T.d(r.at).replace(/-/g, '')}${String(k + 1).padStart(3, '0')}`, T.d(r.at), esc(r.pname), r.psex ? (r.psex === 'F' ? '여' : '남') : pp ? (pp.sex === 'F' ? '여' : '남') : '', pp ? pp.birth : '-', pp ? pp.phone || '-' : '-', ORGNO(r.from || r.to || ''), esc(r.from || r.to || '')], on: cur && r.id === cur.id, act: 'tr.lsel', data: { id: r.id } }; }), { h: '14rem', empty: '문서가 없습니다' })}
      ${cur ? `${E().tabs('tr.lbt', [['sum', '퇴원요약지'], ['opd', '외래초진/경과기록지'], ['lab', '검사결과지'], ['etc', '기타 진료정보'], ['dicom', '영상정보 DICOM'], ['non', '영상정보 Non-DICOM'], ['appt', '진료예약정보']], bt)}<div class="box">${bottom}</div>` : ''}</div>`;
  }
  H.reg({
    id: 'cr-transfer', title: '전원환자 관리', actor: '진료협력센터 간호사', layout: 'full', channels: () => ['ref'],
    render() {
      const from = ms('from', T.d(Date.now() - 30 * DAY)); const withReply = ms('wr', true);
      const list = refs((r) => T.d(r.at) >= from && (withReply || !r.reply));
      const cur = list.find((r) => r.id === ms('sel', '')) || list[0]; const tab = ms('tab', cur ? (cur.dir === 'in' ? '00' : cur.docType === '진료회송서' || /회송/.test(cur.status) ? '97' : '98') : 'list');
      return `<div class="erp">${E().bar([`☑ 일자기준 조회일자 <input type="date" value="${from}" data-chg="tr.from" aria-label="조회 시작일">`, { l: '전원의뢰조회', act: 'tr.q' }, { l: '의뢰서변경', act: 'tr.chg', data: { id: cur ? cur.id : '' } }, '|', { l: 'EMR조회', act: 'tr.emr', data: { id: cur ? cur.id : '' } }, { l: '협진회신', act: 'tr.toReply', data: { id: cur ? cur.id : '' } }, { l: '바코드스캔', act: 'tr.scan' }, '|', { l: '작성내용 저장', act: 'tr.saveBtn' }, { l: '의뢰/회송서 전송', act: 'tr.sendBtn', kind: 'pri' }])}
        <div class="erp-cols3" style="grid-template-columns:minmax(0,22rem) minmax(0,1fr)"><div class="gap-s">
          <div class="row between"><b class="small">의뢰/회송 대상</b><label class="row small" style="gap:.2rem"><input type="checkbox" data-chg="tr.wr" ${withReply ? 'checked' : ''}>회신서 포함</label></div>
          ${E().grid([{ h: 'No.' }, { h: '유형' }, { h: '등록번호' }, { h: '환자명' }, { h: '상태' }, { h: '서식' }, { h: '의뢰일' }, { h: '보험유형' }], list.map((r, k) => { const pp = patOf(r); return { cells: [k + 1, typeOf(r), pp ? pp.mrn : '-', esc(r.pname), esc(r.status), esc(r.docType || (r.dir === 'in' ? '진료의뢰서' : '-')), T.d(r.at), pp ? esc(pp.ins) : '-'], on: cur && r.id === cur.id, act: 'tr.sel', data: { id: r.id } }; }), { h: '24rem' })}
          ${cur ? `<form data-submit="tr.memo" class="gap-s"><input type="hidden" name="id" value="${cur.id}"><b class="small">공유 사항</b>${ta('share', cur.share, '4rem', '공유 사항')}<b class="small">기타 전달사항</b>${ta('note', cur.note, '4rem', '기타 전달사항')}${UI.btn('메모 저장', '', { type: 'submit', size: 'sm' })}</form>` : ''}</div>
          <div class="gap-s">${E().tabs('tr.tab', Object.entries(FORMS).map(([c, n]) => [c, `${c}.${n}`]).concat([['list', '송·수신목록']]), tab)}
            ${tab === 'list' ? trList() : cur ? govForm(tab, cur) : UI.empty('대상을 고르세요')}</div></div></div>`;
    },
    acts: {
      'tr.sel': (el) => { set('sel', el.dataset.id); set('tab', undefined); A.render(); }, 'tr.tab': (el) => { set('tab', el.dataset.v); A.render(); }, 'tr.from': (el) => { set('from', el.value); A.render(); }, 'tr.wr': (el) => { set('wr', el.checked); A.render(); }, 'tr.q': () => A.render(),
      'tr.io': (el) => { set('io', el.value); set('lsel', ''); A.render(); }, 'tr.lst': (el) => { set('lst', el.value); A.render(); }, 'tr.lsel': (el) => { set('lsel', el.dataset.id); A.render(); }, 'tr.lbt': (el) => { set('lbt', el.dataset.v); A.render(); },
      'tr.memo': (f, d) => { const r = S.get('refs', d.id); r.share = d.share; r.note = d.note; S.save(); UI.toast('메모 저장', 'ok'); },
      'tr.saveBtn': () => { const f = document.querySelector('form[data-submit="tr.save"]'); if (f) f.requestSubmit(); else UI.toast('서식 탭을 여세요', 'warn'); },
      'tr.sendBtn': () => { const b = document.querySelector('[data-act="tr.send"]'); if (b) b.click(); else UI.toast('서식 탭을 여세요', 'warn'); },
      'tr.save': (f, d) => { saveGov(d); UI.toast(`${FORMS[d.code]} 저장`, 'ok'); A.render(); },
      'tr.send': (el) => { const f = el.closest('form'); const d = H.formData(f); const r = saveGov(d); const p = patOf(r);
        if (!p || !(p.refConsent && p.refConsent.status === '동의')) return UI.toast('환자 정보제공 동의가 없습니다 — 진료의뢰·회송서 작성 화면에서 동의서를 받으세요', 'err');
        r.ediNo = r.ediNo || ediNo(); r.sentAt = Date.now(); r.docType = FORMS[d.code];
        if (d.code === '97') r.status = '회송 완료'; else if (d.code === '00') { r.reply = d.replyText || r.reply; r.replySent = Date.now(); r.replyEdi = r.ediNo; r.status = '회신 발송'; } else r.status = '전송 완료';
        r.to = r.dir === 'in' ? r.to : d.to; S.save(); H.log(`${FORMS[d.code]} 전송`, `${r.pname} → ${d.to}`, p.id); UI.toast(`심평원 진료의뢰회송 중계시스템 전송 — ${r.ediNo}`, 'ok'); A.render(); },
      'tr.recv': (el) => { const r = S.get('refs', el.dataset.id); if (!r) return; if (r.dir === 'in') { if (r.status !== '접수 대기') return UI.toast('이미 접수했습니다', 'info'); r.status = '접수'; r.recvAt = Date.now(); S.save(); H.notify('ref', `의뢰 접수: ${r.pname} (${r.dept}) — 진료협력센터에서 예약을 잡으세요`, {}); UI.toast('접수처리 — 진료협력(의뢰·회송) 화면에서 예약을 잡습니다', 'ok'); }
        else { r.recvOk = Date.now(); r.sat = r.sat || '만족'; S.save(); UI.toast('수신 기관 접수 확인 (가상)', 'ok'); } A.render(); },
      'tr.view': (el) => { const r = S.get('refs', el.dataset.id); if (r) UI.modal({ title: r.docType || '진료의뢰서', size: 'wide', body: paper(r) }); },
      'tr.chg': (el) => { if (!el.dataset.id) return; const r = S.get('refs', el.dataset.id); if (r.pid) { A.open('cr-send'); A.st['cr-send'] = Object.assign(A.st['cr-send'] || {}, { pid: r.pid }); A.render(); } else UI.toast('등록되지 않은 환자입니다 — 접수 후 변경하세요', 'warn'); },
      'tr.emr': (el) => H.mods['cr-reply'].acts['rp.emr'](el),
      'tr.toReply': (el) => { A.open('cr-reply'); A.st['cr-reply'] = Object.assign(A.st['cr-reply'] || {}, { sel: el.dataset.id }); A.render(); },
      'tr.scan': () => UI.toast('바코드 스캔 (가상): 종이 의뢰서의 바코드를 읽어 의뢰회송번호로 찾습니다', 'info'),
      'tr.dl': () => UI.toast('영상 내려받기는 실습에서 표시만 합니다 — PACS 영상보기를 누르세요', 'info'),
    },
  });
  function saveGov(d) {
    const r = S.get('refs', d.id); r.forms = r.forms || {};
    const x = Object.assign({}, d); delete x.id; delete x.code; x.why = Object.keys(d).filter((k) => k.startsWith('why_') && d[k]).map((k) => k.slice(4)); x.d = Object.keys(d).filter((k) => k.startsWith('d_') && d[k]).map((k) => k.slice(2)); x.urgent = !!d.urgent; x.mc1 = !!d.mc1;
    r.forms[d.code] = x; if (d.to && r.dir === 'out') r.to = d.to; S.save(); return r;
  }
})();
