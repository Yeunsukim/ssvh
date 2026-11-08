// 보험 심사: 퇴원 심사(사전) → 청구 명세서 → EDI 송신 → 접수·심사결과 수신 → 반송·삭감·이의신청 → 통계
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const FE = () => H.fee;
  const won = (n) => H.won(n);
  const NHIS = /국민건강보험|의료급여/;
  const pName = (e) => { const p = H.pat(e.patientId); return `<b>${esc(p.name)}</b> <span class="small muted">${H.sexAge(p)} · ${esc(p.ins)}</span>`; };

  // ── 퇴원 심사 ──
  function checks(e) {
    const c = FE().calc(e); const au = FE().audit(e);
    const hasNote = (t) => S.where('notes', (n) => n.encId === e.id && n.type === t).length > 0;
    const op = S.where('orders', (o) => o.encId === e.id && o.cat === 'OP' && !H.flow.isOff(o));
    return [
      ['진단명(상병) 기재', (e.dx || []).length > 0, '의사에게 진단명 추가 요청'],
      ['시행 안 된 처방 정리', c.pending.length === 0, `${c.pending.length}건 남음 — 시행 또는 취소 필요`],
      ['병동 퇴원 준비·교육 완료', !!(e.dc && e.dc.ward), '병동에 확인'],
      ['수술 기록 작성 (수술 환자)', !op.length || op.every((o) => o.op && o.op.note) || hasNote('수술기록'), '집도의에게 수술 기록 요청'],
      ['퇴원요약 작성', hasNote('퇴원요약'), '없으면 퇴원 뒤 의료정보팀 미비로 관리'],
      ['산정특례·자격 적용 확인', !c.r.warn, c.r.warn || ''],
      ['사전 심사 (삭감 예상 항목)', !au.items.length, au.items.map((x) => `${x.name}: ${x.reason}`).join(' / ')],
    ];
  }
  function tabDc() {
    const list = S.where('encounters', (e) => e.dc && !e.dc.review && e.status === '입원중');
    return `<div class="gap-m">${UI.note('퇴원 심사: 퇴원 전에 진료비가 기준에 맞게 계산되었는지, 빠진 기록·처방은 없는지 미리 확인합니다. 여기서 걸러 내면 나중에 삭감·반송이 줄어듭니다.', 'info')}
      ${list.map((e) => { const ck = checks(e); const must = ck[0][1] && ck[1][1]; const c = FE().calc(e);
        return `<div class="panel"><div class="panel-h">${pName(e)}<span class="grow"></span>${UI.chip(`${e.ward} ${e.room}-${e.bed}`, 'plain')}${UI.chip(`진료비 ${won(c.total)}`, 'sent')}</div><div class="panel-b gap-m">
          ${UI.table([{ h: '확인 항목' }, { h: '결과' }, { h: '할 일' }], ck.map(([t, ok, todo]) => [esc(t), ok ? UI.chip('적합', 'done') : UI.chip('확인 필요', 'stat'), ok ? '' : `<span class="small">${esc(todo)}</span>`]))}
          <form data-submit="rv.dcDone" class="row"><input type="hidden" name="id" value="${e.id}">${UI.input('memo', '심사 메모', '', { cls: 'grow' })}
            ${UI.btn('의사에게 보완 요청', 'rv.ask', { data: { id: e.id } })}${UI.btn('퇴원 심사 완료 → 원무', '', { type: 'submit', kind: 'pri', disabled: !must })}</form>
          ${!must ? '<p class="small muted" style="margin:0">진단명과 처방 정리는 꼭 끝나야 심사를 마칠 수 있습니다.</p>' : ''}</div></div>`; }).join('') || UI.empty('퇴원 심사할 환자가 없습니다', '의사가 입원 진료에서 "퇴원 결정"을 하면 여기에 나타납니다.')}</div>`;
  }

  // ── 청구 명세서 ──
  const claimable = () => S.where('encounters', (e) => e.billed && !e.claimId && NHIS.test(FE().rateInfo(H.pat(e.patientId), e).payer));
  function stmt(e) {
    const c = FE().calc(e); const p = c.p;
    const pay = c.lines.filter((l) => l.pay);
    return `<div class="paper"><h2>요양급여비용 명세서</h2><style>.paper td.r{text-align:right;font-family:var(--mono)}</style>
      <table><tr><th>요양기관</th><td>SSV 병원 (상급종합, 가상 기호 1236xxxx)</td><th>보험 종류</th><td>${esc(p.ins)}</td></tr>
      <tr><th>수진자</th><td>${esc(p.name)} (${H.sexAge(p)})</td><th>진료 형태</th><td>${e.type === 'IPD' ? '입원' : '외래'} · ${esc(e.dept)}</td></tr>
      <tr><th>진료 기간</th><td>${T.d(e.at)} ~ ${T.d(e.endAt || e.billed)}</td><th>상병</th><td>${(e.dx || []).map((d) => `${d.main ? '주) ' : '부) '}<span class="mono">${esc(d.code)}</span> ${esc(d.name)}`).join('<br>') || '<b style="color:#C21F2B">상병 없음</b>'}</td></tr>
      <tr><th>특정 기호</th><td>${esc(p.special ? p.special.code : '-')}</td><th>적용</th><td>${esc(c.r.notes.join(' / ') || '-')}</td></tr></table>
      <table style="margin-top:.6rem"><thead><tr><th>코드</th><th>명칭</th><th>단가</th><th>횟수</th><th>금액</th></tr></thead><tbody>
      ${pay.map((l) => `<tr><td class="mono">${esc(l.code)}</td><td>${esc(l.name)}</td><td class="r">${won(l.price)}</td><td class="r">${l.qty}</td><td class="r">${won(l.amount)}</td></tr>`).join('')}</tbody></table>
      <table style="margin-top:.6rem"><tr><th>요양급여비용 총액</th><td class="r">${won(c.pay)}</td><th>본인 일부부담금</th><td class="r">${won(c.self)}</td><th>청구액</th><td class="r"><b>${won(c.ins)}</b></td></tr></table></div>`;
  }
  function tabStmt() {
    const list = claimable();
    return `<div class="gap-m">${UI.note('수납이 끝난 건강보험·의료급여 환자의 진료 내역으로 "요양급여비용 명세서"를 만들어 건강보험심사평가원(심평원)에 청구합니다. 산재·자동차보험은 원무 "계약처 청구"에서 따로 청구합니다.', 'info')}
      <form data-submit="rv.send">${UI.table([{ h: '선택' }, { h: '환자' }, { h: '구분' }, { h: '진료 기간' }, { h: '주상병' }, { h: '청구액', cls: 'num' }, { h: '' }], list.map((e) => { const c = FE().calc(e); const main = (e.dx || []).find((d) => d.main) || (e.dx || [])[0];
        return [`<input type="checkbox" name="ids" data-multi="1" value="${e.id}" checked style="width:1.4rem;height:1.4rem" aria-label="선택">`, pName(e), { OPD: '외래', ER: '응급', IPD: '입원' }[e.type], `<span class="small num">${T.md(e.at)}~${T.md(e.endAt || e.billed)}</span>`,
          main ? `<span class="mono small">${esc(main.code)}</span> ${esc(main.name)}` : UI.chip('상병 없음', 'stat'), `<span class="num">${won(c.ins)}</span>`, UI.btn('명세서', 'rv.stmt', { size: 'sm', data: { id: e.id } })]; }), { empty: UI.empty('청구할 명세서가 없습니다', '원무에서 수납을 마친 환자가 여기에 나타납니다.') })}
      ${list.length ? `<div class="btn-row end" style="margin-top:.8rem">${UI.btn('선택한 명세서 EDI로 청구 (심평원 송신)', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'send' })}</div>` : ''}</form></div>`;
  }

  // ── EDI ──
  function tabEdi() {
    const list = S.all('claims').slice().sort((a, b) => b.at - a.at);
    return `<div class="gap-m">${UI.note('EDI(전자문서교환): 병원 청구 프로그램이 심평원에 명세서를 전자로 보냅니다. ① 송신 → ② 접수증 수신 (형식 오류는 이때 "반송") → ③ 심사결과 통보 수신 (인정·삭감) → ④ 공단이 병원에 돈을 지급합니다.', 'info')}
      ${UI.table([{ h: '청구 번호' }, { h: '송신' }, { h: '명세서', cls: 'num' }, { h: '청구액', cls: 'num' }, { h: '상태' }, { h: '결과' }, { h: '' }], list.map((c) => {
        const r = c.results || {}; const cut = Object.values(r).reduce((s, x) => s + (x.cut || 0), 0);
        return [`<span class="mono">${esc(c.no)}</span>`, `<span class="num small">${T.mdhm(c.at)}</span>`, `<span class="num">${c.encIds.length}건</span>`, `<span class="num">${won(c.amount)}</span>`,
          UI.chip(c.status, c.status === '심사완료' ? 'done' : c.status === '접수' ? 'prog' : 'sent'),
          c.status === '심사완료' ? `인정 ${won(c.amount - cut - (c.returnAmt || 0))} · 삭감 ${won(cut)}${c.returns && c.returns.length ? ` · 반송 ${c.returns.length}건` : ''}` : c.returns && c.returns.length ? `반송 ${c.returns.length}건` : '-',
          c.status === '송신' ? UI.btn('접수증 수신', 'rv.recv', { size: 'sm', kind: 'pri', data: { id: c.id } }) : c.status === '접수' ? UI.btn('심사결과 통보 수신', 'rv.result', { size: 'sm', kind: 'pri', data: { id: c.id } }) : ''];
      }), { empty: UI.empty('보낸 청구가 없습니다') })}</div>`;
  }

  // ── 삭감·반송·이의신청 ──
  function tabCut() {
    const rows = [];
    S.all('claims').forEach((c) => {
      (c.returns || []).forEach((eid) => { const e = H.enc(eid); rows.push({ group: `반송 — ${H.pat(e.patientId).name} (${esc(c.no)})` }); rows.push([UI.chip('반송', 'stat'), '명세서 전체', esc((c.returnReason || {})[eid] || '형식 오류'), `<span class="num">${won(FE().calc(e).ins)}</span>`, e.claimId === c.id ? UI.btn('보완 후 재청구', 'rv.resend', { size: 'sm', kind: 'pri', data: { id: eid } }) : UI.chip('재청구함', 'done')]); });
      Object.entries(c.results || {}).forEach(([eid, r]) => (r.items || []).forEach((it, i) => {
        if (it.type !== '삭감') return;
        const e = H.enc(eid);
        rows.push([UI.chip(`${it.code} 사유`, 'prog'), `${esc(H.pat(e.patientId).name)} · ${esc(it.name)}`, `<span class="small">${esc(it.reason)}</span>`, `<span class="num">${won(it.cut)}</span>`,
          it.appeal ? (it.appeal.result ? UI.chip(`이의신청 ${it.appeal.result}`, it.appeal.result === '기각' ? 'stat' : 'done') : `${UI.chip('이의신청 중', 'sent')} ${UI.btn('결과 수신', 'rv.appealRes', { size: 'sm', data: { c: c.id, e: eid, i } })}`)
            : it.accepted ? UI.chip('수용', 'plain') : `<div class="row" style="flex-wrap:nowrap;gap:.3rem">${UI.btn('수용', 'rv.accept', { size: 'sm', data: { c: c.id, e: eid, i } })}${UI.btn('이의신청', 'rv.appeal', { size: 'sm', kind: 'warn', data: { c: c.id, e: eid, i } })}</div>`]);
      }));
    });
    return `<div class="gap-m">${UI.note('삭감: 심평원이 기준에 맞지 않는다고 판단해 돈을 깎은 것 (A: 의학적 타당성, B: 산정 기준, C: 중복, D: 상병 누락). 반송: 형식 오류로 접수조차 안 된 것. 삭감이 부당하면 근거를 붙여 90일 안에 이의신청할 수 있습니다.', 'info')}
      ${UI.table([{ h: '구분' }, { h: '환자·항목' }, { h: '사유' }, { h: '금액', cls: 'num' }, { h: '처리' }], rows, { empty: UI.empty('삭감·반송 건이 없습니다') })}</div>`;
  }
  function tabStat() {
    const cs = S.all('claims'); const amount = cs.reduce((s, c) => s + c.amount, 0);
    let cut = 0, back = 0; const byCode = {};
    cs.forEach((c) => { Object.values(c.results || {}).forEach((r) => (r.items || []).forEach((it) => { if (it.type === '삭감') { const v = it.appeal && it.appeal.result === '인정' ? 0 : it.appeal && it.appeal.result === '일부 인정' ? it.cut / 2 : it.cut; cut += v; byCode[it.code] = (byCode[it.code] || 0) + v; } })); back += c.returnAmt || 0; });
    const rate = amount ? ((cut / amount) * 100).toFixed(2) : '0.00';
    const max = Math.max(1, ...Object.values(byCode));
    return `<div class="gap-m"><div class="grid3"><div class="box"><div class="small muted">총 청구액</div><div class="score-big">${won(amount)}</div></div><div class="box"><div class="small muted">삭감액 (이의신청 반영)</div><div class="score-big" style="color:var(--t-stat)">${won(Math.round(cut))}</div></div><div class="box"><div class="small muted">삭감률</div><div class="score-big">${rate}%</div><div class="small muted">반송 ${won(back)}</div></div></div>
      <div class="panel"><div class="panel-h"><h3>사유별 삭감</h3></div><div class="panel-b gap-s">${Object.entries(byCode).map(([k, v]) => `<div class="row"><span style="width:9rem">${{ A: 'A 의학적 타당성', B: 'B 산정 기준', C: 'C 중복 청구', D: 'D 상병 누락' }[k] || k}</span><span style="flex:1;background:var(--surface-3);border-radius:4px;height:1.2rem"><span style="display:block;height:100%;width:${(v / max) * 100}%;background:var(--t-prog);border-radius:4px"></span></span><span class="num" style="width:7rem;text-align:right">${won(Math.round(v))}</span></div>`).join('') || '<p class="muted">아직 없습니다</p>'}</div></div></div>`;
  }

  H.reg({
    id: 'review', title: '보험 심사·청구', actor: '보험심사 간호사', layout: 'full',
    channels: () => ['review'],
    render() {
      const tab = A.ms('tab', 'dc');
      const n = { dc: S.where('encounters', (e) => e.dc && !e.dc.review && e.status === '입원중').length, stmt: claimable().length, edi: S.where('claims', (c) => c.status !== '심사완료').length };
      return `<div class="panel">${UI.tabs('rv.tab', [{ id: 'dc', label: '퇴원 심사', icon: 'clip', cnt: n.dc || '' }, { id: 'stmt', label: '청구 명세서', icon: 'doc', cnt: n.stmt || '' }, { id: 'edi', label: 'EDI 송수신', icon: 'send', cnt: n.edi || '' }, { id: 'cut', label: '삭감·반송·이의신청', icon: 'alert' }, { id: 'stat', label: '청구 통계', icon: 'list' }], tab)}
        <div class="panel-b">${{ dc: tabDc, stmt: tabStmt, edi: tabEdi, cut: tabCut, stat: tabStat }[tab]()}</div></div>`;
    },
    acts: {
      'rv.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'rv.ask': (el) => { const e = H.enc(el.dataset.id); const p = H.pat(e.patientId); const miss = checks(e).filter((x) => !x[1]).map((x) => x[0]); H.notify('doctor', `심사팀 보완 요청: ${p.name} — ${miss.join(', ')}`, { patientId: p.id }); UI.toast('의사에게 보완을 요청했습니다', 'ok'); },
      'rv.dcDone': (f, d) => { const e = H.enc(d.id); const p = H.pat(e.patientId); e.dc.review = { at: Date.now(), by: H.who(), memo: d.memo }; S.save(); H.notify('billing', `퇴원 심사 완료: ${p.name} — 퇴원 수납 가능`, { patientId: p.id }); H.log('퇴원 심사 완료', p.name, p.id); UI.toast('퇴원 심사 완료 — 원무 수납으로 넘어갑니다', 'ok'); A.render(); },
      'rv.stmt': (el) => UI.modal({ title: '요양급여비용 명세서', size: 'wide', body: stmt(H.enc(el.dataset.id)) }),
      'rv.send': (f, d) => {
        const ids = d.ids || []; if (!ids.length) return UI.toast('청구할 명세서를 고르세요', 'warn');
        const amount = ids.reduce((s, id) => s + FE().calc(H.enc(id)).ins, 0);
        const no = `${T.d(Date.now()).replace(/-/g, '').slice(2, 6)}-${String(S.all('claims').length + 1).padStart(3, '0')}`;
        const c = S.add('claims', { id: H.uid('cl'), no, encIds: ids, at: Date.now(), amount, status: '송신', by: H.who() });
        ids.forEach((id) => { H.enc(id).claimId = c.id; }); S.save();
        H.log('EDI 청구 송신', `${no} ${ids.length}건 ${won(amount)}`); UI.toast(`청구 ${no} — ${ids.length}건 ${won(amount)} 송신`, 'ok'); A.set('tab', 'edi'); A.render();
      },
      'rv.recv': (el) => {
        const c = S.get('claims', el.dataset.id); c.status = '접수'; c.returns = []; c.returnReason = {}; c.returnAmt = 0;
        c.encIds.forEach((id) => { const a = FE().audit(H.enc(id)); const r = a.items.find((x) => x.type === '반송'); if (r) { c.returns.push(id); c.returnReason[id] = r.reason; c.returnAmt += FE().calc(H.enc(id)).ins; } });
        S.save(); UI.toast(`접수증 수신 — 접수 ${c.encIds.length - c.returns.length}건${c.returns.length ? `, 반송 ${c.returns.length}건` : ''}`, c.returns.length ? 'warn' : 'ok'); A.render();
      },
      'rv.result': (el) => {
        const c = S.get('claims', el.dataset.id); c.status = '심사완료'; c.results = {};
        c.encIds.filter((id) => !c.returns.includes(id)).forEach((id) => { const a = FE().audit(H.enc(id)); c.results[id] = { items: a.items.filter((x) => x.type === '삭감'), cut: a.cutTotal }; });
        S.save(); const cut = Object.values(c.results).reduce((s, x) => s + x.cut, 0);
        H.log('심사결과 수신', `${c.no} 삭감 ${won(cut)}`); UI.toast(`심사결과 수신 — 삭감 ${won(cut)}${cut ? ' (삭감·반송 탭에서 처리)' : ''}`, cut ? 'warn' : 'ok'); A.render();
      },
      'rv.resend': (el) => {
        const e = H.enc(el.dataset.id); if (!(e.dx || []).length) return UI.toast('아직 상병이 없습니다 — 의사에게 진단명 추가를 요청하세요', 'err');
        e.claimId = null; S.save(); UI.toast('보완 완료 — 청구 명세서 탭에서 다시 청구하세요', 'ok'); A.set('tab', 'stmt'); A.render();
      },
      'rv.accept': (el) => { const c = S.get('claims', el.dataset.c); c.results[el.dataset.e].items[Number(el.dataset.i)].accepted = true; S.save(); UI.toast('삭감 수용', 'ok'); A.render(); },
      'rv.appeal': (el) => {
        const c = S.get('claims', el.dataset.c); const it = c.results[el.dataset.e].items[Number(el.dataset.i)];
        UI.modal({ title: `이의신청 — ${it.name}`, body: `<form data-submit="rv.appealGo" class="gap-m"><input type="hidden" name="c" value="${c.id}"><input type="hidden" name="e" value="${el.dataset.e}"><input type="hidden" name="i" value="${el.dataset.i}">
          ${UI.note(`삭감 사유: ${esc(it.reason)} · ${won(it.cut)}`, 'warn')}
          ${UI.textarea('why', '이의신청 사유 (의학적 근거를 구체적으로)', '', { h: '6rem', ph: '예: 입원 당시 체온 39℃, 혈압 저하가 있어 패혈증을 의심하여 시행함. 첨부한 활력징후 기록과 경과기록 참조.' })}
          <div class="fld"><span class="lbl">첨부 자료</span><div class="gap-s">${['진료기록 (경과기록)', '검사 결과지', '활력징후 기록', '의사 소견서', '관련 학회 지침'].map((t) => UI.check('ev', t, false, { multi: true, value: t })).join('')}</div></div>
          <div class="btn-row end">${UI.btn('이의신청 제출', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
      },
      'rv.appealGo': (f, d) => { const c = S.get('claims', d.c); const it = c.results[d.e].items[Number(d.i)]; if ((d.why || '').length < 10) return UI.toast('사유를 구체적으로 써 주세요', 'warn'); it.appeal = { why: d.why, ev: d.ev || [], at: Date.now(), by: H.who() }; S.save(); UI.close(); UI.toast('이의신청을 제출했습니다', 'ok'); A.render(); },
      'rv.appealRes': (el) => {
        const c = S.get('claims', el.dataset.c); const it = c.results[el.dataset.e].items[Number(el.dataset.i)]; const ap = it.appeal;
        const strong = ap.why.length >= 30 && ap.ev.length >= 2 && ap.ev.some((x) => /진료기록|검사/.test(x));
        ap.result = strong ? '인정' : ap.ev.length >= 1 ? '일부 인정' : '기각'; ap.resAt = Date.now(); S.save();
        UI.toast(`이의신청 결과: ${ap.result}${ap.result === '기각' ? ' — 근거 자료가 부족했습니다' : ''}`, ap.result === '기각' ? 'err' : 'ok'); A.render();
      },
    },
  });
})();
