// 심사 실무 화면: 퇴원 심사(DRG 심사), 입원 사후 심사(명세서), 재청구·이의신청
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const F = H.flow;
  const E = () => H.erp;
  const DAY = 86400000;
  const ms = (k, d) => A.ms(k, d); const set = (k, v) => A.set(k, v);
  const won = (n) => E().won(n);
  const CATS = [['', '0.전체'], ['MED', '1.내복약'], ['INJ', '2.주사'], ['LAB', '3.검사'], ['RAD', '4.영상'], ['OP', '5.수술·마취'], ['PROC', '6.처치'], ['BLOOD', '7.수혈']];

  // 처방 줄 (심사용 상세)
  function rxRows(e, catF, audit) {
    const c = H.fee.calc(e);
    const cut = {}; (audit ? audit.items : []).forEach((x) => { if (x.orderId) cut[x.orderId] = x; });
    return c.lines.map(E().lineDetail).filter((l) => { if (!catF) return true; const o = l.orderId && S.get('orders', l.orderId); return o && o.cat === catF; }).map((l, i) => {
      const o = l.orderId ? S.get('orders', l.orderId) : null; const flag = o && cut[o.id];
      return { cells: [flag ? `<b style="color:var(--t-stat)">!</b>` : o && o.annot ? '<b style="color:var(--t-sent)">주</b>' : '', esc(l.group.slice(0, 4)), '', `<span class="mono">${esc(l.single)}</span>`, `<span class="mono">${esc(l.edi)}</span>`, `${esc(l.name)}${flag ? `<div class="small" style="color:var(--t-stat)">${esc(flag.reason)}</div>` : ''}`, won(l.price), l.act ? '행위' : '재료', '1', String(l.qty), '1', won(l.amount), won(l.add), l.point, (Number(l.point) * l.qty).toFixed(2), String(H.erp.CONV)], act: o ? 'sv.line' : '', data: o ? { id: o.id } : {}, on: !!flag };
    });
  }
  const RXCOLS = [{ h: 'G' }, { h: '그룹코드' }, { h: '그' }, { h: '싱글코드' }, { h: '표준코드' }, { h: '싱글 명칭' }, { h: '적용단가', n: 1 }, { h: '행위' }, { h: '투여량' }, { h: '횟수' }, { h: '일수' }, { h: '계산금액', n: 1 }, { h: '병원가산', n: 1 }, { h: '수가점수', n: 1 }, { h: '산정점수', n: 1 }, { h: '지수(환산)', n: 1 }];
  const lineActs = {
    'sv.line': (el) => {
      const o = S.get('orders', el.dataset.id);
      UI.modal({ title: `처방 심사 — ${o.name}`, size: 'narrow', body: `<form data-submit="sv.lineGo" class="gap-m"><input type="hidden" name="id" value="${o.id}">
        <p style="margin:0" class="small">${esc(H.view.doseText(o))} · ${T.dhm(o.at)} · ${esc(o.by)}</p>
        ${UI.fld('심사 판단', UI.pick('act', [{ v: 'ok', l: '인정 (그대로 청구)' }, { v: 'drop', l: '조정 — 청구에서 뺌 (처방 오류·중복)' }, { v: 'annot', l: '주석 달기 (사용 사유 설명)' }], o.adj && o.adj.drop ? 'drop' : o.annot ? 'annot' : 'ok'))}
        ${UI.textarea('memo', '사유 / 주석 내용', (o.adj && o.adj.reason) || o.annot || '', { h: '4rem', ph: '예: 알부민 2.5 미만으로 투여 기준 충족 / 같은 날 중복 처방 확인' })}
        <div class="btn-row end">${UI.btn('저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
    },
    'sv.lineGo': (f, d) => {
      const o = S.get('orders', d.id);
      if (d.act === 'drop') { o.adj = { drop: true, reason: d.memo, by: H.who(), at: Date.now() }; delete o.annot; }
      else if (d.act === 'annot') { if (!d.memo) return UI.toast('주석 내용을 써 주세요', 'warn'); o.annot = d.memo; delete o.adj; }
      else { delete o.adj; delete o.annot; }
      S.save(); H.log('처방 심사', `${o.name} — ${{ ok: '인정', drop: '조정', annot: '주석' }[d.act]}`, o.patientId); UI.close(); UI.toast('심사 반영 — 진료비가 다시 계산됩니다', 'ok'); A.render();
    },
  };

  // ───────── 퇴원 심사 (DRG 심사 화면) ─────────
  const dcState = (e) => e.dc && e.dc.review ? '완료' : e.dcRev && e.dcRev.start ? '심사중' : '대기';
  H.reg({
    id: 'dcreview', title: '퇴원 심사 (DRG 심사)', actor: '보험심사 간호사', layout: 'full', channels: () => ['review'],
    render() {
      const st = ms('st', 'Y'); const dept = ms('dept', ''); const cat = ms('cat', ''); const ins = ms('ins', '');
      const list = S.where('encounters', (e) => e.type === 'IPD' && (st === 'Y' ? e.status === '입원중' && e.dc : st === 'J' ? e.status === '입원중' : e.status === '퇴원') && (!dept || e.dept === dept) && (!ins || H.pat(e.patientId).ins.startsWith(ins)));
      const sel = list.find((x) => x.id === ms('sel', '')) || list[0];
      const sub = ms('sub', 'rx');
      let top = UI.empty('심사할 환자가 없습니다');
      if (sel) {
        const p = H.pat(sel.patientId); const c = H.fee.calc(sel); const au = H.fee.audit(sel); const i = E().info(p);
        const drg = S.where('orders', (o) => o.encId === sel.id && ['O9003', 'O9005'].includes(o.code)).length ? 'DRG' : (sel.adm || {}).calcType && sel.adm.calcType.includes('포괄') ? 'DRG' : '행위별';
        const cp = S.where('orders', (o) => o.encId === sel.id && o.code === 'O9001').length ? '담낭절제 CP' : '';
        const appt = S.where('appts', (a) => a.pid === p.id && a.status === '예약')[0];
        const er = sel.fromEnc && H.enc(sel.fromEnc);
        top = `${E().fields([
          { l: '환자번호', txt: p.mrn, t: 'key' }, { l: '입원일시', txt: T.dhm(sel.at) }, { l: '진료과', txt: sel.dept, t: 'req' }, { l: '입원도착', txt: (sel.adm || {}).arrive || '기타' }, { l: '사전심사', txt: sel.dcRev && sel.dcRev.start ? T.mdhm(sel.dcRev.start) : '', t: 'calc' }, { l: '최종정산', txt: sel.billed ? T.mdhm(sel.billed) : '', t: 'ro' },
          { l: '환자성명', txt: p.name, t: 'key' }, { l: '퇴원일시', txt: sel.dc ? `${sel.dc.date} (예정)` : sel.endAt ? T.dhm(sel.endAt) : '' }, { l: 'STAFF', txt: H.M.doctor(sel.doctorId).name, t: 'req' }, { l: '중증등록', txt: p.special ? p.special.code : '', t: p.special ? 'warn' : '' }, { l: '행위계산', txt: T.mdhm(Date.now()) }, { l: '최종청구', txt: sel.claimId ? (S.get('claims', sel.claimId) || {}).no || '' : '' },
          { l: '주민번호', txt: i.rrn }, { l: '보험유형', txt: p.ins, t: 'warn' }, { l: '병동병실', txt: `${sel.ward} ${sel.room}-${sel.bed}`, t: 'req' }, { l: '사망여부', txt: sel.dc && sel.dc.form === '사망' ? 'Y' : 'N' }, { l: '계산방법', txt: drg === 'DRG' ? '포괄수가' : '개별수가', t: 'calc' }, { l: '재원일수', txt: `${H.fee.daysOf(sel)}일` },
          { l: '완료문자', txt: sel.dc && sel.dc.review ? '발송함' : '', t: 'warn' }, { l: '보조사유', txt: p.special ? p.special.name : '', t: 'warn' }, { l: 'CP / DRG', txt: [cp, drg].filter(Boolean).join(' · '), t: 'calc' }, { l: '자격제한', txt: p.eligAt ? '없음 (조회함)' : '조회 안 함', t: 'warn' }, { l: '소급적용', txt: '없음', t: 'calc' }, { l: 'KTAS', txt: er && er.ktas ? String(er.ktas) : '' },
          { l: '가퇴원 사유', n: 'tmpWhy', v: (sel.dcRev || {}).tmpWhy || '', t: 'req', w: 2 }, { l: '외래예약', txt: appt ? `${appt.date} ${appt.dept}` : (sel.dc || {}).fu || '' }, { l: '응급경유', txt: er ? 'Y' : 'N' }, { l: '최종심사', txt: sel.dc && sel.dc.review ? T.mdhm(sel.dc.review.at) : '', t: 'warn' }, { l: '최종계산', txt: won(c.total) + '원', t: 'calc' },
        ])}
        <div class="row">${E().bar([{ l: '방사선 결과', act: 'sv.res', data: { k: 'rad' } }, { l: '임상(검사) 결과', act: 'sv.res', data: { k: 'lab' } }, { l: '의약품 조회', act: 'sv.res', data: { k: 'med' } }, { l: '자격 조회', act: 'sv.elig' }, { l: '제증명', act: 'map.go', data: { v: 'certdoc' } }, { l: 'EMR 조회', act: 'sv.emr' }, { l: '항암제', act: 'sv.res', data: { k: 'chemo' } }, { l: '완료 문자', act: 'sv.sms' }, { l: '처방 출력', act: 'sv.print' }, { l: '자료 저장', act: 'sv.saveTmp' }])}</div>
        ${E().tabs('sv.sub', [['rx', `처방 심사 (${c.lines.length})`], ['dx', '상병 심사'], ['note', '주석 심사'], ['check', `사전 점검 (${au.items.length})`]], sub)}
        ${sub === 'rx' ? `<div class="row"><span class="small">처방 분류</span>${UI.seg('sv.cat', CATS.map(([v, l]) => ({ v, l })), cat)}<span class="small muted">줄을 누르면 인정·조정·주석을 고릅니다. <b style="color:var(--t-stat)">!</b> = 삭감 예상</span></div>${E().grid(RXCOLS, rxRows(sel, cat, au), { h: '20rem' })}`
          : sub === 'dx' ? `${E().grid([{ h: 'No' }, { h: '상병코드' }, { h: '상병명' }, { h: '주/부' }, { h: '특정기호' }, { h: '' }], (sel.dx || []).map((d, i2) => [i2 + 1, `<span class="mono">${esc(d.code)}</span>`, esc(d.name), d.main ? '주' : '부', esc(p.special && d.main ? p.special.code : ''), UI.btn(d.main ? '주상병' : '주로 바꾸기', 'sv.dxMain', { size: 'sm', data: { i: i2 } })]), { empty: '상병이 없습니다 — 반송 사유!' })}
              <div class="row"><select class="inp" id="sv-dx" style="max-width:28rem" aria-label="상병 추가">${H.M.KCD.map((k) => `<option value="${k.code}">${k.code} ${esc(k.name)}</option>`).join('')}</select>${UI.btn('상병 추가 (의사 확인 후)', 'sv.dxAdd')}</div>`
          : sub === 'note' ? `${UI.note('주석 심사: 기준을 넘는 처방(예: 알부민·고가 검사)은 명세서에 "주석(사용 사유)"을 달아 청구해야 인정받을 수 있습니다.', 'info')}
              ${E().grid([{ h: '처방' }, { h: '삭감 예상 사유' }, { h: '주석' }, { h: '' }], c.lines.filter((l) => l.orderId).map((l) => S.get('orders', l.orderId)).filter((o) => o.annot || au.items.some((x) => x.orderId === o.id)).map((o) => [esc(o.name), esc((au.items.find((x) => x.orderId === o.id) || {}).reason || '-'), esc(o.annot || ''), UI.btn('주석 달기', 'sv.line', { size: 'sm', data: { id: o.id } })]), { empty: '주석이 필요한 처방이 없습니다' })}`
          : E().grid([{ h: '구분' }, { h: '대상' }, { h: '사유' }, { h: '예상 금액', n: 1 }], au.items.map((x) => [x.type, esc(x.name), esc(x.reason), won(x.cut)]), { empty: '사전 점검 결과 문제 없음' })}
        ${c.pending.length ? UI.note(`시행 안 된 처방 ${c.pending.length}건 — 완료 전 정리 필요 (${c.pending.map((o) => esc(o.name)).join(', ')})`, 'warn') : ''}`;
      }
      return `<div class="erp">
        ${E().bar([`입원상태 <select data-chg="sv.f" data-k="st"><option value="Y" ${st === 'Y' ? 'selected' : ''}>Y.퇴원예정</option><option value="J" ${st === 'J' ? 'selected' : ''}>J.재원</option><option value="T" ${st === 'T' ? 'selected' : ''}>T.퇴원</option></select>`,
          `분야/과 <select data-chg="sv.f" data-k="dept"><option value="">0.전체</option>${[...new Set(H.M.DOCTORS.map((d) => d.dept))].map((d) => `<option ${dept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>`,
          `보험유형 <select data-chg="sv.f" data-k="ins"><option value="">0.전체</option>${['건강보험', '의료급여', '산재', '자동차', '일반'].map((x) => `<option ${ins === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`, '|',
          { l: 'DRG 심사', act: 'sv.drg' }, { fk: 'F4', l: '심사 시작', act: 'sv.start', kind: 'warn', disabled: !sel || dcState(sel) !== '대기' }, { fk: 'F2', l: '심사 완료', act: 'sv.done', kind: 'pri', disabled: !sel || dcState(sel) === '완료' || sel.status !== '입원중' }, { fk: 'F5', l: '완료 취소', act: 'sv.undo', disabled: !sel || dcState(sel) !== '완료' || !!sel.billed }, { fk: 'F12', l: '종료', act: 'map.go', data: { v: 'map' } }])}
        ${top}
        <div class="erp-sec">심사 환자 선택 (${list.length})</div>
        ${E().grid([{ h: 'No' }, { h: '심사상태' }, { h: '정리시간' }, { h: '완료시간' }, { h: '환자번호' }, { h: '빠른' }, { h: '환자명' }, { h: '주부' }, { h: '병실' }, { h: '입원일' }, { h: '입원시간' }, { h: '퇴원일' }, { h: '퇴원시간' }, { h: '이력시작일' }, { h: '이력종료일' }, { h: '유형' }, { h: '보조유형' }, { h: '사유' }, { h: 'CP적용' }, { h: 'DRG' }, { h: '응급경유' }, { h: '외래예약' }, { h: '진료분과' }, { h: 'STAFF' }],
          list.map((e, k) => { const p = H.pat(e.patientId); const s = dcState(e); return { cells: [k + 1, `<b style="color:${s === '완료' ? 'var(--t-done)' : s === '심사중' ? 'var(--t-prog)' : 'var(--fg-3)'}">${s}</b>`, e.dcRev && e.dcRev.start ? T.hm(e.dcRev.start) : '', e.dc && e.dc.review ? T.hm(e.dc.review.at) : '', p.mrn, e.dc && e.dc.date === T.d(Date.now()) ? '★' : '', esc(p.name), '주', `${e.ward} ${e.room}`, T.d(e.at), T.hm(e.at), e.dc ? esc(e.dc.date) : e.endAt ? T.d(e.endAt) : '', e.endAt ? T.hm(e.endAt) : '', T.d(e.at), e.endAt ? T.d(e.endAt) : '', esc(p.ins), esc(p.special ? p.special.code : ''), esc((e.dcRev || {}).tmpWhy || ''), S.where('orders', (o) => o.encId === e.id && o.code === 'O9001').length ? 'Y' : '', S.where('orders', (o) => o.encId === e.id && ['O9003', 'O9005'].includes(o.code)).length ? 'Y' : '', e.fromEnc ? 'Y' : '', esc((e.dc || {}).fu || ''), esc(e.dept), esc(H.M.doctor(e.doctorId).name)], on: sel && e.id === sel.id, act: 'sv.pick', data: { id: e.id } }; }), { h: '16rem', empty: '해당 환자가 없습니다' })}
      </div>`;
    },
    acts: Object.assign({}, lineActs, {
      'map.go': (el) => A.go(el.dataset.v),
      'sv.f': (el) => { set(el.dataset.k, el.value); set('sel', ''); A.render(); },
      'sv.cat': (el) => { set('cat', el.dataset.v); A.render(); },
      'sv.sub': (el) => { set('sub', el.dataset.v); A.render(); },
      'sv.pick': (el) => { set('sel', el.dataset.id); A.render(); },
      'sv.cur': () => H.enc(ms('sel', '')) || S.where('encounters', (e) => e.type === 'IPD' && e.status === '입원중' && e.dc)[0],
      'sv.start': () => { const e = H.mods.dcreview.acts['sv.cur'](); e.dcRev = Object.assign(e.dcRev || {}, { start: Date.now(), by: H.who() }); S.save(); UI.toast('심사 시작 — 처방·상병·주석을 차례로 봅니다', 'ok'); A.render(); },
      'sv.done': () => {
        const e = H.mods.dcreview.acts['sv.cur'](); const c = H.fee.calc(e); const p = H.pat(e.patientId);
        if (!(e.dx || []).length) return UI.toast('상병이 없습니다 — 상병 심사에서 추가하세요', 'err');
        if (c.pending.length) return UI.toast(`시행 안 된 처방 ${c.pending.length}건을 먼저 정리하세요`, 'err');
        if (!e.dc.ward) UI.toast('병동 퇴원 준비가 아직입니다 (가퇴원 사유에 기록 권장)', 'warn');
        const tmp = document.querySelector('[name=tmpWhy]'); e.dcRev = Object.assign(e.dcRev || {}, { tmpWhy: tmp ? tmp.value : '' });
        e.dc.review = { at: Date.now(), by: H.who(), memo: 'DRG 심사 화면에서 완료' }; S.save();
        H.notify('billing', `퇴원 심사 완료: ${p.name} — 퇴원 수납 가능 (완료 문자 발송)`, { patientId: p.id }); H.addRec('sms', p.id, { to: `${p.name} ${p.phone || ''}`, text: `[SSV병원] ${p.name}님 퇴원 계산이 끝났습니다. 원무과에서 수납해 주세요. 진료비 ${H.won(c.due)}` });
        H.log('퇴원 심사 완료', p.name, p.id); UI.toast('심사 완료 — 원무과·환자에게 완료 문자를 보냈습니다', 'ok'); A.render();
      },
      'sv.undo': () => { const e = H.mods.dcreview.acts['sv.cur'](); delete e.dc.review; S.save(); UI.toast('심사 완료 취소 — 다시 심사하세요', 'warn'); A.render(); },
      'sv.dxMain': (el) => { const e = H.mods.dcreview.acts['sv.cur'](); e.dx.forEach((d, i) => { d.main = i === Number(el.dataset.i); }); S.save(); A.render(); },
      'sv.dxAdd': () => { const e = H.mods.dcreview.acts['sv.cur'](); const code = document.getElementById('sv-dx').value; const k = H.M.KCD.find((x) => x.code === code); if (e.dx.some((d) => d.code === code)) return; e.dx.push({ code, name: k.name, main: !e.dx.length, byReview: true }); S.save(); H.notify('doctor', `심사팀 상병 추가: ${H.pat(e.patientId).name} ${code} — 확인 부탁드립니다`, { patientId: e.patientId }); UI.toast('상병 추가 — 의사에게 확인 요청', 'ok'); A.render(); },
      'sv.res': (el) => { const e = H.mods.dcreview.acts['sv.cur'](); const p = H.pat(e.patientId); const k = el.dataset.k; UI.modal({ title: { rad: '방사선 결과', lab: '임상(검사) 결과', med: '의약품 조회', chemo: '항암제' }[k], size: 'wide', body: k === 'rad' ? H.view.radList(p.id) : k === 'lab' ? H.view.labCumulative(p.id) : H.view.orderTable(S.where('orders', (o) => o.encId === e.id && (o.cat === 'MED' || o.cat === 'INJ') && (k !== 'chemo' || (H.M.item(o.code) || {}).chemo))) }); },
      'sv.elig': () => { const p = H.pat(H.mods.dcreview.acts['sv.cur']().patientId); p.eligAt = Date.now(); S.save(); UI.toast(`자격 조회: ${p.ins} 유지`, 'ok'); A.render(); },
      'sv.emr': () => { const e = H.mods.dcreview.acts['sv.cur'](); UI.modal({ title: 'EMR 조회', size: 'wide', body: S.where('notes', (n) => n.encId === e.id).map((n) => `<div class="box"><b>${esc(n.type)}</b> ${esc(n.by)} ${T.dhm(n.at)}<div class="small pre">${esc(Object.values(n.content).join('\n'))}</div></div>`).join('') || '기록 없음' }); },
      'sv.sms': () => UI.toast('완료 문자는 심사 완료(F2) 때 자동으로 보냅니다', ''),
      'sv.print': () => { const e = H.mods.dcreview.acts['sv.cur'](); UI.modal({ title: '처방 출력', size: 'wide', body: H.fee.detail(H.fee.calc(e)) }); },
      'sv.saveTmp': () => { const e = H.mods.dcreview.acts['sv.cur'](); const tmp = document.querySelector('[name=tmpWhy]'); e.dcRev = Object.assign(e.dcRev || {}, { tmpWhy: tmp ? tmp.value : '' }); S.save(); UI.toast('자료 저장', 'ok'); },
      'sv.drg': () => { const e = H.mods.dcreview.acts['sv.cur'](); const d = H.fee.daysOf(e); const drg = S.where('orders', (o) => o.encId === e.id && ['O9003', 'O9005'].includes(o.code)); UI.modal({ title: 'DRG 심사', size: 'narrow', body: drg.length ? `<dl class="kv"><dt>질병군</dt><dd>${esc(drg[0].name)}</dd><dt>재원일수</dt><dd>${d}일</dd><dt>구분</dt><dd>${d > 30 ? '상단 열외군 (행위별 일부 추가)' : d <= 1 ? '하단 열외군' : '정상군 (정해진 포괄 금액)'}</dd></dl>` : '7개 질병군 포괄수가 대상이 아닙니다 (행위별 수가)' }); },
    }),
  });

  // ───────── 입원 사후 심사 (명세서) ─────────
  const POA = ['Y 입원 때 있었음', 'N 입원 후 생김', 'U 기록 불충분', 'W 임상적 판단 불가', '1 해당 없음'];
  const RESULT = ['1 계속', '2 이송', '3 회송', '4 사망', '5 퇴원(외래)', '6 퇴원(종결)'];
  H.reg({
    id: 'postreview', title: '입원 사후 심사 (명세서)', actor: '보험심사 간호사', layout: 'full', channels: () => ['review'],
    render() {
      const list = S.where('encounters', (e) => e.billed && e.type === 'IPD').sort((a, b) => b.billed - a.billed);
      const e = list.find((x) => x.id === ms('sel', '')) || list[0];
      if (!e) return `<div class="panel"><div class="panel-b">${UI.empty('사후 심사할 명세서가 없습니다', '퇴원 수납이 끝난 입원 환자의 명세서를 청구 전에 다시 점검합니다.')}</div></div>`;
      const p = H.pat(e.patientId); const c = H.fee.calc(e); const au = H.fee.audit(e); const i = E().info(p); const cl = e.claimId ? S.get('claims', e.claimId) : null;
      const ci = e.claimInfo || (e.claimInfo = { poa: {}, res: {}, spec: {}, rev: 0 });
      const op = S.where('orders', (o) => o.encId === e.id && o.cat === 'OP' && !F.isOff(o))[0];
      const lines = c.lines.map(E().lineDetail);
      const sum = (fn) => lines.reduce((s, l) => s + fn(l), 0);
      const ct = sum((l) => l.group === 'CT 진단료' ? l.amount : 0), mri = sum((l) => l.group === 'MRI 진단료' ? l.amount : 0);
      const grp = ms('grp', '');
      return `<form class="erp" data-submit="pr.save">
        ${E().bar([`명세서 <select data-chg="pr.sel" aria-label="명세서 선택">${list.map((x) => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${esc(H.pat(x.patientId).name)} · ${T.d(x.at)}~${T.d(x.endAt || x.billed)}</option>`).join('')}</select>`, '|', { l: 'EMR', act: 'pr.emr', kind: 'danger' }, { l: '주석 심사', act: 'pr.tab', data: { v: 'note' } }, { l: '상병 코드', act: 'pr.tab', data: { v: 'dx' } }, { l: '합철 (분리 청구 합침)', act: 'pr.merge' }, { l: '수가 코드', act: 'pr.fee' }, '|', { fk: 'F3', l: '심사 1', act: 'pr.rev1', kind: 'warn' }, { fk: 'F4', l: '심사 2', act: 'pr.rev2', kind: 'warn' }, { l: '승인 요청', act: 'pr.approve' }, { fk: 'F5', l: '완료', act: '', kind: 'pri' }, { fk: 'F12', l: '닫기', act: 'map.go', data: { v: 'map' } }])}
        ${E().fields([
          { l: '수진자', txt: `${p.mrn} ${p.name}`, t: 'key' }, { l: '진료분야', txt: '입원', t: 'warn' }, { l: '진료의사', txt: H.M.doctor(e.doctorId).name }, { l: '공상', txt: p.ins.startsWith('산재') ? '유' : '무' }, { l: '청구번호', txt: cl ? cl.no : '-', t: 'key' }, { l: '접수번호', txt: cl && cl.status !== '송신' ? `${cl.no}-R` : '-', t: 'req' }, { l: '입원일자', txt: T.d(e.at) },
          { l: '피보험자', txt: `${i.holder} (${i.rel})` }, { l: '진료과', txt: e.dept, t: 'calc' }, { l: '마취의사', txt: op ? '윤태경' : '-', t: 'req' }, { l: '종별', txt: '1 상급종합' }, { l: '명세번호', txt: e.id.slice(-6).toUpperCase(), t: 'key' }, { l: '명세일련', txt: '1', t: 'req' }, { l: '신청구분', txt: ci.reclaim ? '보완 청구' : '원 신청' },
          { l: '보험유형', txt: p.ins, t: 'warn' }, { l: '분과', txt: e.dept, t: 'calc' }, { l: '주부소명', txt: '-' }, { l: '장애', txt: '-' }, { l: '청구구분', txt: cl ? '정상' : '청구 전', t: 'req' }, { l: '사유코드', txt: au.returned ? 'D (반송 예상)' : '-', t: 'req' }, { l: '보류심사', txt: ci.hold ? '보류' : '정상' },
        ])}
        <div class="erp-sec">상병 (POA = 입원 당시 있던 병인지)</div>
        ${E().grid([{ h: 'NO' }, { h: '상병코드' }, { h: '상병명 및 상세 설명' }, { h: 'POA' }, { h: '의증' }, { h: '특정기호' }, { h: '상해외인' }, { h: '수술' }, { h: '진료과' }, { h: '요양개시일' }, { h: '입원경로' }, { h: '진료결과' }],
          (e.dx || []).map((d, k) => [k + 1, `<span class="mono">${esc(d.code)}</span>`, `${d.main ? '<b>주)</b> ' : '부) '}${esc(d.name)}`, `<select name="poa_${k}" aria-label="POA">${POA.map((x) => `<option ${(ci.poa[k] || (d.main ? POA[0] : POA[0])) === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`, `<input type="checkbox" name="sus_${k}" ${ci['sus_' + k] ? 'checked' : ''} aria-label="의증">`, `<input name="spec_${k}" value="${esc(ci.spec[k] != null ? ci.spec[k] : d.main && p.special ? p.special.code : '')}" style="width:5rem" aria-label="특정기호">`, `<input name="inj_${k}" value="${esc(ci['inj_' + k] || (d.code.startsWith('S') ? 'V89 교통사고' : ''))}" style="width:7rem" aria-label="상해외인">`, op && d.main ? 'Y' : '', esc(e.dept), T.d(e.at), esc((e.adm || {}).route || (e.fromEnc ? '응급실' : '외래')), `<select name="res_${k}" aria-label="진료결과">${RESULT.map((x) => `<option ${(ci.res[k] || RESULT[5]) === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`]), { h: '10rem', empty: '상병 없음 — 반송 사유' })}
        ${E().fields([{ l: '초진', txt: '0' }, { l: '재진', txt: '0' }, { l: '야간공휴', txt: '0' }, { l: '재원일수', txt: String(H.fee.daysOf(e)) }, { l: '총진료일수', txt: String(H.fee.daysOf(e)) }, { l: '처방횟수', txt: String(lines.length) }, { l: '정률·정액', txt: p.ins.startsWith('의료급여 1종') ? '정액' : '정률', t: 'calc' }, { l: '진료기간', txt: `${T.d(e.at)}~${T.d(e.endAt || e.billed)}` }, { l: '도착경로', txt: (e.adm || {}).arrive || '기타', t: 'calc' }, { l: '입원경로', txt: (e.adm || {}).route || (e.fromEnc ? '응급실' : '외래'), t: 'calc' }, { l: 'DRG 코드', txt: S.where('orders', (o) => o.encId === e.id && ['O9003', 'O9005'].includes(o.code)).length ? (op && op.code === 'O9005' ? 'O0160 제왕절개' : 'G0880 충수절제') : '-' }, { l: '승인번호', txt: '-' }, { l: '사고순번', txt: p.payerInfo ? p.payerInfo.no : '-' }, { l: '진료개시일', txt: T.d(e.at) }])}
        <div class="erp-cols3" style="grid-template-columns:15rem minmax(0,1fr)">
          <div class="gap-s"><div class="erp-sec">항목 (기본·재료 / 행위료)</div>
            ${E().grid([{ h: '항목' }, { h: '기본·재료', n: 1 }, { h: '행위료', n: 1 }], [...new Set(lines.map((l) => l.group))].map((g) => ({ cells: [esc(g), won(sum((l) => l.group === g ? l.mat : 0)), won(sum((l) => l.group === g ? l.act : 0))], act: 'pr.grp', data: { g }, on: grp === g })), { h: '12rem' })}
            <div class="row" style="gap:.2rem">${['방사선결과지', '임상결과지', '수술기록지', '자격조회', '의약품조회', '사본출력'].map((x) => UI.btn(x, 'pr.doc', { size: 'sm', data: { k: x } })).join('')}</div>
            ${E().money([{ k: 'CT 총액', v: ct }, { k: 'MRI/PET 총액', v: mri }, { k: '소계', v: c.pay }, { k: '가산율 (상급종합)', v: '30%' }, { k: '총 진료비', v: c.total, cls: 'bold' }, { k: '본인부담금', v: c.self, cls: 'b' }, { k: '대불/열외/상한', v: 0 }, { k: '장애/결핵 지원', v: 0 }, { k: '조합(공단)부담금', v: c.ins, cls: 'p' }, { k: '선별급여 총액', v: 0 }, { k: '포괄수가', v: S.where('orders', (o) => o.encId === e.id && ['O9003', 'O9005'].includes(o.code)).length ? c.pay : 0 }, { k: '행위별 총진료비', v: c.pay }, { k: '보험100% 본인부담', v: 0 }])}</div>
          <div class="gap-s">${E().grid([{ h: 'F' }, { h: '처방일자' }, { h: '시간' }, { h: '그룹코드' }, { h: '싱글코드' }, { h: '표준코드' }, { h: 'C' }, { h: '수가명' }, { h: 'L/D' }, { h: '선별' }, { h: '1/2' }, { h: '산정' }, { h: '포괄' }, { h: '급외' }, { h: '적용단가', n: 1 }, { h: '보상' }, { h: 'RP' }, { h: '1회량' }, { h: '횟수' }, { h: 'DAY' }, { h: '계산', n: 1 }],
            lines.filter((l) => !grp || l.group === grp).map((l) => { const o = l.orderId ? S.get('orders', l.orderId) : null; const flag = o && au.items.find((x) => x.orderId === o.id); return { cells: [flag ? '<b style="color:var(--t-stat)">!</b>' : o && o.annot ? '<b style="color:var(--t-sent)">주</b>' : '', o ? T.d(o.at) : T.d(e.at), o ? T.hm(o.at) : '', esc(l.group.slice(0, 4)), `<span class="mono">${esc(l.single)}</span>`, `<span class="mono">${esc(l.edi)}</span>`, l.mat ? '재' : '행', `${esc(l.name)}${flag ? `<div class="small" style="color:var(--t-stat)">${esc(flag.reason)}</div>` : ''}`, o && o.cat === 'INJ' ? 'L' : '', '', '', '', S.where('orders', (x) => x.encId === e.id && ['O9003', 'O9005'].includes(x.code)).length ? '포' : '', l.pay === '비급여' ? 'Y' : '', won(l.price), p.ins.startsWith('산재') || p.ins.startsWith('자동차') ? '보' : '', '', '1', String(l.qty), '1', won(l.amount)], act: o ? 'sv.line' : '', data: o ? { id: o.id } : {}, on: !!flag }; }), { h: '26rem' })}
            ${ci.rev1 ? UI.note(`심사 1 (${esc(ci.rev1.by)}): 삭감 예상 ${au.items.filter((x) => x.type === '삭감').length}건 ${won(au.cutTotal)}원${au.returned ? ' · 반송 예상' : ''}`, au.items.length ? 'warn' : 'ok') : ''}${ci.rev2 ? UI.note(`심사 2 (책임 심사자 ${esc(ci.rev2.by)}) 확인`, 'ok') : ''}${ci.done ? UI.note(`사후 심사 완료 ${T.mdhm(ci.done)} — 보험 심사·청구 화면에서 EDI 청구하세요`, 'ok') : ''}</div>
        </div></form>`;
    },
    acts: Object.assign({}, lineActs, {
      'map.go': (el) => A.go(el.dataset.v),
      'pr.sel': (el) => { set('sel', el.value); set('grp', ''); A.render(); },
      'pr.grp': (el) => { set('grp', ms('grp', '') === el.dataset.g ? '' : el.dataset.g); A.render(); },
      'pr.cur': () => { const list = S.where('encounters', (e) => e.billed && e.type === 'IPD').sort((a, b) => b.billed - a.billed); return list.find((x) => x.id === ms('sel', '')) || list[0]; },
      'pr.tab': (el) => { const e = H.mods.postreview.acts['pr.cur'](); A.st.dcreview = Object.assign(A.st.dcreview || {}, { sub: el.dataset.v, st: 'T', sel: e.id }); A.go('dcreview'); UI.toast('상병·주석 심사 화면 (퇴원 환자로 조회)', ''); },
      'pr.emr': () => { const e = H.mods.postreview.acts['pr.cur'](); UI.modal({ title: 'EMR', size: 'wide', body: S.where('notes', (n) => n.encId === e.id).map((n) => `<div class="box"><b>${esc(n.type)}</b> ${T.dhm(n.at)}<div class="small pre">${esc(Object.values(n.content).join('\n'))}</div></div>`).join('') || '기록 없음' }); },
      'pr.merge': () => UI.toast('합철: 같은 입원을 나눠 청구한 명세서(중간 청구)를 하나로 합칩니다 — 이 실습에서는 명세서 1개', ''),
      'pr.fee': () => { const e = H.mods.postreview.acts['pr.cur'](); UI.modal({ title: '수가 코드 (세부산정내역)', size: 'wide', body: H.fee.detail(H.fee.calc(e)) }); },
      'pr.doc': (el) => { const e = H.mods.postreview.acts['pr.cur'](); const p = H.pat(e.patientId); const k = el.dataset.k; UI.modal({ title: k, size: 'wide', body: k.startsWith('방사선') ? H.view.radList(p.id) : k.startsWith('임상') ? H.view.labCumulative(p.id) : k.startsWith('수술') ? (S.where('notes', (n) => n.encId === e.id && n.type === '수술기록').map((n) => `<div class="pre">${esc(Object.values(n.content).join('\n'))}</div>`).join('') || '수술 기록 없음') : k.startsWith('의약품') ? H.view.orderTable(S.where('orders', (o) => o.encId === e.id && (o.cat === 'MED' || o.cat === 'INJ'))) : k.startsWith('자격') ? `${esc(p.ins)} · ${esc(E().info(p).insCode)} · 자격 유지` : H.fee.receipt(H.fee.calc(e), null) }); },
      'pr.rev1': () => { const e = H.mods.postreview.acts['pr.cur'](); e.claimInfo.rev1 = { at: Date.now(), by: H.who() }; S.save(); UI.toast('1차 심사 — 삭감 예상 줄(!)을 눌러 조정하거나 주석을 다세요', 'ok'); A.render(); },
      'pr.rev2': () => { const e = H.mods.postreview.acts['pr.cur'](); if (!e.claimInfo.rev1) return UI.toast('심사 1을 먼저 하세요', 'warn'); e.claimInfo.rev2 = { at: Date.now(), by: H.who() }; S.save(); UI.toast('2차 심사 (책임 심사자 확인) 완료', 'ok'); A.render(); },
      'pr.approve': () => UI.toast('승인 요청: 고가 약제·사전 승인 항목은 심평원 사전 승인 번호가 필요합니다', ''),
      'pr.save': (f, d) => {
        const e = H.mods.postreview.acts['pr.cur'](); const ci = e.claimInfo;
        (e.dx || []).forEach((x, k) => { ci.poa[k] = d['poa_' + k]; ci.res[k] = d['res_' + k]; ci.spec[k] = d['spec_' + k]; ci['sus_' + k] = d['sus_' + k]; ci['inj_' + k] = d['inj_' + k]; });
        if (!ci.rev1) return UI.toast('심사 1(F3)을 먼저 하세요', 'warn');
        ci.done = Date.now(); ci.by = H.who(); S.save(); H.log('입원 사후 심사 완료', H.pat(e.patientId).name, e.patientId);
        UI.toast('사후 심사 완료 — 명세서 저장', 'ok'); A.render();
      },
    }),
  });

  // ───────── 재청구 · 이의신청 ─────────
  H.reg({
    id: 'reclaim', title: '재청구·이의신청', actor: '보험심사 간호사', layout: 'full', channels: () => ['review'],
    render() {
      const why = ms('why', '32'); const claims = S.all('claims');
      const ym = (t) => T.d(t).slice(0, 7);
      const rc = []; claims.forEach((c) => (c.returns || []).forEach((eid) => { const e = H.enc(eid); const p = H.pat(e.patientId); rc.push({ c, e, p, done: e.claimId !== c.id }); }));
      const ap = []; claims.forEach((c) => Object.entries(c.results || {}).forEach(([eid, r]) => (r.items || []).forEach((it, k) => { if (it.type === '삭감') ap.push({ c, e: H.enc(eid), it, k }); })));
      const sel = ms('rsel', {}) || {};
      return `<div class="erp">
        <div class="erp-sec">재청구</div>
        ${E().bar([`<select data-chg="rc.why" aria-label="재청구 사유"><option value="32" ${why === '32' ? 'selected' : ''}>32.심사불능 (반송)</option><option value="33" ${why === '33' ? 'selected' : ''}>33.보완 청구</option><option value="34" ${why === '34' ? 'selected' : ''}>34.추가 청구</option></select>`, '<select><option>1.청구년월차수</option></select>', `<span class="num">${ym(Date.now())}-01 ~ ${ym(Date.now())}-02</span>`, { fk: 'F6', l: '조회', act: 'rc.q' }, '|', { l: '전체 선택', act: 'rc.all', data: { v: 1 } }, { l: '전체 해제', act: 'rc.all', data: { v: 0 } }, { fk: 'F3', l: '재생성', act: 'rc.regen', kind: 'warn' }, { fk: 'F2', l: '저장', act: 'rc.save', kind: 'pri' }, { fk: 'F9', l: '출력', act: 'rc.print' }, { fk: 'F12', l: '닫기', act: 'map.go', data: { v: 'map' } }])}
        ${E().grid([{ h: '생성' }, { h: '처리' }, { h: '청구년월' }, { h: '청구번호' }, { h: '행/포' }, { h: 'NO' }, { h: '환자번호' }, { h: 'IX' }, { h: '진료과' }, { h: '수진자' }, { h: '구분' }, { h: '유형' }, { h: '보조유형' }, { h: '심사차수' }, { h: '접수번호' }, { h: '묶음' }, { h: '통보일자' }, { h: '조정액', n: 1 }, { h: '재청구금액', n: 1 }, { h: '사유' }, { h: '세부' }, { h: '생성할 차수' }],
          rc.map((r, k) => [`<input type="checkbox" data-chg="rc.sel" data-id="${r.e.id}" ${sel[r.e.id] ? 'checked' : ''} ${r.done ? 'disabled' : ''} aria-label="선택">`, r.done ? '재청구함' : (r.e.dx || []).length ? '보완됨' : '보완 필요', ym(r.c.at), esc(r.c.no), S.where('orders', (o) => o.encId === r.e.id && ['O9003', 'O9005'].includes(o.code)).length ? '포' : '행', k + 1, r.p.mrn, '1', esc(r.e.dept), esc(r.p.name), r.e.type === 'IPD' ? '입원' : '외래', esc(r.p.ins), esc(r.p.special ? r.p.special.code : ''), '1차', `${esc(r.c.no)}-R`, '1', T.d(r.c.at + DAY), won(H.fee.calc(r.e).ins), won(H.fee.calc(r.e).ins), 'D', esc(((r.c.returnReason || {})[r.e.id] || '').slice(0, 20)), '2차']), { h: '14rem', empty: '반송·심사불능 건이 없습니다' })}
        <div class="erp-sec">이의신청 (41.삭감 조정)</div>
        ${E().bar(['<select><option>41.삭감조정</option></select>', '<select><option>1.청구년월차수</option></select>', '<select><option>0.분야 전체</option></select>', '출력 <select><option>2.행위가산 적용</option></select>', { fk: 'F6', l: '조회', act: 'rc.q' }, { fk: 'F2', l: '저장', act: 'rc.save', kind: 'pri' }, { l: '닫기', act: 'map.go', data: { v: 'map' } }])}
        ${E().grid([{ h: '청구년월' }, { h: '접수번호' }, { h: '환자번호' }, { h: '청구번호' }, { h: 'IX' }, { h: 'NO' }, { h: '진료과' }, { h: '보험유형' }, { h: '수진자' }, { h: '의사명' }, { h: '심사차수' }, { h: '묶음번호' }, { h: '입원일자' }, { h: '퇴원일자' }, { h: '상병' }, { h: '줄번호' }, { h: 'EDI코드' }, { h: '삭감1' }, { h: '단가', n: 1 }, { h: '삭감2' }, { h: '1일량' }, { h: '표준명칭' }, { h: '일수' }, { h: '금액', n: 1 }, { h: '삭감액', n: 1 }, { h: '1/2' }, { h: '처리' }, { h: '이의신청1' }, { h: '인정액1', n: 1 }, { h: '이의신청2' }, { h: '인정액2', n: 1 }, { h: '약제신청' }, { h: '약제인정' }, { h: '청구일자' }, { h: '회수일자' }],
          ap.map(({ c, e, it, k }) => { const p = H.pat(e.patientId); const o = it.orderId ? S.get('orders', it.orderId) : null; const a1 = it.appeal, a2 = it.appeal2; const amt1 = a1 && a1.result ? (a1.result === '인정' ? it.cut : a1.result === '일부 인정' ? Math.round(it.cut / 2) : 0) : 0; const amt2 = a2 && a2.result ? (a2.result === '인정' ? it.cut - amt1 : 0) : 0;
            return [ym(c.at), `${esc(c.no)}-R`, p.mrn, esc(c.no), '1', k + 1, esc(e.dept), esc(p.ins), esc(p.name), esc(H.M.doctor(e.doctorId).name), '1차', '1', T.d(e.at), e.endAt ? T.d(e.endAt) : '', esc(((e.dx || []).find((d) => d.main) || {}).code || ''), k + 1, `<span class="mono">${esc(o ? H.erp.lineDetail({ code: o.code, orderId: o.id, amount: 0, price: 0 }).edi : '')}</span>`, esc(it.code), o ? won(H.M.item(o.code).price) : '', '', '1', esc(it.name), '1', won(it.cut), won(it.cut), '', it.accepted ? '수용' : a1 ? '이의신청' : '대기',
              a1 ? (a1.result ? `${a1.result}` : `${UI.btn('결과 수신', 'rc.res1', { size: 'sm', data: { c: c.id, e: e.id, i: k } })}`) : it.accepted ? '' : UI.btn('1차 신청', 'rc.ap1', { size: 'sm', kind: 'warn', data: { c: c.id, e: e.id, i: k } }), won(amt1),
              a1 && a1.result && a1.result !== '인정' ? (a2 ? (a2.result || UI.btn('결과 수신', 'rc.res2', { size: 'sm', data: { c: c.id, e: e.id, i: k } })) : UI.btn('2차 (심판청구)', 'rc.ap2', { size: 'sm', kind: 'warn', data: { c: c.id, e: e.id, i: k } })) : '', won(amt2), o && (o.cat === 'MED' || o.cat === 'INJ') ? 'Y' : '', '', T.d(c.at), a1 && a1.resAt ? T.d(a1.resAt + 30 * DAY) : ''];
          }), { h: '18rem', empty: '삭감 건이 없습니다 — 보험 심사·청구 화면에서 EDI 청구 → 심사결과 수신 뒤에 생깁니다' })}
        ${UI.note('이의신청 1차: 심평원에 90일 안에 근거 자료와 함께 신청 → 기각되면 2차: 건강보험분쟁조정위원회에 심판청구 (90일 안). 인정된 금액은 다음 지급 때 돌려받고(회수일자), 재청구는 반송·심사불능 건을 보완해서 다시 보냅니다.', 'info')}
      </div>`;
    },
    acts: {
      'map.go': (el) => A.go(el.dataset.v),
      'rc.why': (el) => { set('why', el.value); A.render(); },
      'rc.q': () => { A.render(); UI.toast('조회', ''); },
      'rc.sel': (el) => { const s = ms('rsel', {}) || {}; s[el.dataset.id] = el.checked; set('rsel', s); },
      'rc.all': (el) => { const s = {}; if (el.dataset.v === '1') S.all('claims').forEach((c) => (c.returns || []).forEach((id) => { if (H.enc(id).claimId === c.id) s[id] = true; })); set('rsel', s); A.render(); },
      'rc.regen': () => {
        const ids = Object.entries(ms('rsel', {}) || {}).filter(([, v]) => v).map(([k]) => k); if (!ids.length) return UI.toast('재청구할 건을 고르세요', 'warn');
        const bad = ids.filter((id) => !(H.enc(id).dx || []).length); if (bad.length) return UI.toast(`상병이 아직 없는 건 ${bad.length}개 — 퇴원 심사에서 상병을 보완하세요`, 'err');
        const amount = ids.reduce((s, id) => s + H.fee.calc(H.enc(id)).ins, 0);
        const no = `${T.d(Date.now()).replace(/-/g, '').slice(2, 6)}-${String(S.all('claims').length + 1).padStart(3, '0')}`;
        const c = S.add('claims', { id: H.uid('cl'), no, encIds: ids, at: Date.now(), amount, status: '송신', by: H.who(), reclaim: true });
        ids.forEach((id) => { const e = H.enc(id); e.claimId = c.id; e.claimInfo = Object.assign(e.claimInfo || { poa: {}, res: {}, spec: {} }, { reclaim: true }); });
        S.save(); set('rsel', {}); H.log('재청구', `${no} ${ids.length}건`); UI.toast(`재청구 ${no} 생성·송신 — 보험 심사·청구 화면 EDI 탭에서 접수증을 받으세요`, 'ok'); A.render();
      },
      'rc.save': () => UI.toast('저장', 'ok'),
      'rc.print': () => UI.toast('재청구 목록 출력 (미리보기 생략)', ''),
      'rc.ap1': (el) => openAppeal(el, 1), 'rc.ap2': (el) => openAppeal(el, 2),
      'rc.apGo': (f, d) => {
        const c = S.get('claims', d.c); const it = c.results[d.e].items[Number(d.i)];
        if ((d.why || '').length < 10) return UI.toast('사유를 구체적으로 써 주세요', 'warn');
        it[d.n === '2' ? 'appeal2' : 'appeal'] = { why: d.why, ev: d.ev || [], at: Date.now(), by: H.who() }; S.save(); UI.close(); UI.toast(`${d.n}차 이의신청 제출`, 'ok'); A.render();
      },
      'rc.res1': (el) => resolve(el, 'appeal'), 'rc.res2': (el) => resolve(el, 'appeal2'),
    },
  });
  function openAppeal(el, n) {
    const c = S.get('claims', el.dataset.c); const it = c.results[el.dataset.e].items[Number(el.dataset.i)];
    UI.modal({ title: `${n}차 ${n === 1 ? '이의신청 (심평원)' : '심판청구 (건강보험분쟁조정위원회)'} — ${it.name}`, body: `<form data-submit="rc.apGo" class="gap-m"><input type="hidden" name="c" value="${c.id}"><input type="hidden" name="e" value="${el.dataset.e}"><input type="hidden" name="i" value="${el.dataset.i}"><input type="hidden" name="n" value="${n}">
      ${UI.note(`삭감 사유: ${esc(it.reason)} · ${H.won(it.cut)}`, 'warn')}${n === 2 && it.appeal ? UI.note(`1차 결과: ${esc(it.appeal.result)}`, 'info') : ''}
      ${UI.textarea('why', '신청 사유 (의학적 근거)', '', { h: '6rem' })}
      <div class="fld"><span class="lbl">첨부 자료</span><div class="gap-s">${['진료기록 (경과기록)', '검사 결과지', '활력징후 기록', '의사 소견서', '관련 학회 지침·논문'].map((t) => UI.check('ev', t, false, { multi: true, value: t })).join('')}</div></div>
      <div class="btn-row end">${UI.btn('제출', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
  }
  function resolve(el, key) {
    const c = S.get('claims', el.dataset.c); const it = c.results[el.dataset.e].items[Number(el.dataset.i)]; const ap = it[key];
    const strong = ap.why.length >= 30 && ap.ev.length >= 2 && ap.ev.some((x) => /진료기록|검사/.test(x));
    ap.result = strong ? '인정' : key === 'appeal' && ap.ev.length >= 1 ? '일부 인정' : '기각'; ap.resAt = Date.now(); S.save();
    UI.toast(`결과: ${ap.result}`, ap.result === '기각' ? 'err' : 'ok'); A.render();
  }
})();

// 재청구와 이의신청을 각각의 메뉴(화면)로 나눔 — 실제 병원에서도 서로 다른 화면
(function () {
  const H = window.H;
  const m = H.mods.reclaim; if (!m) return;
  const base = m.render; const MK = '<div class="erp-sec">이의신청';
  m.title = '재청구';
  m.render = function () { const h = base.call(this); const i = h.indexOf(MK); return i < 0 ? h : h.slice(0, i) + '</div>'; };
  H.reg(Object.assign({}, m, { id: 'appeal', title: '이의신청', render() { const h = base.call(this); const i = h.indexOf(MK); return i < 0 ? h : '<div class="erp">' + h.slice(i); } }));
})();
