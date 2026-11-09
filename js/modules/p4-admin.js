// 4단계 행정·관리: 구매·재고, 진료협력센터, 예약센터, 질향상·환자안전, 간호행정·교육·보건
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const DAY = 86400000;
  const pick = (name, opts, v) => UI.pick(name, opts.map((o) => (typeof o === 'object' ? o : { v: o, l: o })), v);
  const checks = (name, list, on = []) => `<div class="gap-s">${list.map((t) => UI.check(name, t, on.includes(t), { multi: true, value: t })).join('')}</div>`;
  const tabsOf = (act, list, def) => { const tab = A.ms('tab', def); return { tab, html: UI.tabs(act, list, tab) }; };
  const won = (n) => H.won(n);

  // ───────── 구매·재고 ─────────
  const stock = () => S.where('items', (i) => i.kind === 'stock');
  H.reg({
    id: 'supply', title: '구매·재고 (물류)', actor: '물류 담당', layout: 'full', channels: () => ['supply'],
    render() {
      const { tab, html } = tabsOf('sp.tab', [{ id: 'stock', label: '재고 현황', icon: 'list' }, { id: 'req', label: '병동 청구·불출', icon: 'send', cnt: S.where('items', (i) => i.kind === 'req' && i.status === '청구').length || '' }, { id: 'po', label: '발주·검수', icon: 'building' }, { id: 'exp', label: '유효기간', icon: 'clock' }], 'stock');
      let body;
      if (tab === 'stock') { const low = stock().filter((s) => s.qty < s.safe); body = `${low.length ? UI.note(`안전 재고 아래 품목 ${low.length}개 — 발주가 필요합니다: ${low.map((s) => esc(s.name)).join(', ')}`, 'warn') : ''}
        ${UI.table([{ h: '품목' }, { h: '분류' }, { h: '현재고', cls: 'num' }, { h: '안전 재고', cls: 'num' }, { h: '단가', cls: 'num' }, { h: '유효기간' }, { h: '' }], stock().map((s) => [`<b>${esc(s.name)}</b>`, esc(s.cat), s.qty < s.safe ? `<span class="hl-c">${s.qty}</span> ${esc(s.unit)}` : `<span class="num">${s.qty}</span> ${esc(s.unit)}`, `<span class="num">${s.safe}</span>`, `<span class="num">${won(s.price)}</span>`, `<span class="num small">${T.d(s.expire)}</span>`, UI.btn('실사', 'sp.count', { size: 'sm', data: { id: s.id } })]))}`; }
      else if (tab === 'req') body = `${UI.note('병동은 필요한 물품을 전산으로 청구하고, 물류팀이 재고에서 꺼내 보냅니다(불출). 감염 보호구처럼 급한 것은 먼저 보냅니다.', 'info')}
        ${UI.table([{ h: '청구 시각' }, { h: '병동' }, { h: '품목' }, { h: '수량', cls: 'num' }, { h: '상태' }, { h: '' }], S.where('items', (i) => i.kind === 'req').sort((a, b) => b.at - a.at).map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, esc(r.ward), esc(r.item), `<span class="num">${r.qty}</span>`, UI.chip(r.status, r.status === '불출' ? 'done' : 'sent'), r.status === '청구' ? UI.btn('불출', 'sp.give', { size: 'sm', kind: 'pri', data: { id: r.id } }) : '']), { empty: UI.empty('청구가 없습니다') })}
        <form data-submit="sp.newReq" class="row box">${UI.select('ward', '병동 (청구하는 쪽)', ['7A', '8B', 'ICU', 'ER', 'LD', 'NB', '수술실'], '7A')}${UI.select('item', '품목', stock().map((s) => s.name), stock()[0] ? stock()[0].name : '')}${UI.input('qty', '수량', '10', { type: 'number' })}${UI.btn('병동 청구 넣기', '', { type: 'submit' })}</form>`;
      else if (tab === 'po') { const pos = S.where('items', (i) => i.kind === 'po').sort((a, b) => b.at - a.at); body = `<form data-submit="sp.po" class="row box">${UI.select('item', '품목', stock().map((s) => s.name), (stock().find((s) => s.qty < s.safe) || stock()[0] || {}).name)}${UI.input('qty', '발주 수량', '200', { type: 'number' })}${UI.select('vendor', '업체', ['가상메디칼', '가상헬스케어', '가상약품'], '가상메디칼')}${UI.btn('발주', '', { type: 'submit', kind: 'pri' })}</form>
        ${UI.table([{ h: '발주일' }, { h: '품목' }, { h: '수량', cls: 'num' }, { h: '업체' }, { h: '상태' }, { h: '' }], pos.map((o) => [`<span class="num small">${T.md(o.at)}</span>`, esc(o.item), `<span class="num">${o.qty}</span>`, esc(o.vendor), UI.chip(o.status, o.status === '입고' ? 'done' : 'prog'), o.status === '발주' ? UI.btn('검수·입고', 'sp.check', { size: 'sm', kind: 'pri', data: { id: o.id } }) : '']), { empty: UI.empty('발주가 없습니다') })}`; }
      else body = `${UI.note('유효기간이 지난 물품은 쓰지 않고 폐기·반품합니다. 먼저 들어온 것을 먼저 씁니다 (선입선출).', 'info')}${UI.table([{ h: '품목' }, { h: '로트' }, { h: '유효기간' }, { h: '남은 날' }, { h: '' }], stock().filter((s) => s.expire < Date.now() + 60 * DAY).map((s) => { const d = Math.ceil((s.expire - Date.now()) / DAY); return [esc(s.name), `<span class="mono small">${esc(s.lot)}</span>`, `<span class="num">${T.d(s.expire)}</span>`, d < 0 ? UI.chip('지남', 'stat') : UI.chip(`${d}일`, d < 30 ? 'prog' : 'plain'), UI.btn('반품·폐기', 'sp.dispose', { size: 'sm', kind: 'warn', data: { id: s.id } })]; }), { empty: UI.empty('60일 안에 만료되는 물품이 없습니다') })}`;
      return `<div class="panel">${html}<div class="panel-b gap-m">${body}</div></div>`;
    },
    acts: {
      'sp.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'sp.count': (el) => { const s = S.get('items', el.dataset.id); UI.modal({ title: `재고 실사 — ${s.name}`, size: 'narrow', body: `<form data-submit="sp.countGo" class="gap-m"><input type="hidden" name="id" value="${s.id}"><p style="margin:0">전산 재고 <b>${s.qty}</b>${esc(s.unit)}</p>${UI.input('qty', '실제 센 수량', s.qty, { type: 'number' })}<div class="btn-row end">${UI.btn('저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }); },
      'sp.countGo': (f, d) => { const s = S.get('items', d.id); const diff = Number(d.qty) - s.qty; s.qty = Number(d.qty); S.save(); UI.close(); UI.toast(diff ? `차이 ${diff > 0 ? '+' : ''}${diff} — 원인 확인 (분실·기록 누락)` : '전산과 실제가 같습니다', diff ? 'warn' : 'ok'); A.render(); },
      'sp.give': (el) => { const r = S.get('items', el.dataset.id); const s = stock().find((x) => x.name === r.item); if (!s || s.qty < r.qty) return UI.toast('재고가 부족합니다 — 발주하세요', 'err'); s.qty -= r.qty; r.status = '불출'; r.outAt = Date.now(); S.save(); H.notify('ward:' + r.ward, `물품 불출: ${r.item} ${r.qty}`, {}); UI.toast(`${r.ward}에 ${r.item} ${r.qty} 불출`, 'ok'); A.render(); },
      'sp.newReq': (f, d) => { S.add('items', { id: H.uid('it'), kind: 'req', ward: d.ward, item: d.item, qty: Number(d.qty) || 1, status: '청구', at: Date.now(), by: H.who() }); UI.toast('청구 등록', 'ok'); A.render(); },
      'sp.po': (f, d) => { S.add('items', { id: H.uid('it'), kind: 'po', item: d.item, qty: Number(d.qty) || 1, vendor: d.vendor, status: '발주', at: Date.now(), by: H.who() }); H.log('물품 발주', `${d.item} ${d.qty}`); UI.toast('발주서를 업체에 보냈습니다', 'ok'); A.render(); },
      'sp.check': (el) => { const o = S.get('items', el.dataset.id); UI.modal({ title: `검수 — ${o.item}`, size: 'narrow', body: `<form data-submit="sp.checkGo" class="gap-m"><input type="hidden" name="id" value="${o.id}">${checks('c', ['발주서와 품목·수량 일치', '유효기간 충분 (1년 이상)', '포장 손상 없음', '냉장 품목은 온도 유지 확인', '거래명세서 확인'])}${UI.input('qty', '실제 들어온 수량', o.qty, { type: 'number' })}<div class="btn-row end">${UI.btn('검수 완료 → 입고', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }); },
      'sp.checkGo': (f, d) => { if ((d.c || []).length < 4) return UI.toast('검수 항목을 확인하세요', 'warn'); const o = S.get('items', d.id); const s = stock().find((x) => x.name === o.item); s.qty += Number(d.qty); s.expire = Date.now() + 400 * DAY; o.status = '입고'; o.inAt = Date.now(); S.save(); UI.close(); UI.toast(`입고 — ${o.item} ${d.qty}`, 'ok'); A.render(); },
      'sp.dispose': (el) => { const s = S.get('items', el.dataset.id); H.log('물품 폐기', `${s.name} ${s.qty}`); s.qty = 0; s.expire = Date.now() + 400 * DAY; S.save(); UI.toast('반품·폐기 처리 — 재고 0, 발주 필요', 'warn'); A.render(); },
    },
  });

  // ───────── 진료협력센터 ─────────
  const PARTNERS = ['가상내과의원', '가상정형외과의원', '가상외과의원', '가상요양병원', '가상소아청소년과의원'];
  function refPaper(r) {
    return `<div class="paper"><h2>${r.dir === 'in' ? '진료 회신서' : '진료 회송서'}</h2><table><tr><th>환자</th><td>${esc(r.pname)}</td><th>${r.dir === 'in' ? '의뢰 기관' : '받는 기관'}</th><td>${esc(r.dir === 'in' ? r.from : r.to)}</td></tr>
      <tr><th>진료과</th><td>${esc(r.dept)}</td><th>작성일</th><td>${T.d(Date.now())}</td></tr><tr><th>${r.dir === 'in' ? '의뢰 내용' : '회송 사유'}</th><td colspan="3">${esc(r.reason)}</td></tr>
      <tr><th>진료 결과</th><td colspan="3" class="pre">${esc(r.reply || '')}</td></tr></table><p style="font-size:.85rem;margin-top:.8rem">귀 기관의 협력에 감사드립니다. — SSV 병원 진료협력센터 (교육용 가상 서류)</p></div>`;
  }
  H.reg({
    id: 'referral', title: '진료협력센터', actor: '진료협력 간호사', layout: 'full', channels: () => ['ref'],
    render() {
      const { tab, html } = tabsOf('rf.tab', [{ id: 'in', label: '의뢰 받기', icon: 'clip', cnt: S.where('refs', (r) => r.dir === 'in' && r.status === '접수 대기').length || '' }, { id: 'out', label: '회송 보내기', icon: 'send' }, { id: 'partner', label: '협력 병의원', icon: 'building' }, { id: 'stat', label: '통계 보고', icon: 'list' }], 'in');
      let body;
      if (tab === 'in') body = `${UI.note('진료의뢰: 동네 병의원에서 더 큰 진료가 필요한 환자를 보냅니다. 진료협력센터는 의뢰서를 받아 진료 예약을 잡고, 진료 후 의뢰한 의사에게 회신서를 보냅니다 (회신이 다음 협력의 바탕).', 'info')}
        ${S.where('refs', (r) => r.dir === 'in').sort((a, b) => a.at - b.at).map((r) => `<div class="box" style="background:var(--surface)${r.urgency === '응급 전원' && r.status === '접수 대기' ? ';border-color:var(--t-stat)' : ''}"><div class="row between"><div class="row">${UI.chip(r.urgency, r.urgency === '응급 전원' ? 'stat' : 'plain')}<b>${esc(r.pname)}</b> <span class="small muted">${r.psex === 'M' ? '남' : '여'}/${r.page}세 · ${esc(r.from)} → ${esc(r.dept)}</span></div>${UI.chip(r.status, r.status.includes('완료') ? 'done' : r.status === '접수 대기' ? 'sent' : 'prog')}</div>
          <p style="margin:.4rem 0">${esc(r.reason)}</p><div class="btn-row end">${r.status === '접수 대기' ? (r.urgency === '응급 전원' ? `${UI.btn('거절 (병상 없음)', 'rf.reject', { size: 'sm', data: { id: r.id } })}${UI.btn('전원 수용 → 응급실', 'rf.accept', { size: 'sm', kind: 'danger', data: { id: r.id } })}` : UI.btn('접수·진료 예약', 'rf.book', { size: 'sm', kind: 'pri', data: { id: r.id } })) : r.status === '예약 완료' ? UI.btn('진료 후 회신서 작성', 'rf.reply', { size: 'sm', kind: 'pri', data: { id: r.id } }) : r.reply ? UI.btn('회신서 보기', 'rf.view', { size: 'sm', data: { id: r.id } }) : ''}</div></div>`).join('') || UI.empty('의뢰가 없습니다')}`;
      else if (tab === 'out') { const outs = S.where('refs', (r) => r.dir === 'out'); const dis = S.where('encounters', (e) => e.type === 'IPD' && e.status === '퇴원'); body = `${UI.note('회송: 상급종합병원 치료가 끝나 안정된 환자를 집 가까운 병의원으로 보내 계속 진료받게 합니다 (회송료 수가 인정, 상급병원 쏠림 완화).', 'info')}
        ${outs.map((r) => `<div class="box" style="background:var(--surface)"><div class="row between"><b>${esc(r.pname)} → ${esc(r.to)}</b>${UI.chip(r.status, r.status === '회송 완료' ? 'done' : 'prog')}</div><p style="margin:.3rem 0">${esc(r.reason)}</p><div class="btn-row end">${r.status !== '회송 완료' ? UI.btn('회송서 작성', 'rf.out', { size: 'sm', kind: 'pri', data: { id: r.id } }) : UI.btn('회송서 보기', 'rf.view', { size: 'sm', data: { id: r.id } })}</div></div>`).join('')}
        <form data-submit="rf.newOut" class="row box">${UI.select('eid', '퇴원 환자', dis.map((e) => ({ v: e.id, l: `${H.pat(e.patientId).name} (${e.dept})` })), '')}${UI.select('to', '회송 기관', PARTNERS, PARTNERS[0])}${UI.btn('회송 대상 추가', '', { type: 'submit' })}</form>`; }
      else if (tab === 'partner') body = UI.table([{ h: '협력 병의원' }, { h: '의뢰 받음', cls: 'num' }, { h: '회송 보냄', cls: 'num' }, { h: '협약' }], PARTNERS.map((n) => [esc(n), `<span class="num">${S.where('refs', (r) => r.dir === 'in' && (r.from || '').startsWith(n)).length}</span>`, `<span class="num">${S.where('refs', (r) => r.dir === 'out' && (r.to || '').startsWith(n)).length}</span>`, UI.chip('협력 병원 협약', 'done')]));
      else { const ins = S.where('refs', (r) => r.dir === 'in'); const replied = ins.filter((r) => r.reply).length; body = `<div class="grid3"><div class="box"><div class="small muted">의뢰 받음</div><div class="score-big">${ins.length}건</div></div><div class="box"><div class="small muted">회신율</div><div class="score-big">${ins.length ? Math.round((replied / ins.length) * 100) : 0}%</div></div><div class="box"><div class="small muted">회송 보냄</div><div class="score-big">${S.where('refs', (r) => r.dir === 'out' && r.status === '회송 완료').length}건</div></div></div>${UI.note('월별 진료협력 실적은 병원 경영진과 보건복지부 진료협력 사업 평가에 보고합니다.', 'info')}`; }
      return `<div class="panel">${html}<div class="panel-b gap-m">${body}</div></div>`;
    },
    acts: {
      'rf.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'rf.book': (el) => { const r = S.get('refs', el.dataset.id); const docs = H.M.DOCTORS.filter((d) => d.dept === r.dept); UI.modal({ title: `진료 예약 — ${r.pname}`, size: 'narrow', body: `<form data-submit="rf.bookGo" class="gap-m"><input type="hidden" name="id" value="${r.id}">${UI.select('doc', '의사', (docs.length ? docs : H.M.DOCTORS).map((d) => ({ v: d.id, l: `${d.dept} ${d.name}` })), '')}${UI.input('date', '날짜', T.d(Date.now() + 3 * DAY), { type: 'date' })}${UI.input('time', '시각', '10:00')}<div class="btn-row end">${UI.btn('예약 → 환자·의뢰 기관에 안내', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }); },
      'rf.bookGo': (f, d) => {
        const r = S.get('refs', d.id); const doc = H.M.DOCTORS.find((x) => x.id === d.doc);
        let p = S.all('patients').find((x) => x.name === r.pname);
        if (!p) p = S.add('patients', { id: H.uid('pt'), mrn: S.nextMrn(), name: r.pname, sex: r.psex, birth: `${new Date().getFullYear() - r.page}-01-01`, blood: '모름', height: 165, weight: 60, ins: '건강보험', hx: `진료의뢰: ${r.reason}`, allergies: [], flags: {}, scenario: {} });
        S.add('appts', { id: H.uid('ap'), pid: p.id, dept: doc.dept, doctorId: doc.id, date: d.date, time: d.time, status: '예약', memo: `진료의뢰 (${r.from})`, at: Date.now(), by: H.who() }, true);
        r.status = '예약 완료'; r.pid = p.id; r.appt = `${d.date} ${d.time} ${doc.name}`; S.save(); UI.close(); UI.toast(`예약 ${d.date} ${d.time} — 의뢰 기관에 알림`, 'ok'); A.render();
      },
      'rf.accept': (el) => {
        const r = S.get('refs', el.dataset.id);
        const p = S.add('patients', { id: H.uid('pt'), mrn: S.nextMrn(), name: r.pname, sex: r.psex, birth: `${new Date().getFullYear() - r.page}-01-01`, blood: '모름', height: 152, weight: 45, ins: '건강보험', hx: `전원: ${r.reason}`, allergies: [], flags: {}, scenario: { labs: { WBC: 15.8, CRP: 14.2 } } });
        const e = S.add('encounters', { id: H.uid('en'), patientId: p.id, type: 'ER', dept: '응급의학과', doctorId: 'dr5', status: '대기', at: Date.now(), ward: 'ER', room: 'A구역', bed: '6', ktas: 2, arrival: '다른 병원에서 전원', cc: r.reason, dx: [] });
        r.status = '전원 수용 완료'; r.reply = `응급실로 전원 수용 (${T.hm(Date.now())})`; S.save();
        H.notify('ward:ER', `전원 환자 도착 예정: ${p.name} — ${r.reason}`, { patientId: p.id, level: 'stat' }); H.notify('doctor', `전원 수용: ${p.name}`, { patientId: e.patientId, level: 'stat' });
        UI.toast('전원 수용 — 응급실에 알렸습니다', 'ok'); A.render();
      },
      'rf.reject': (el) => { const r = S.get('refs', el.dataset.id); r.status = '거절 완료'; r.reply = '현재 중환자실·병상 부족으로 수용이 어렵습니다. 가까운 권역응급의료센터로 연락 부탁드립니다.'; S.save(); UI.toast('거절 — 다른 병원 연결을 돕습니다', 'warn'); A.render(); },
      'rf.reply': (el) => { const r = S.get('refs', el.dataset.id); UI.modal({ title: `회신서 — ${r.pname}`, body: `<form data-submit="rf.replyGo" class="gap-m"><input type="hidden" name="id" value="${r.id}">${UI.textarea('reply', '진료 결과·향후 계획 (의사 소견)', `${r.appt || ''} 진료함. 검사 결과 설명드렸고 치료 계획을 세웠습니다. 안정되면 귀 의원으로 회송하겠습니다.`, { h: '6rem' })}<div class="btn-row end">${UI.btn('회신서 전송', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }); },
      'rf.replyGo': (f, d) => { const r = S.get('refs', d.id); r.reply = d.reply; r.status = '회신 완료'; S.save(); UI.close(); UI.toast('회신서를 의뢰 기관에 보냈습니다', 'ok'); A.render(); },
      'rf.out': (el) => { const r = S.get('refs', el.dataset.id); UI.modal({ title: `회송서 — ${r.pname}`, body: `<form data-submit="rf.outGo" class="gap-m"><input type="hidden" name="id" value="${r.id}">${UI.textarea('reply', '진단·치료 경과·투약·부탁드릴 내용', '진단: \n치료 경과: \n현재 약: \n부탁드릴 내용: 상처 소독, 실밥 제거, 이상 시 재의뢰', { h: '7rem' })}${UI.check('consent', '환자 회송 동의 확인', false)}<div class="btn-row end">${UI.btn('회송서 전송', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }); },
      'rf.outGo': (f, d) => { if (!d.consent) return UI.toast('환자 동의를 확인하세요', 'warn'); const r = S.get('refs', d.id); r.reply = d.reply; r.status = '회송 완료'; S.save(); H.log('회송', r.pname); UI.close(); UI.toast('회송서를 보냈습니다', 'ok'); A.render(); },
      'rf.newOut': (f, d) => { if (!d.eid) return UI.toast('퇴원 환자를 고르세요', 'warn'); const e = H.enc(d.eid); const p = H.pat(e.patientId); S.add('refs', { id: H.uid('rf'), dir: 'out', to: d.to, dept: e.dept, pid: p.id, pname: p.name, reason: `${(e.dx || []).map((x) => x.name).join(', ')} 치료 후 지속 관리`, status: '회송서 작성 대기', at: Date.now() }); UI.toast('회송 대상 추가', 'ok'); A.render(); },
      'rf.view': (el) => { const r = S.get('refs', el.dataset.id); UI.modal({ title: r.dir === 'in' ? '진료 회신서' : '진료 회송서', size: 'wide', body: refPaper(r) }); },
    },
  });

  // ───────── 예약센터 ─────────
  const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'];
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const sched = (doc) => { const h = doc.id.charCodeAt(doc.id.length - 1); return [1, 2, 3, 4, 5].map((d) => ({ d, am: (h + d) % 3 !== 0, pm: (h + d) % 2 === 0 })); };
  H.reg({
    id: 'appt', title: '예약센터', actor: '예약 담당', layout: 'full', channels: () => ['appt'],
    render() {
      const { tab, html } = tabsOf('ap.tab', [{ id: 'list', label: '예약 현황', icon: 'list' }, { id: 'new', label: '새 예약', icon: 'plus' }, { id: 'sched', label: '의사 진료 일정', icon: 'clock' }, { id: 'sms', label: '문자·알림톡', icon: 'chat' }], 'list');
      let body;
      if (tab === 'list') { const list = S.all('appts').slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)); body = `${UI.note('예약 환자가 오면 "도착 → 외래 접수"를 누르면 외래 대기 명단에 올라갑니다. 예약 전날 문자로 알립니다.', 'info')}
        ${UI.table([{ h: '날짜' }, { h: '시각' }, { h: '환자' }, { h: '진료과·의사' }, { h: '메모' }, { h: '상태' }, { h: '' }], list.map((a) => { const p = H.pat(a.pid); const today = a.date === T.d(Date.now()); return [`<span class="num">${esc(a.date)}</span>${today ? ' ' + UI.chip('오늘', 'sent') : ''}`, `<span class="num">${esc(a.time)}</span>`, `<b>${esc(p ? p.name : '-')}</b>`, `${esc(a.dept)} ${esc(H.M.doctor(a.doctorId).name)}`, `<span class="small">${esc(a.memo || '')}</span>`, UI.chip(a.status, a.status === '도착' ? 'done' : a.status === '취소' ? 'off' : 'plain'),
          a.status === '예약' ? `<div class="row" style="flex-wrap:nowrap;gap:.3rem">${today ? UI.btn('도착 → 외래 접수', 'ap.arrive', { size: 'sm', kind: 'pri', data: { id: a.id } }) : ''}${UI.btn('문자', 'ap.sms', { size: 'sm', data: { id: a.id } })}${UI.btn('취소', 'ap.cancel', { size: 'sm', data: { id: a.id } })}</div>` : '']; }), { empty: UI.empty('예약이 없습니다') })}`; }
      else if (tab === 'new') body = `<form data-submit="ap.new" class="gap-m"><div class="form-grid">${UI.select('pid', '환자', S.all('patients').map((p) => ({ v: p.id, l: `${p.name} (${p.mrn})` })), '')}${UI.select('doc', '진료과·의사', H.M.DOCTORS.filter((d) => d.dept !== '응급의학과').map((d) => ({ v: d.id, l: `${d.dept} — ${d.name}` })), 'dr1')}${UI.input('date', '날짜', T.d(Date.now() + DAY), { type: 'date' })}</div>
        ${UI.fld('시각', pick('time', slots, '10:00'))}${UI.fld('초진·재진', pick('visit', ['초진', '재진'], '재진'))}${UI.input('memo', '메모 (검사 전 금식 등)', '')}
        <div class="btn-row end">${UI.btn('예약 + 확인 문자', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
      else if (tab === 'sched') body = UI.table([{ h: '의사' }, ...[1, 2, 3, 4, 5].map((d) => ({ h: DOW[d] }))], H.M.DOCTORS.filter((d) => !['응급의학과', '마취통증의학과'].includes(d.dept)).map((doc) => [`<b>${esc(doc.name)}</b> <span class="small muted">${esc(doc.dept)}</span>`, ...sched(doc).map((s) => `${s.am ? UI.chip('오전', 'sent') : ''} ${s.pm ? UI.chip('오후', 'purple') : ''}${!s.am && !s.pm ? '<span class="muted small">수술·회진</span>' : ''}`)]));
      else body = UI.table([{ h: '보낸 시각' }, { h: '받는 사람' }, { h: '내용' }], S.where('recs', (r) => r.kind === 'sms').sort((a, b) => b.at - a.at).map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, esc(r.to), `<span class="small">${esc(r.text)}</span>`]), { empty: UI.empty('보낸 문자가 없습니다') });
      return `<div class="panel">${html}<div class="panel-b gap-m">${body}</div></div>`;
    },
    acts: {
      'ap.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'ap.new': (f, d) => { if (!d.pid) return UI.toast('환자를 고르세요', 'warn'); const doc = H.M.doctor(d.doc); const a = S.add('appts', { id: H.uid('ap'), pid: d.pid, dept: doc.dept, doctorId: doc.id, date: d.date, time: d.time, visit: d.visit, status: '예약', memo: d.memo, at: Date.now(), by: H.who() }); smsOf(a, '예약 확인'); UI.toast(`예약 ${d.date} ${d.time} — 확인 문자 발송`, 'ok'); A.set('tab', 'list'); A.render(); },
      'ap.sms': (el) => { smsOf(S.get('appts', el.dataset.id), '예약 알림'); UI.toast('알림톡을 보냈습니다 (가상)', 'ok'); },
      'ap.cancel': (el) => { const a = S.get('appts', el.dataset.id); a.status = '취소'; S.save(); A.render(); },
      'ap.arrive': (el) => {
        const a = S.get('appts', el.dataset.id); const p = H.pat(a.pid); const doc = H.M.doctor(a.doctorId);
        if (H.activeEnc(p.id)) return UI.toast('이미 진행 중인 진료가 있습니다', 'warn');
        const qno = S.where('encounters', (e) => e.type === 'OPD' && e.doctorId === doc.id && e.at >= T.startOfDay()).length + 1;
        S.add('encounters', { id: H.uid('en'), patientId: p.id, type: 'OPD', dept: doc.dept, doctorId: doc.id, status: '대기', at: Date.now(), qno, visit: a.visit || '재진', cc: a.memo || '예약 진료', dx: [] });
        a.status = '도착'; S.save(); H.notify('doctor', `예약 환자 도착: ${p.name} (${doc.dept} 대기 ${qno}번)`, { patientId: p.id }); H.notify('opd', `예약 환자 도착: ${p.name} — 진료 전 준비`, { patientId: p.id });
        UI.toast(`${p.name} 외래 접수 — 대기 ${qno}번`, 'ok'); A.render();
      },
    },
  });
  function smsOf(a, kind) { const p = H.pat(a.pid); H.addRec('sms', a.pid, { to: `${p.name} ${p.phone || ''}`, text: `[SSV병원] ${p.name}님 ${kind}: ${a.date} ${a.time} ${a.dept} ${H.M.doctor(a.doctorId).name} 교수. ${a.memo ? a.memo + '. ' : ''}변경은 1588-0000 (가상)` }); }

  // ───────── 질향상·환자안전 ─────────
  const CP = [
    ['수술 전날', ['혈액·흉부 X선·심전도 결과 확인', '수술·마취 동의서', '자정부터 금식', '수술 전 교육']],
    ['수술 당일', ['예방적 항생제 (절개 60분 안)', '수술 후 활력징후 (15분×4, 30분×2)', '통증 조절', '심호흡·기침 교육']],
    ['수술 후 1일', ['물·미음 시작', '보행 시작', '수액 줄이기', '상처 확인']],
    ['수술 후 2일 (퇴원)', ['일반식', '퇴원 교육 (상처·식사·활동)', '외래 예약', '퇴원']],
  ];
  function indicators() {
    const ip = S.where('encounters', (e) => e.type === 'IPD' && e.status === '입원중');
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
    const morseHi = ip.filter((e) => { const m = H.lastAssess(e.patientId, 'morse'); return m && m.score >= 45; }).length;
    const bradHi = ip.filter((e) => { const b = H.lastAssess(e.patientId, 'braden'); return b && b.score <= 14; }).length;
    const mars = S.where('mar', (m) => m.status === '투약' && !String(m.by).includes('이전'));
    const mar5 = mars.filter((m) => (m.checks || []).length >= 5).length;
    const hand = S.where('recs', (r) => r.kind === 'ic' && r.type === '손위생'); const ht = hand.reduce((s, r) => s + r.done.length, 0), hd = hand.reduce((s, r) => s + r.done.filter(Boolean).length, 0);
    const dis = S.where('encounters', (e) => e.type === 'IPD' && e.status === '퇴원'); const defd = dis.filter((e) => S.where('defs', (d) => d.encId === e.id && d.status !== '완료').length).length;
    return [
      ['낙상 사건 보고', `${S.where('qi', (q) => q.kind === 'event' && q.type === '낙상').length}건`, '줄이기', ''],
      ['낙상 고위험 환자 비율', `${pct(morseHi, ip.length)}%`, '모두 예방 활동 적용', ''],
      ['욕창 위험 환자 비율', `${pct(bradHi, ip.length)}%`, '2시간 체위 변경', ''],
      ['투약 5원칙 확인률', `${pct(mar5, mars.length)}%`, '100%', pct(mar5, mars.length) < 100 && mars.length ? 'prog' : 'done'],
      ['손위생 수행률', `${pct(hd, ht)}%`, '90% 이상', pct(hd, ht) < 90 ? 'prog' : 'done'],
      ['퇴원 환자 미비 기록률', `${pct(defd, dis.length)}%`, '5% 미만', pct(defd, dis.length) >= 5 ? 'prog' : 'done'],
      ['환자안전 사건 보고 (전체)', `${S.where('qi', (q) => q.kind === 'event').length}건`, '보고 문화 활성화 — 많을수록 좋음', 'done'],
    ];
  }
  function pneumonia() {
    return S.where('encounters', (e) => e.type === 'IPD' && (e.dx || []).some((d) => d.code === 'J18.9')).map((e) => {
      const p = H.pat(e.patientId);
      const spo2 = S.where('vitals', (v) => v.patientId === p.id && v.spo2 && v.at <= e.at + DAY).length > 0;
      const abx = S.where('mar', (m) => { const o = S.get('orders', m.orderId); return o && o.patientId === p.id && H.M.clsHas(H.M.item(o.code), 'antibiotic'); }).sort((a, b) => a.at - b.at)[0];
      const bcx = S.where('orders', (o) => o.patientId === p.id && o.code === 'L1020' && o.specimenAt).sort((a, b) => a.specimenAt - b.specimenAt)[0];
      const sput = S.where('orders', (o) => o.patientId === p.id && o.code === 'L1022').length > 0;
      return { p, items: [['입원 24시간 안 산소포화도 측정', spo2], ['첫 항생제 전에 혈액배양', !!(bcx && (!abx || bcx.specimenAt <= abx.at)) || (!!S.where('orders', (o) => o.patientId === p.id && o.code === 'L1020' && o.at <= e.at + 2 * 3600000).length)], ['객담 검사 시행', sput], ['입원 후 항생제 투여', !!abx || S.where('orders', (o) => o.patientId === p.id && H.M.clsHas(H.M.item(o.code), 'antibiotic')).length > 0]] };
    });
  }
  H.reg({
    id: 'qi', title: '질향상·환자안전', actor: 'QI 전담 간호사', layout: 'full', channels: () => ['qi'],
    render() {
      const { tab, html } = tabsOf('qi.tab', [{ id: 'event', label: '환자안전 사건 보고', icon: 'alert' }, { id: 'ind', label: '질 지표', icon: 'list' }, { id: 'cp', label: '표준진료지침 (CP)', icon: 'clip' }, { id: 'eval', label: '적정성 평가', icon: 'check' }, { id: 'safe', label: '시설·안전 점검', icon: 'building' }], 'event');
      let body;
      if (tab === 'event') body = `<form data-submit="qi.event" class="panel"><div class="panel-h"><h3>환자안전 사건 보고</h3></div><div class="panel-b gap-m">${UI.note('환자안전법: 사고를 보고한 사람을 벌하지 않습니다(비처벌). 보고를 모아 원인을 찾고 같은 일이 다시 생기지 않게 시스템을 고칩니다. 근접 오류(위해 직전에 막은 일)도 보고합니다.', 'info')}
          <div class="form-grid">${UI.select('type', '사건 종류', ['낙상', '투약 오류', '욕창', '환자 확인 오류', '수혈 오류', '검사·검체 오류', '수술 관련', '폭력·자해'], '낙상')}${UI.select('grade', '위해 정도', ['근접 오류 (위해 없음)', '위해 없음', '경미한 위해', '중등도 위해', '심각한 위해', '사망 (적신호 사건)'], '근접 오류 (위해 없음)')}${UI.select('ward', '장소', ['7A', '8B', 'ICU', 'ER', 'LD', 'NB', '수술실', '외래'], '7A')}${UI.input('pname', '관련 환자 (선택)', '')}</div>
          ${UI.textarea('what', '무슨 일이 있었나 (사실만)', '', { h: '4rem' })}
          <div class="fld"><span class="lbl">원인 (해당하는 것 모두)</span>${checks('cause', ['의사소통 부족', '절차·규정 안 지킴', '인력 부족·업무 과다', '장비·물품 문제', '환경 (조명·바닥)', '환자 요인 (섬망·고령)', '교육 부족'])}</div>
          ${UI.input('action', '즉시 한 조치', '', { cls: 'wide' })}<div class="btn-row end">${UI.btn('보고', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></div></form>
        ${UI.table([{ h: '보고일' }, { h: '종류' }, { h: '위해 정도' }, { h: '장소' }, { h: '내용' }, { h: '상태' }, { h: '' }], S.where('qi', (q) => q.kind === 'event').sort((a, b) => b.at - a.at).map((q) => [`<span class="num small">${T.md(q.at)}</span>`, esc(q.type), UI.chip(q.grade, /심각|사망|중등도/.test(q.grade) ? 'stat' : 'plain'), esc(q.ward), `<span class="small">${esc(q.what)}</span>`, UI.chip(q.status, q.status === '검토 완료' ? 'done' : 'prog'), q.status !== '검토 완료' ? UI.btn('원인 분석·개선', 'qi.review', { size: 'sm', data: { id: q.id } }) : `<span class="small">${esc(q.improve || q.action || '')}</span>`]))}`;
      else if (tab === 'ind') body = `<div class="grid3">${indicators().map(([n, v, goal, tone]) => `<div class="box"><div class="small muted">${esc(n)}</div><div class="score-big">${esc(v)}</div><div class="small">${tone ? UI.chip(tone === 'done' ? '목표 달성' : '개선 필요', tone) : ''} 목표: ${esc(goal)}</div></div>`).join('')}</div>${UI.note('지표는 실습 중 쌓인 기록으로 자동 계산됩니다. 매달 지표를 보고 개선 활동(PDCA: 계획-실행-확인-개선)을 합니다.', 'info')}`;
      else if (tab === 'cp') { const ops = S.where('orders', (o) => o.code === 'O9001' && !H.flow.isOff(o)); const p = ops[0] ? H.pat(ops[0].patientId) : null; const rec = p ? H.recs(p.id, 'cp')[0] : null; const done = rec ? rec.done : [];
        body = `${UI.note('표준진료지침(CP): 같은 수술·질환 환자에게 날짜별로 해야 할 일을 정해 둔 계획표. 계획에서 벗어난 것은 "변이"로 기록해 원인을 분석합니다. 예: 복강경 담낭절제술 2박 3일 CP', 'info')}
        ${p ? `<form data-submit="qi.cp" class="gap-m"><input type="hidden" name="pid" value="${p.id}"><p style="margin:0">적용 환자: <b>${esc(p.name)}</b> (${esc(ops[0].status)})</p>
          ${CP.map(([day, items]) => `<div class="box"><h4>${esc(day)}</h4>${checks('done', items.map((i) => `${day}: ${i}`), done)}</div>`).join('')}
          ${UI.input('variance', '변이 (계획대로 안 된 것과 이유)', rec ? rec.variance || '' : '', { cls: 'wide' })}<div class="btn-row end">${UI.btn('CP 기록 저장', '', { type: 'submit', kind: 'pri' })}</div></form>` : UI.empty('담낭절제술 환자가 없습니다')}`; }
      else if (tab === 'eval') body = `${UI.note('적정성 평가: 건강보험심사평가원이 병원 진료가 기준대로 이루어졌는지 지표로 평가하고 등급을 공개합니다. 예: 폐렴 적정성 평가', 'info')}
        ${pneumonia().map(({ p, items }) => `<div class="box"><h4>${esc(p.name)} — 폐렴</h4>${UI.table([{ h: '평가 지표' }, { h: '결과' }], items.map(([n, ok]) => [esc(n), ok ? UI.chip('충족', 'done') : UI.chip('미충족', 'stat')]))}</div>`).join('') || UI.empty('폐렴 입원 환자가 없습니다')}`;
      else body = `<form data-submit="qi.safe" class="gap-m">${UI.fld('점검 분야', pick('area', ['소방 (소화기·피난 통로)', '의료가스 (산소·흡인 압력)', '전기 (비상 발전기)', '승강기', '병실 환경 (침대 바퀴·난간)'], '소방 (소화기·피난 통로)'))}
        ${checks('c', ['점검표 항목 모두 확인', '이상 없음', '이상 발견 시 시설팀 수리 요청', '점검 결과 게시'])}${UI.input('memo', '특이 사항', '')}<div class="btn-row end">${UI.btn('점검 기록', '', { type: 'submit', kind: 'pri' })}</div>
        ${UI.table([{ h: '일시' }, { h: '분야' }, { h: '메모' }], S.where('recs', (r) => r.kind === 'safety').map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, esc(r.area), esc(r.memo || '')]), { empty: '<p class="muted small">기록 없음</p>' })}</form>`;
      return `<div class="panel">${html}<div class="panel-b gap-m">${body}</div></div>`;
    },
    acts: {
      'qi.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'qi.event': (f, d) => { if (!d.what) return UI.toast('무슨 일이 있었는지 써 주세요', 'warn'); S.add('qi', { id: H.uid('qi'), kind: 'event', type: d.type, grade: d.grade, ward: d.ward, pname: d.pname, what: d.what, cause: d.cause || [], action: d.action, at: Date.now(), by: H.who(), status: '검토 중' }); if (/심각|사망/.test(d.grade)) H.notify('qi', `적신호 사건 보고: ${d.type} — 즉시 근본원인분석`, { level: 'stat' }); H.log('환자안전 보고', d.type); UI.toast('보고 접수 — 고마워요, 보고가 안전을 만듭니다', 'ok'); A.render(); },
      'qi.review': (el) => { const q = S.get('qi', el.dataset.id); UI.modal({ title: `원인 분석·개선 — ${q.type}`, body: `<form data-submit="qi.reviewGo" class="gap-m"><input type="hidden" name="id" value="${q.id}"><p style="margin:0">${esc(q.what)}</p>${UI.textarea('why', '왜 그랬나 (5번 왜? — 근본 원인)', '', { h: '4rem' })}${UI.textarea('improve', '개선 활동 (시스템을 어떻게 바꿀지)', '', { h: '3rem' })}<div class="btn-row end">${UI.btn('검토 완료', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }); },
      'qi.reviewGo': (f, d) => { const q = S.get('qi', d.id); q.why = d.why; q.improve = d.improve; q.status = '검토 완료'; S.save(); UI.close(); UI.toast('검토 완료', 'ok'); A.render(); },
      'qi.cp': (f, d) => { H.addRec('cp', d.pid, { done: d.done || [], variance: d.variance }); UI.toast('CP 기록 저장', 'ok'); A.render(); },
      'qi.safe': (f, d) => { H.addRec('safety', null, { area: d.area, c: d.c || [], memo: d.memo }); UI.toast('안전 점검 기록', 'ok'); A.render(); },
    },
  });

  // ───────── 간호행정·교육·보건 ─────────
  // 3교대 근무표는 js/modules/p12-duty.js (H.duty)에서 그림
  H.reg({
    id: 'nadmin', title: '간호행정·교육·보건', actor: '수간호사·보건관리자', layout: 'full', channels: () => ['nadmin'],
    render() {
      const { tab, html } = tabsOf('na.tab', [{ id: 'roster', label: '3교대 근무표', icon: 'clock' }, { id: 'edu', label: '직원 필수 교육', icon: 'clip' }, { id: 'health', label: '직원 건강 (보건관리)', icon: 'heart' }], 'roster');
      const staff = S.all('staff');
      let body;
      if (tab === 'roster') { body = H.duty ? H.duty.body() : ''; }
      else { const key = tab === 'edu' ? 'edu' : 'health'; const items = Object.keys(staff[0] ? staff[0][key] : {}); const rate = (it) => Math.round((staff.filter((s) => s[key][it]).length / Math.max(1, staff.length)) * 100);
        body = `${UI.note(tab === 'edu' ? '의료기관 인증평가: 모든 직원은 감염관리·심폐소생술·환자안전·개인정보보호 교육을 해마다 받아야 합니다.' : '보건관리자(간호사): 직원 건강검진, B형간염 항체·인플루엔자 예방접종, 결핵 검진, 주사침 자상 사후관리를 맡습니다.', 'info')}
          ${UI.table([{ h: '직원' }, ...items.map((i) => ({ h: `${i} (${rate(i)}%)` }))], staff.map((s) => [`<b>${esc(s.name)}</b> <span class="small muted">${esc(s.role)}</span>`, ...items.map((i) => `<button class="btn sm" data-act="na.toggle" data-id="${s.id}" data-k="${key}" data-i="${esc(i)}" style="${s[key][i] ? 'border-color:var(--t-done);color:var(--t-done)' : 'border-color:var(--t-stat);color:var(--t-stat)'}">${s[key][i] ? '✓ 완료' : '✗ 미완료'}</button>`)]))}`; }
      return `<div class="panel">${html}<div class="panel-b gap-m">${body}</div></div>`;
    },
    acts: {
      'na.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'na.toggle': (el) => { const s = S.get('staff', el.dataset.id); s[el.dataset.k][el.dataset.i] = !s[el.dataset.k][el.dataset.i]; S.save(); A.render(); },
    },
  });
})();
