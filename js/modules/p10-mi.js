// 의료정보팀 실무 화면 — 퇴원분석(I), 진료분석(퇴원분석·진단분류·시술분류·암등록), 퇴원진단명 관리, 미비등록
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
  const sec = (t) => `<div class="erp-sec" style="color:var(--fg)">☞ ${esc(t)}</div>`;

  const ipds = (st) => S.where('encounters', (e) => e.type === 'IPD' && (!st || st.includes(e.status))).sort((a, b) => (b.endAt || b.at) - (a.endAt || a.at));
  const doc = (id) => (H.M.doctor(id) || { name: '-' }).name;
  const mi = (e) => (e.mi = e.mi || {});
  const notesOf = (e, t) => S.where('notes', (n) => n.encId === e.id && (!t || n.type === t)).sort((a, b) => a.at - b.at);
  const ordersOf = (e, cat) => S.where('orders', (o) => o.encId === e.id && (!cat || o.cat === cat) && !H.flow.isOff(o));

  // ── 진료 기록에서 자동으로 계산하는 값 (데이터 연계) ──
  function auto(e) {
    const p = H.pat(e.patientId);
    const prev = S.where('encounters', (x) => x.patientId === p.id && x.type === 'IPD' && x.at < e.at).sort((a, b) => b.at - a.at);
    const er = S.where('encounters', (x) => x.patientId === p.id && x.type === 'ER' && x.at <= e.at && e.at - x.at < DAY).length;
    const ops = ordersOf(e, 'OP'); const blood = ordersOf(e, 'BLOOD');
    const firstOp = ops.map((o) => o.at).sort()[0];
    const dc = e.dc || {};
    return {
      route: er ? '응급실' : e.arrival && /전원/.test(e.arrival) ? '전원' : '외래',
      visit: /전원/.test(e.arrival || '') ? '타병원 의뢰' : S.where('refs', (r) => r.pid === p.id && r.dir === 'in').length ? '의원 의뢰' : er ? '119·직접 내원' : '직접 내원',
      days: H.fee.daysOf(e), times: prev.length + 1,
      readmit: !!(prev[0] && prev[0].endAt && e.at - prev[0].endAt <= 30 * DAY),
      preop: firstOp ? Math.max(0, Math.round((firstOp - e.at) / DAY)) : '',
      ops: ops.length, blood: blood.length ? `${blood.length}단위` : '', allergy: (p.allergies || []).length > 0,
      cancer: (e.dx || []).some((d) => /^C/.test(d.code)), infect: !!(p.flags && p.flags.isolation),
      result: dc.result || (e.status === '퇴원' ? '경쾌' : ''), form: dc.form || (e.status === '퇴원' ? '퇴원지시 후 퇴원' : ''), dest: dc.dest || (e.status === '퇴원' ? '자택' : ''),
      death: dc.form === '사망',
    };
  }
  const OPT = { route: ['외래', '응급실', '전원', '기타'], visit: ['직접 내원', '119·직접 내원', '의원 의뢰', '타병원 의뢰', '기타'], result: ['완쾌', '경쾌', '미쾌', '치료 안 함', '진단만', '사망'], form: ['퇴원지시 후 퇴원', '자의 퇴원', '전원', '탈원', '사망'], dest: ['자택', '타 병원', '요양병원', '요양시설', '기타'], wound: ['', '청결', '청결-오염', '오염', '불결'], born: ['', '단태아', '쌍태아 이상'], deathType: ['', '48시간 이내', '48시간 이후', '수술 중 사망'] };

  // ═════════ 퇴원분석(I) ═════════
  function dc1Form(e) {
    const p = H.pat(e.patientId); const i = E().info(p); const a = auto(e); const v = Object.assign({}, a, mi(e).dc1 || {});
    const sel = (l, n, t) => ({ l, n, opts: OPT[n === 'dtype' ? 'deathType' : n] || OPT[n], v: v[n], t });
    return `<form data-submit="mi.dc1save" class="gap-s"><input type="hidden" name="id" value="${e.id}">
      <div class="row between">${E().bar([{ l: '퇴원분석(II)', act: 'mi.to', data: { v: 'mi-anal', t: 'dx', id: e.id } }, { l: '퇴원분석(III)', act: 'mi.to', data: { v: 'mi-anal', t: 'op', id: e.id } }, { l: '미비등록', act: 'mi.to', data: { v: 'mi-def', id: e.id } }, { l: '암 등록', act: 'mi.to', data: { v: 'mi-anal', t: 'ca', id: e.id } }, { l: 'EMR', act: 'mi.emr', data: { id: e.id } }])}
        <div class="gap-s">${ck('done1', mi(e).dc1Done, '퇴원분석(I) 입력완료')}${ck('defOk', mi(e).defOk, '미비체크 완료')}</div></div>
      ${sec('환자기본 정보')}${E().fields([{ l: '환자명', txt: p.name, t: 'key' }, { l: '주민번호', txt: i.rrn }, { l: '연령', txt: `${H.age(p.birth)}세` }, { l: '성별', txt: p.sex === 'M' ? '남' : '여' },
        { l: '외국인', html: ck('foreign', false) }, { l: '직업', n: 'job', v: v.job || '', opts: ['', '사무직', '서비스직', '농업', '학생', '주부', '무직', '기타'] }, { l: '종교', n: 'rel', v: v.rel || '', opts: ['', '없음', '기독교', '천주교', '불교', '기타'] }, { l: '혈액형', txt: p.blood || '-' },
        { l: '전화번호', txt: p.phone || '-' }, { l: '보험종별', txt: p.ins, t: 'warn' }, { l: '키', txt: p.height ? `${p.height}cm` : '-' }, { l: '몸무게', txt: p.weight ? `${p.weight}kg` : '-' }, { l: '주소', txt: p.address || '-', w: 'full' }])}
      ${sec('입퇴원 정보')}${E().fields([{ l: '입원일', txt: T.d(e.at), t: 'req' }, { l: '입원시간', txt: T.hm(e.at) }, { l: '퇴원일', txt: e.endAt ? T.d(e.endAt) : '재원 중', t: 'req' }, { l: '퇴원시간', txt: e.endAt ? T.hm(e.endAt) : '' },
        { l: '입원과 *', txt: e.dept, t: 'req' }, { l: '퇴원과 *', txt: e.dept, t: 'req' }, { l: '입원진료의 *', txt: doc(e.doctorId), t: 'req' }, { l: '퇴원진료의 *', txt: doc(e.doctorId), t: 'req' },
        { l: '입원병동 *', txt: e.ward || '-' }, { l: '입원병실 *', txt: `${e.room || ''}-${e.bed || ''}` }, { l: '입원횟차', txt: `${a.times}회`, t: 'calc' }, { l: '재입원여부', html: ck('readmit', v.readmit, '30일 안') },
        { l: '재원일수', txt: `${a.days}일`, t: 'calc' }, { l: '수술전일수', txt: a.preop === '' ? '-' : `${a.preop}일`, t: 'calc' }, sel('입원경로', 'route', 'req'), sel('내원경위', 'visit', 'req'),
        sel('치료결과', 'result', 'req'), sel('퇴원형태', 'form', 'req'), sel('행선지', 'dest', 'req'), { l: '인턴', n: 'intern', v: v.intern || '' }])}
      ${sec('상세 정보')}${E().fields([{ l: '지정여부', w: 'full', html: `<span class="row" style="gap:.7rem">${['수술', '진료', '마취', '방사선', '해부병리'].map((t) => ck('ds_' + t, (v.ds || []).includes(t) || (t === '수술' && a.ops > 0) || (t === '진료' && !a.ops), t)).join('')}</span>` },
        { l: '사망일', txt: a.death && e.endAt ? T.d(e.endAt) : '-' }, sel('사망구분', 'dtype'), sel('출생구분', 'born'), sel('창상상태', 'wound'),
        { l: '수혈량', txt: a.blood || '없음', t: 'calc' }, { l: '혈액폐기량', n: 'bwaste', v: v.bwaste || '' }, { l: 'Allergy', html: ck('allergy', v.allergy, '있음') }, { l: '중독여부', html: ck('poison', v.poison, '있음') },
        { l: '원내 합병증', n: 'comp', v: v.comp || '', w: 2 }, { l: '재수술여부', html: ck('reop', v.reop, '있음') }, { l: '계획 없던 재입원', html: ck('unplanRe', v.unplanRe || v.readmit, '해당') },
        { l: '계획 없던 재수술', html: ck('unplanOp', v.unplanOp, '해당') }, { l: '전염병', html: ck('infect', v.infect, '있음') }, { l: '암환자구분', html: ck('cancer', v.cancer, '암') }, { l: '총수술수', txt: `${a.ops}건`, t: 'calc' }])}
      <div class="row between small muted"><span>회색 계산칸은 처방·간호·수술 기록에서 자동으로 가져온 값입니다.</span><span>최초입력 ${mi(e).dc1By ? esc(mi(e).dc1By) + ' ' + T.mdhm(mi(e).dc1At) : '-'}</span></div>
      <div class="btn-row end">${UI.btn('저장', '', { type: 'submit', kind: 'pri' })}</div></form>`;
  }
  const doneMark = (e) => { const m = e.mi || {}; const c = e.coding || {}; return [m.dc1Done ? '●' : '', c.state === '확정' ? '●' : '', (c.ops || m.opDone) ? '●' : '', S.where('defs', (d) => d.encId === e.id && d.status !== '완료').length ? '미비' : m.defOk ? '●' : '']; };
  H.reg({
    id: 'mi-dc1', title: '퇴원분석(I)', actor: '의무기록사', layout: 'full', channels: () => ['mrd'],
    render() {
      const from = ms('from', T.d(Date.now() - 30 * DAY)); const dept = ms('dept', '');
      const list = ipds(['퇴원']).filter((e) => T.d(e.endAt || e.at) >= from && (!dept || e.dept === dept));
      const cur = list.find((e) => e.id === ms('sel', '')) || list[0];
      return `<div class="erp">${E().bar([`퇴원일자 <input type="date" value="${from}" data-chg="mi.from" aria-label="퇴원일자부터">`, `퇴원과 <select data-chg="mi.dept" aria-label="퇴원과"><option value="">전체</option>${[...new Set(ipds().map((e) => e.dept))].map((d) => `<option ${d === dept ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>`, '|', `등록번호 <b class="mono">${cur ? esc(H.pat(cur.patientId).mrn) : '-'}</b>`])}
        <div class="erp-cols3" style="grid-template-columns:minmax(0,22rem) minmax(0,1fr)"><div class="gap-s">${E().grid([{ h: '퇴원과' }, { h: '등록번호' }, { h: '환자명' }, { h: '퇴원일자' }, { h: 'I' }, { h: 'II' }, { h: 'III' }, { h: '미비' }], list.map((e) => ({ cells: [esc(e.dept), H.pat(e.patientId).mrn, esc(H.pat(e.patientId).name), T.d(e.endAt || e.at), ...doneMark(e)], on: cur && e.id === cur.id, act: 'mi.sel', data: { id: e.id } })), { h: '32rem', empty: '기간 안 퇴원 환자가 없습니다' })}
          <div class="small" style="text-align:center;background:var(--k-calc);padding:.25rem">${list.length}(전체) - ${list.filter((e) => e.ward === 'NB').length}(신생아과) - 0(낮병동) = ${list.length - list.filter((e) => e.ward === 'NB').length} 명</div></div>
          <div>${cur ? dc1Form(cur) : UI.empty('퇴원 환자를 고르세요')}</div></div></div>`;
    },
    acts: {
      'mi.from': (el) => { set('from', el.value); A.render(); }, 'mi.dept': (el) => { set('dept', el.value); A.render(); }, 'mi.sel': (el) => { set('sel', el.dataset.id); A.render(); },
      'mi.dc1save': (f, d) => {
        const e = H.enc(d.id); const m = mi(e); const keep = ['job', 'rel', 'route', 'visit', 'result', 'form', 'dest', 'intern', 'dtype', 'born', 'wound', 'bwaste', 'comp'];
        m.dc1 = Object.fromEntries(keep.map((k) => [k, d[k] || ''])); ['readmit', 'allergy', 'poison', 'reop', 'unplanRe', 'unplanOp', 'infect', 'cancer'].forEach((k) => { m.dc1[k] = !!d[k]; });
        m.dc1.ds = ['수술', '진료', '마취', '방사선', '해부병리'].filter((t) => d['ds_' + t]);
        if (!m.dc1By) { m.dc1By = H.who(); m.dc1At = Date.now(); }
        m.dc1Done = !!d.done1; m.defOk = !!d.defOk;
        e.coding = Object.assign(e.coding || {}, { form: d.form, result: d.result }); e.dc = Object.assign(e.dc || {}, { form: d.form, result: d.result, dest: d.dest });
        S.save(); H.log('퇴원분석(I) 저장', H.pat(e.patientId).name, e.patientId); UI.toast(m.dc1Done ? '퇴원분석(I) 입력완료' : '저장 (입력완료 체크 전)', 'ok'); A.render();
      },
    },
  });

  // 공통: 다른 의료정보 화면으로 이동, EMR 보기
  const common = {
    'mi.to': (el) => { const v = el.dataset.v; const x = Object.assign({ sel: el.dataset.id }, el.dataset.t ? { tab: el.dataset.t } : {}); A.open(v); A.st[v] = Object.assign(A.st[v] || {}, x); A.render(); },
    'mi.emr': (el) => { const e = H.enc(el.dataset.id); const p = H.pat(e.patientId); const ns = notesOf(e);
      UI.modal({ title: `EMR 조회 — ${p.name} (${e.dept})`, size: 'wide', body: ns.length ? `<div class="gap-s">${ns.map((n) => `<div class="box"><div class="row between"><b>${esc(n.type)}</b><span class="small muted">${T.mdhm(n.at)} · ${esc(n.by)} ${n.signed ? '· 서명' : '· 미서명'}</span></div><div class="small" style="white-space:pre-wrap">${esc(Object.entries(n.content || {}).map(([k, v]) => `${k}: ${v}`).join('\n'))}</div></div>`).join('')}</div>` : UI.empty('작성된 의사 기록이 없습니다') }); },
  };
  Object.assign(H.mods['mi-dc1'].acts, common);

  // ═════════ 진료분석 ═════════
  const OPCODE = { O9001: ['47.01', '복강경 충수절제술'], O9003: ['47.09', '충수절제술'], O9005: ['74.1', '제왕절개술 (자궁하부)'], V8002: ['36.07', '관상동맥 약물방출 스텐트 삽입'], V8001: ['88.56', '관상동맥 조영술'], E8104: ['44.43', '내시경 위십이지장 출혈 지혈술'], E8102: ['45.42', '내시경 대장 용종절제술'] };
  const opCodeOf = (o) => OPCODE[o.code] || [o.code.replace(/\D/g, '').slice(0, 2) + '.' + o.code.replace(/\D/g, '').slice(2, 4), o.name];
  const MDC = { A: '감염', C: '신생물', D: '혈액', E: '내분비', G: '신경', I: '순환기', J: '호흡기', K: '소화기', M: '근골격', N: '비뇨기', O: '임신·출산', P: '신생아', S: '손상', T: '손상' };
  const drgOf = (e) => { const c = e.coding || {}; const main = c.main || ((e.dx || []).find((d) => d.main) || {}).code; if (!main) return '-'; const sev = (c.subs || []).length >= 3 ? 3 : (c.subs || []).length ? 2 : 1; return `${main[0]}${ordersOf(e, 'OP').length ? 'S' : 'M'}${String(main.charCodeAt(1) % 90).padStart(2, '0')}${sev}`; };
  const STATES = ['미코딩', '가코딩', '확정', '재검토'];
  function anaTab1(e) {
    const a = auto(e); const v = Object.assign({}, a, mi(e).dc1 || {}); const tr = (e.coding || {}).transfer || {}; const pl = (e.coding || {}).plan || {};
    const moves = [{ dept: e.dept, doc: doc(e.doctorId), from: T.d(e.at), to: e.endAt ? T.d(e.endAt) : '', days: a.days, why: '입원' }].concat((e.moves || []));
    return `${E().fields([{ l: '입원일', txt: T.d(e.at) }, { l: '입원과', txt: e.dept }, { l: '입원진료의', txt: doc(e.doctorId) }, { l: '재원일수', txt: `${a.days}일`, t: 'calc' }, { l: '퇴원일', txt: e.endAt ? T.d(e.endAt) : '-' }, { l: '퇴원과', txt: e.dept }, { l: '퇴원진료의', txt: doc(e.doctorId) }, { l: '암환자구분', html: ck('x', a.cancer) },
        { l: '입원경로', txt: v.route, t: 'warn' }, { l: '내원경위', txt: v.visit, t: 'warn' }, { l: '치료결과', txt: v.result, t: 'warn' }, { l: '퇴원형태', txt: v.form, t: 'warn' }, { l: '30일내 재입원', txt: a.readmit ? '예' : '아니오' }, { l: '행선지', txt: v.dest, t: 'warn' }])}
      ${sec('전과내역')}${E().grid([{ h: 'No.' }, { h: '진료과' }, { h: '진료의' }, { h: '시작일' }, { h: '종료일' }, { h: '재원일수' }, { h: '전과 이유' }], moves.map((m, k) => [k + 1, esc(m.dept), esc(m.doc), m.from, m.to, m.days, esc(m.why)]), { h: '8rem' })}
      ${sec('전원 현황')}${E().fields([{ l: '전원 요구', w: 'full', html: radio('trReq', ['(0) 해당 없음', '(1) 환자', '(2) 보호자', '(3) 전문전원', '(4) 요양전원', '(5) 회송', '(9) 기타'], tr.req || (v.form === '전원' ? '(5) 회송' : '(0) 해당 없음')) },
        { l: '전원 사유', w: 'full', html: `<span class="row" style="gap:.6rem">${['병실 부족', '중환자실 부족', '응급수술·처치 불가', '1·2차 기관 전원', '3차 기관 전원', '장기시설로 전원', '방사선치료', '급성기 치료', '급성기 치료 후', '환자 사정', '기타'].map((t) => ck('trWhy_' + t, (tr.why || []).includes(t), t)).join('')}</span>` },
        { l: '연속적 치료사항', n: 'trCont', v: tr.cont || '', w: 'full' }, { l: '전원 보낸 기관', n: 'trOrg', v: tr.org || (S.where('refs', (r) => r.pid === e.patientId && r.dir === 'out')[0] || {}).to || '', w: 2 }, { l: '진료과', n: 'trDept', v: tr.dept || '' }])}
      ${sec('퇴원 후 진료 계획')}${E().fields([{ l: '진료 계획', w: 'full', html: radio('plan', ['(0) 해당사항 없음', '(1) 외래진료 예정', '(2) 재입원 예정', '(9) 기타'], pl.kind || (S.where('appts', (x) => x.pid === e.patientId && x.status === '예약').length ? '(1) 외래진료 예정' : '(0) 해당사항 없음')) },
        { l: '외래 예약', txt: (() => { const ap = S.where('appts', (x) => x.pid === e.patientId && x.status === '예약').sort((x, y) => x.date.localeCompare(y.date))[0]; return ap ? `${ap.dept} ${ap.date} ${ap.time} (예약센터 자료)` : '예약 없음'; })(), w: 2, t: 'calc' }, { l: '기타', n: 'planEtc', v: pl.etc || '' }])}`;
  }
  function anaDx(e) {
    const c = e.coding || {}; const main = c.main || ((e.dx || []).find((d) => d.main) || {}).code || ''; const subs = c.subs || (e.dx || []).filter((d) => !d.main).map((d) => d.code); const poa = c.poa || {};
    const pool = H.M.KCD.filter((k) => k.code === main || subs.includes(k.code) || (e.dx || []).some((d) => d.code === k.code));
    return `${UI.note('진단분류(코딩): 퇴원요약·경과기록을 읽고 한국표준질병사인분류(KCD)로 주진단 1개와 부진단을 정합니다. POA(입원 시 있던 병인지): Y 있었음 · N 입원 후 생김(합병증) · U 모름. 확정하면 심사팀 청구 자료로 넘어갑니다.', 'info')}
      ${E().fields([{ l: '주진단', n: 'main', v: main, opts: [{ v: '', l: '— 고르세요 —' }].concat(H.M.KCD.map((k) => ({ v: k.code, l: `${k.code} ${k.name}` }))), t: 'req', w: 2 }, { l: '주진단 POA', n: 'poa_main', v: poa[main] || 'Y', opts: ['Y', 'N', 'U'] }, { l: '환자분류 (KDRG)', txt: drgOf(e), t: 'calc' }])}
      ${E().grid([{ h: '선택' }, { h: '부진단 코드' }, { h: '진단명' }, { h: '의사 기록' }, { h: 'POA' }], H.M.KCD.filter((k) => k.code !== main && (subs.includes(k.code) || (e.dx || []).some((d) => d.code === k.code) || ['E11.9', 'I10', 'D64.9', 'E87.5', 'N39.0', 'J96.0', 'T81.4'].includes(k.code))).map((k) => [ck('sub_' + k.code, subs.includes(k.code)), `<span class="mono">${k.code}</span>`, esc(k.name), (e.dx || []).some((d) => d.code === k.code) ? '있음' : '-', `<select name="poa_${k.code}" aria-label="POA">${['Y', 'N', 'U'].map((x) => `<option ${x === (poa[k.code] || 'Y') ? 'selected' : ''}>${x}</option>`).join('')}</select>`]), { h: '16rem' })}
      <p class="small muted" style="margin:0">의사가 쓴 진단: ${pool.map((k) => `${k.code} ${esc(k.name)}`).join(', ') || '없음'}</p>`;
  }
  function anaOp(e) {
    const ops = ordersOf(e).filter((o) => ['OP', 'CV', 'EN'].includes(o.cat) || ((H.M.item(o.code) || {}).func));
    return `${UI.note('시술분류: 수술·시술·주요 처치를 국제 시술분류 코드(ICD-9-CM 근사)로 정리합니다. 주수술은 입원 목적과 가장 관련 있는 것 1개입니다.', 'info')}
      ${E().grid([{ h: '주' }, { h: '시행일' }, { h: '처방' }, { h: '시술코드' }, { h: '시술명' }, { h: '마취' }, { h: '집도의' }], ops.map((o, k) => { const [cd, nm] = opCodeOf(o); return [`<input type="radio" name="mainOp" value="${o.id}" ${((e.coding || {}).mainOp ? e.coding.mainOp === o.id : k === 0) ? 'checked' : ''} aria-label="주수술">`, T.d(o.at), esc(o.name), `<span class="mono">${cd}</span>`, esc(nm), esc((o.op || {}).anes || '-'), esc(o.by)]; }), { h: '14rem', empty: '수술·시술 처방이 없습니다 (내과 입원)' })}
      ${E().fields([{ l: '시술분류 완료', html: ck('opDone', (e.coding || {}).ops || mi(e).opDone, '완료') }])}`;
  }
  function anaCa(e) {
    const ca = (e.coding || {}).cancer || {}; const isCa = (e.dx || []).some((d) => /^C/.test(d.code)) || (H.pat(e.patientId).hx || '').match(/암|종양/);
    return `${UI.note('암등록(정보지): 암 환자는 국가 암등록 사업으로 원발 부위·조직형·병기·진단 방법을 등록합니다. 병리 결과(병리과 판독)가 근거입니다.', 'info')}
      ${isCa ? '' : UI.note('이 환자는 암 진단이 없습니다 — 등록 대상이 아닙니다.', 'warn')}
      ${E().fields([{ l: '원발 부위', n: 'caSite', v: ca.site || '' }, { l: '조직형 (형태학)', n: 'caMorph', v: ca.morph || '' }, { l: '병기', n: 'caStage', v: ca.stage || '', opts: ['', '0기', '1기', '2기', '3기', '4기', '모름'] }, { l: '진단 방법', n: 'caHow', v: ca.how || '조직검사', opts: ['조직검사', '세포검사', '영상', '임상'] },
        { l: '최초 진단일', n: 'caDate', v: ca.date || '', type: 'date' }, { l: '병리 결과', txt: (S.where('orders', (o) => o.patientId === e.patientId && o.cat === 'PATH' && o.result)[0] || { result: { dx: '없음' } }).result.dx || '없음', w: 2, t: 'calc' }])}`;
  }
  function anaLab(e) { const l = ordersOf(e, 'LAB').filter((o) => o.result); return E().grid([{ h: '보고일' }, { h: '검사' }, { h: '이상 결과' }], l.map((o) => [T.mdhm(o.result.at), esc(o.name), o.result.items.filter((r) => r.flag).map((r) => `${esc(r.n)} ${esc(r.v)}`).join(', ') || '정상']), { h: '24rem', empty: '검사 결과가 없습니다' }); }
  H.reg({
    id: 'mi-anal', title: '진료분석', actor: '의무기록사 (코딩)', layout: 'full', channels: () => ['mrd'],
    render() {
      const kind = ms('kind', '퇴원'); const st = ms('st', '전체'); const dept = ms('dept', '');
      const list = ipds(kind === '전체' ? null : kind === '재원' ? ['입원중'] : ['퇴원']).filter((e) => (!dept || e.dept === dept) && (st === '전체' || (((e.coding || {}).state) || '미코딩') === st));
      const cur = list.find((e) => e.id === ms('sel', '')) || list[0]; const tab = ms('tab', 'dc1');
      const p = cur && H.pat(cur.patientId); const c = (cur && cur.coding) || {};
      const body = !cur ? UI.empty('환자를 고르세요') : `<form data-submit="mi.anaSave" class="gap-s"><input type="hidden" name="id" value="${cur.id}"><input type="hidden" name="tab" value="${tab}">
        ${E().bar([['서식등록', ''], ['퇴원분석(I)', 'mi-dc1'], ['퇴원요약지', 'mi-dxmgr'], ['제증명', 'certdoc'], ['미비등록', 'mi-def'], ['처방조회', 'ocs-ipd']].filter((x) => x[1]).map(([l, v]) => ({ l, act: 'mi.to', data: { v, id: cur.id } })).concat([{ l: 'EMR', act: 'mi.emr', data: { id: cur.id } }]))}
        ${sec('환자기본정보')}<div class="erp-cols" style="grid-template-columns:minmax(0,1fr) 19rem">${E().fields([{ l: '등록번호', txt: p.mrn, t: 'key' }, { l: '이름', txt: p.name, t: 'key' }, { l: '나이/성별', txt: `${H.age(p.birth)} / ${p.sex === 'M' ? '남' : '여'}` }, { l: '주민번호', txt: E().info(p).rrn }, { l: '전화번호', txt: p.phone || '-' }, { l: '보험종별', txt: p.ins }, { l: '입원과', txt: cur.dept }, { l: '퇴원과', txt: cur.dept }, { l: '전문의', txt: doc(cur.doctorId) }, { l: '입원일/퇴원일', txt: `${T.d(cur.at)} ~ ${cur.endAt ? T.d(cur.endAt) : '재원'}`, w: 2 }, { l: '감염', txt: p.flags && p.flags.isolation ? p.flags.isolation : '-' }])}
          <div class="erp-f" style="grid-template-columns:1fr">${STATES.map((s) => `<div class="c"><div class="l">${ck('state_' + s, (c.state || '미코딩') === s, s)}</div><div class="v small">${esc((c.stateLog || {})[s] || '- / -')}</div></div>`).join('')}</div></div>
        ${E().tabs('mi.atab', [['dc1', '퇴원분석 I'], ['dx', '퇴원분석 II · 진단분류'], ['op', '시술분류'], ['ca', '정보지 (암등록)'], ['lab', 'LAB 검사']], tab)}
        <div>${{ dc1: anaTab1, dx: anaDx, op: anaOp, ca: anaCa, lab: anaLab }[tab](cur)}</div>
        <div class="btn-row end">${tab === 'dx' ? `${UI.btn('가코딩 저장', 'mi.state', { data: { s: '가코딩' } })}${UI.btn('재검토 요청 (의사에게)', 'mi.state', { kind: 'warn', data: { s: '재검토' } })}${UI.btn('코딩 확정', 'mi.state', { kind: 'pri', data: { s: '확정' } })}` : tab !== 'lab' ? UI.btn('저장', '', { type: 'submit', kind: 'pri' }) : ''}</div></form>`;
      return `<div class="erp"><div class="erp-cols3" style="grid-template-columns:minmax(0,21rem) minmax(0,1fr)"><div class="gap-s">
        <div class="box gap-s"><div class="row"><b class="small">구분</b>${['전체', '재원', '퇴원'].map((k) => `<button type="button" class="btn sm ${k === kind ? 'pri' : ''}" data-act="mi.kind" data-v="${k}">${k}</button>`).join('')}</div>
          <div class="row"><b class="small">진료과</b><select data-chg="mi.dept" aria-label="진료과"><option value="">전체</option>${[...new Set(ipds().map((e) => e.dept))].map((d) => `<option ${d === dept ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></div>
          <div class="row"><b class="small">진단상태</b>${['전체'].concat(STATES).map((k) => `<button type="button" class="btn sm ${k === st ? 'pri' : ''}" data-act="mi.st" data-v="${k}">${k}</button>`).join('')}</div></div>
        ${E().grid([{ h: 'No.' }, { h: '재원상태' }, { h: '등록번호' }, { h: '이름' }, { h: '과' }, { h: 'DRG' }, { h: '진단' }], list.map((e, k) => ({ cells: [k + 1, e.status === '입원중' ? '재원' : '퇴원', H.pat(e.patientId).mrn, esc(H.pat(e.patientId).name), esc(e.dept), drgOf(e), esc((e.coding || {}).state || '미코딩')], on: cur && e.id === cur.id, act: 'mi.sel', data: { id: e.id } })), { h: '34rem' })}</div>
        <div>${body}</div></div></div>`;
    },
    acts: Object.assign({}, common, {
      'mi.sel': (el) => { set('sel', el.dataset.id); A.render(); }, 'mi.kind': (el) => { set('kind', el.dataset.v); set('sel', ''); A.render(); }, 'mi.st': (el) => { set('st', el.dataset.v); set('sel', ''); A.render(); }, 'mi.dept': (el) => { set('dept', el.value); A.render(); },
      'mi.atab': (el) => { set('tab', el.dataset.v); A.render(); },
      'mi.anaSave': (f, d) => saveAna(d),
      'mi.state': (el) => { const f = el.closest('form'); const d = H.formData(f); saveAna(d, el.dataset.s); },
    }),
  });
  function saveAna(d, state) {
    const e = H.enc(d.id); const c = (e.coding = e.coding || {}); const p = H.pat(e.patientId);
    if (d.tab === 'dx') {
      if (state && state !== '재검토' && !d.main) return UI.toast('주진단을 고르세요', 'warn');
      c.main = d.main; c.subs = Object.keys(d).filter((k) => k.startsWith('sub_') && d[k]).map((k) => k.slice(4)); c.poa = { [d.main]: d.poa_main }; c.subs.forEach((s) => { c.poa[s] = d['poa_' + s] || 'Y'; });
      if (state) { c.state = state; c.stateLog = Object.assign(c.stateLog || {}, { [state]: `${H.who().split(' ')[0]} / ${T.mdhm(Date.now())}` }); }
      if (state === '확정') { c.by = H.who(); c.at = Date.now(); H.notify('review', `코딩 확정: ${p.name} ${c.main} (KDRG ${drgOf(e)}) — 청구 가능`, { patientId: p.id }); }
      if (state === '재검토') H.notify('doctor', `진단 재검토 요청 (의료정보팀): ${p.name} — 퇴원요약 진단과 기록 내용이 맞지 않습니다`, { patientId: p.id });
    } else if (d.tab === 'dc1') { c.transfer = { req: d.trReq, why: Object.keys(d).filter((k) => k.startsWith('trWhy_') && d[k]).map((k) => k.slice(6)), cont: d.trCont, org: d.trOrg, dept: d.trDept }; c.plan = { kind: d.plan, etc: d.planEtc }; }
    else if (d.tab === 'op') { c.mainOp = d.mainOp; c.ops = !!d.opDone; mi(e).opDone = !!d.opDone; }
    else if (d.tab === 'ca') c.cancer = { site: d.caSite, morph: d.caMorph, stage: d.caStage, how: d.caHow, date: d.caDate };
    S.save(); H.log('진료분석 저장', `${p.name} ${state || d.tab}`, p.id); UI.toast(state ? `진단상태: ${state}` : '저장', 'ok'); A.render();
  }

  // ═════════ 퇴원진단명 관리 (퇴원요약 기록지·진단명) ═════════
  const sumOf = (e) => notesOf(e, '퇴원요약').slice(-1)[0];
  const sumState = (e) => { const n = sumOf(e); return !n ? '입력전' : !n.signed ? '최초작성' : mi(e).sumOk ? '확인한 퇴원기록지' : '미확인 퇴원기록지'; };
  H.reg({
    id: 'mi-dxmgr', title: '퇴원진단명 관리', actor: '의무기록사·주치의', layout: 'full', channels: () => ['mrd'],
    render() {
      const kind = ms('kind', '퇴원+가퇴원+예고'); const st = ms('st', '전체');
      const list = ipds(kind === '재원' ? ['입원중'] : kind === '퇴원' ? ['퇴원'] : ['입원중', '퇴원']).filter((e) => kind !== '퇴원+가퇴원+예고' || e.status === '퇴원' || (e.dc && e.dc.plan)).filter((e) => st === '전체' || sumState(e) === st);
      const cur = list.find((e) => e.id === ms('sel', '')) || list[0];
      const p = cur && H.pat(cur.patientId); const n = cur && sumOf(cur); const c = n ? n.content || {} : {};
      const dxRows = cur ? (cur.dx || []).map((d) => [d.main ? '주' : '부', `<span class="mono">${esc(d.code)}</span>`, esc(d.name), esc(n ? n.by : doc(cur.doctorId)), n ? T.mdhm(n.at) : '-', UI.btn('삭제', 'mx.del', { size: 'sm', data: { id: cur.id, c: d.code } })]) : [];
      return `<div class="erp"><div class="erp-cols3" style="grid-template-columns:minmax(0,24rem) minmax(0,1fr)"><div class="gap-s">
        <div class="box gap-s"><div class="row"><b class="small">퇴원유형</b>${['재원', '퇴원+가퇴원+예고', '퇴원'].map((k) => `<button type="button" class="btn sm ${k === kind ? 'pri' : ''}" data-act="mx.kind" data-v="${k}">${k}</button>`).join('')}</div>
          <div class="row"><b class="small">상태별</b>${['전체', '입력전', '최초작성', '미확인 퇴원기록지', '확인한 퇴원기록지'].map((k) => `<button type="button" class="btn sm ${k === st ? 'pri' : ''}" data-act="mx.st" data-v="${k}">${k}</button>`).join('')}</div></div>
        ${E().grid([{ h: '병실' }, { h: '등록번호' }, { h: '환자명' }, { h: '입원일자' }, { h: '퇴원일자' }, { h: '진료과' }, { h: '상태' }], list.map((e) => ({ cells: [`${e.ward || ''} ${e.room || ''}`, H.pat(e.patientId).mrn, esc(H.pat(e.patientId).name), T.d(e.at), e.endAt ? T.d(e.endAt) : '', esc(e.dept), esc(sumState(e))], on: cur && e.id === cur.id, act: 'mx.sel', data: { id: e.id } })), { h: '26rem' })}
        ${cur ? `${sec('환자정보')}${E().fields([{ l: '환자', txt: `${p.name} ${H.sexAge(p)}` }, { l: '주치의', txt: doc(cur.doctorId) }, { l: '재원일수', txt: `${H.fee.daysOf(cur)}일` }])}` : ''}</div>
        <div>${!cur ? UI.empty('환자를 고르세요') : `<form data-submit="mx.save" class="gap-s"><input type="hidden" name="id" value="${cur.id}">
          ${E().bar([{ l: '약속상병', act: 'mx.kcd', data: { id: cur.id, g: 'promise' } }, { l: '진료과상병', act: 'mx.kcd', data: { id: cur.id, g: 'dept' } }, { l: '전체상병', act: 'mx.kcd', data: { id: cur.id, g: 'all' } }, '|', { l: '상용기록지', act: 'mx.tpl', data: { id: cur.id } }, { l: 'Summary 저장', act: 'mx.sum', kind: 'pri', data: { id: cur.id } }, '|', { l: mi(cur).sumOk ? '확인 취소' : '퇴원기록지 확인', act: 'mx.ok', data: { id: cur.id } }])}
          ${sec('퇴원진단명 관리정보')}${E().grid([{ h: '구분' }, { h: '진단코드' }, { h: '진단명' }, { h: '입력' }, { h: '일시' }, { h: '' }], dxRows, { h: '9rem', empty: '진단명이 없습니다 — 약속상병·전체상병에서 넣으세요' })}
          ${E().fields([{ l: '특이사항', n: 'memo', v: mi(cur).sumMemo || '', w: 'full' }])}
          ${sec(`퇴원요약 기록지 — ${esc(sumState(cur))}`)}${E().fields([{ l: '입원 경과', w: 'full', html: `<textarea name="course" style="width:100%;min-height:6rem" aria-label="입원 경과">${esc(c.course || '')}</textarea>` }, { l: '퇴원 시 상태', w: 'full', html: `<textarea name="result" style="width:100%;min-height:3rem" aria-label="퇴원 시 상태">${esc(c.result || '')}</textarea>` }, { l: '퇴원약', w: 'full', html: `<textarea name="meds" style="width:100%;min-height:3rem" aria-label="퇴원약">${esc(c.meds || '')}</textarea>` }, { l: '외래 추적', w: 'full', html: `<textarea name="fu" style="width:100%;min-height:2.5rem" aria-label="외래 추적">${esc(c.fu || '')}</textarea>` }])}
          <div class="small muted">Summary 저장 = 의사 기록(EMR)의 퇴원요약으로 저장·서명됩니다. 진단명은 진료분석(코딩)·심사팀 청구로 이어집니다.</div></form>`}</div></div></div>`;
    },
    acts: Object.assign({}, common, {
      'mx.kind': (el) => { set('kind', el.dataset.v); set('sel', ''); A.render(); }, 'mx.st': (el) => { set('st', el.dataset.v); set('sel', ''); A.render(); }, 'mx.sel': (el) => { set('sel', el.dataset.id); A.render(); },
      'mx.kcd': (el) => { const e = H.enc(el.dataset.id); const g = el.dataset.g; const pool = g === 'promise' ? H.M.KCD.slice(0, 12) : g === 'dept' ? H.M.KCD.filter((k) => (MDC[k.code[0]] || '') && S.where('encounters', (x) => x.dept === e.dept && (x.dx || []).some((d) => d.code === k.code)).length) : H.M.KCD;
        UI.modal({ title: `${{ promise: '약속상병', dept: '진료과상병', all: '전체상병' }[g]} — 눌러서 추가`, size: 'wide', body: `<div class="gap-s">${(pool.length ? pool : H.M.KCD).map((k) => `<button class="btn block" style="justify-content:flex-start" data-act="mx.add" data-id="${e.id}" data-c="${k.code}"><span class="mono">${k.code}</span> ${esc(k.name)}</button>`).join('')}</div>`, acts: { 'mx.add': (b) => { const ee = H.enc(b.dataset.id); const k = H.M.KCD.find((x) => x.code === b.dataset.c); ee.dx = ee.dx || []; if (!ee.dx.some((d) => d.code === k.code)) ee.dx.push({ code: k.code, name: k.name, main: !ee.dx.length }); S.save(); UI.close(); UI.toast(`${k.code} 추가`, 'ok'); A.render(); } } }); },
      'mx.del': (el) => { const e = H.enc(el.dataset.id); e.dx = (e.dx || []).filter((d) => d.code !== el.dataset.c); if (e.dx.length && !e.dx.some((d) => d.main)) e.dx[0].main = true; S.save(); A.render(); },
      'mx.tpl': (el) => { const e = H.enc(el.dataset.id); const f = el.closest('form'); const labs = ordersOf(e, 'LAB').filter((o) => o.result && o.result.items.some((r) => r.flag)).map((o) => o.name).slice(0, 4).join(', ');
        f.querySelector('[name=course]').value = `${(e.dx || []).map((x) => x.name).join(', ') || '진단'}(으)로 ${T.d(e.at)} 입원. ${labs ? `이상 검사(${labs}) 확인 후 ` : ''}치료하여 증상 호전됨. 재원 ${H.fee.daysOf(e)}일.`;
        f.querySelector('[name=result]').value = '활력징후 안정, 식사·보행 가능, 퇴원 교육 이해함'; f.querySelector('[name=meds]').value = ordersOf(e, 'MED').map((o) => o.name).slice(0, 5).join('\n') || '없음';
        const ap = S.where('appts', (x) => x.pid === e.patientId && x.status === '예약')[0]; f.querySelector('[name=fu]').value = ap ? `${ap.date} ${ap.dept} 외래` : '1~2주 뒤 외래'; },
      'mx.save': (f, d) => H.mods['mi-dxmgr'].acts['mx.sum']({ dataset: { id: d.id }, closest: () => f }),
      'mx.sum': (el) => { const f = el.closest('form'); const d = H.formData(f); const e = H.enc(d.id); const p = H.pat(e.patientId);
        if (!d.course) return UI.toast('입원 경과를 쓰거나 "상용기록지"를 누르세요', 'warn'); if (!(e.dx || []).length) return UI.toast('퇴원진단명을 하나 이상 넣으세요', 'warn');
        const content = { course: d.course, result: d.result, meds: d.meds, fu: d.fu, dx: (e.dx || []).map((x) => `${x.code} ${x.name}`).join(', ') };
        const n = sumOf(e); if (n) Object.assign(n, { content, signed: true, at: Date.now(), by: `${doc(e.doctorId)} (의사)` }); else S.add('notes', { id: H.uid('no'), encId: e.id, patientId: p.id, type: '퇴원요약', at: Date.now(), by: `${doc(e.doctorId)} (의사)`, signed: true, content });
        mi(e).sumMemo = d.memo; S.where('defs', (x) => x.encId === e.id && x.item.startsWith('퇴원요약') && x.status !== '완료').forEach((x) => { x.status = '완료'; x.doneAt = Date.now(); });
        S.save(); H.log('퇴원요약 저장', p.name, p.id); UI.toast('퇴원요약 저장·서명 — 퇴원요약 미비가 있으면 완료 처리했습니다', 'ok'); A.render(); },
      'mx.ok': (el) => { const e = H.enc(el.dataset.id); if (!sumOf(e)) return UI.toast('퇴원요약이 아직 없습니다', 'warn'); mi(e).sumOk = !mi(e).sumOk; S.save(); A.render(); },
    }),
  });

  // ═════════ 미비등록 ═════════
  const DEFCAT = [
    ['입퇴원 기록지', ['주진단명', '기타진단명', '주수술명', '기타수술 및 처치명', '치료결과', '퇴원형태', '레지던트 서명', '전문의 서명']],
    ['응급실 기록지', ['응급실 기록', '혈압/맥박/호흡', '의식상태', '응급실 도착·이탈 시간', '응급환자 분류 (KTAS)', '간호사 서명', '추정 진단명', '의사 서명']],
    ['퇴원요약지', ['주진단 및 기타진단명', '주호소 및 신체소견', '발현시점', '현병력', '각종 검사 및 방사선 소견', '치료 및 그 결과', '추후 치료계획', '퇴원 후 응급상황 대처방안', '퇴원약', '담당의사 서명']],
    ['경과기록지', ['치료계획서', '입원기록', '퇴원계획', '전출기록', '전입기록', '수술 전 평가기록', '수술 요약', '수술 후 진료계획', '경과기록', '사망기록', '서명', '퇴원기록']],
    ['타과의뢰서', ['의뢰의사 서명', '의뢰내용', '의뢰받은 의사 서명', '회신일자']],
    ['동의서', ['병명', '수술/검사명', '의사 서명', '환자(보호자) 서명', '수술내용 설명', '합병증', '동의일자']],
    ['수술기록지', ['수술일', '수술의', '마취방법', '수술 전 진단명', '수술 후 진단명', '수술명', '관찰소견', '수술절차', '담당교수 서명']],
    ['의사지시서', ['입원지시', '퇴원지시', '의사 서명']],
    ['마취/간호기록지', ['마취 전 조사표', '수술간호 기록지', '마취 직전 환자평가서', '마취 후 산소포화도 관리', 'Time out 확인표', '간호기록']],
    ['임상 질지표 점검', ['폐렴 임상 질지표 점검표', '급성 심근경색 임상 질지표 점검표', '치료적 항생제 사유 입력', '급성기 뇌졸중']],
    ['분만·신생아 기록지', ['분만 진단명', '분만 서명', '신생아 기록', '신생아 체크리스트']],
  ];
  function autoMiss(e) {
    const has = (t) => notesOf(e, t).length > 0; const ops = ordersOf(e, 'OP'); const out = [];
    if (!has('입원기록')) out.push('입원기록'); if (!has('퇴원요약')) out.push('주진단 및 기타진단명', '치료 및 그 결과', '담당의사 서명');
    if (notesOf(e, '경과기록').length < Math.max(1, Math.floor(H.fee.daysOf(e) / 2))) out.push('경과기록');
    if (ops.length && !has('수술기록') && !ops.every((o) => o.op && o.op.note)) out.push('수술명', '수술절차');
    if (!(e.dx || []).length) out.push('주진단명'); if (notesOf(e).some((n) => !n.signed)) out.push('서명');
    if (e.ward === 'NB') out.push('신생아 체크리스트');
    return out;
  }
  H.reg({
    id: 'mi-def', title: '미비등록', actor: '의무기록사', layout: 'full', channels: () => ['mrd'],
    render() {
      const stf = ms('stf', '미완료');
      const list = ipds(['퇴원']).filter((e) => { const o = S.where('defs', (d) => d.encId === e.id && d.status !== '완료').length; return stf === '미완료' ? o || !mi(e).defChecked : stf === '완료' ? mi(e).defChecked && !o : true; });
      const cur = list.find((e) => e.id === ms('sel', '')) || list[0];
      if (!cur) return `<div class="erp">${E().bar([`기록상태 ${radio('x', ['미완료', '완료', '전체'], stf)}`])}${UI.empty('대상 퇴원 환자가 없습니다')}</div>`;
      const p = H.pat(cur.patientId); const ex = S.where('defs', (d) => d.encId === cur.id); const miss = autoMiss(cur);
      const isOn = (it) => ex.some((d) => d.item === it && d.status !== '완료') || (!mi(cur).defChecked && miss.includes(it));
      const days = cur.endAt ? Math.floor((Date.now() - cur.endAt) / DAY) : 0;
      return `<div class="erp">${E().bar([`기록상태 ${['미완료', '완료', '전체'].map((k) => `<button type="button" class="btn sm ${k === stf ? 'pri' : ''}" data-act="df.stf" data-v="${k}">${k}</button>`).join('')}`, '|', `등록번호 <b class="mono">${esc(p.mrn)}</b> ${esc(p.name)}`, `퇴원일 <b>${cur.endAt ? T.d(cur.endAt) : '-'}</b> (${days}일 경과${days >= 14 ? ' — 장기 미비 위험' : ''})`, '|', { l: '인턴미비 생성', act: 'df.intern', data: { id: cur.id } }, { l: 'EMR', act: 'mi.emr', data: { id: cur.id } }])}
        <div class="erp-cols3" style="grid-template-columns:minmax(0,19rem) minmax(0,1fr)">${E().grid([{ h: '퇴원일' }, { h: '진료과' }, { h: '환자' }, { h: '미비의사' }, { h: '미비' }], list.map((e) => { const o = S.where('defs', (d) => d.encId === e.id && d.status !== '완료'); return { cells: [e.endAt ? T.d(e.endAt) : '', esc(e.dept), esc(H.pat(e.patientId).name), o.length ? esc(doc(e.doctorId)) : '', o.length || (mi(e).defChecked ? '완료' : '점검 전')], on: e.id === cur.id, act: 'df.sel', data: { id: e.id } }; }), { h: '36rem' })}
        <form data-submit="df.save" class="gap-s"><input type="hidden" name="id" value="${cur.id}">
          ${E().grid([{ h: '순번' }, { h: '상태' }, { h: '작성일자' }, { h: '미비의사 *' }, { h: '교수 *' }, { h: '진료과 *' }], [[1, ex.some((d) => d.status !== '완료') ? '미완료' : ex.length ? '완료' : '등록 전', ex[0] ? T.d(ex[0].at) : T.d(Date.now()), `<select name="to" aria-label="미비의사"><option>${esc(doc(cur.doctorId))} (주치의)</option><option>${esc(cur.dept)} 전공의</option><option>${esc(cur.ward || '')} 병동 간호사</option></select>`, esc(doc(cur.doctorId)), esc(cur.dept)]])}
          ${E().fields([{ l: 'Remarks', n: 'remark', v: mi(cur).defRemark || '', w: 'full' }])}
          ${UI.note(`자동 점검 결과(기록 자료와 비교): ${miss.length ? miss.join(', ') + ' — 체크해 두었습니다' : '빠진 기록이 없습니다'}`, miss.length ? 'warn' : 'ok')}
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:.5rem">${DEFCAT.map(([cat, items]) => `<div class="box" style="padding:.4rem .5rem"><div style="background:var(--k-head);color:var(--k-head-fg);font-weight:700;padding:.15rem .4rem;border-radius:3px;margin-bottom:.25rem">${esc(cat)}</div>${items.map((it) => `<div>${ck('it_' + cat + '|' + it, isOn(it), it)}</div>`).join('')}</div>`).join('')}</div>
          <div class="row between small muted"><span>입력자 ${esc(mi(cur).defBy || '-')} · 입력일시 ${mi(cur).defAt ? T.mdhm(mi(cur).defAt) : '-'}</span>${UI.btn('미비 등록 → 담당자에게 요청', '', { type: 'submit', kind: 'pri' })}</div></form></div></div>`;
    },
    acts: Object.assign({}, common, {
      'df.stf': (el) => { set('stf', el.dataset.v); set('sel', ''); A.render(); }, 'df.sel': (el) => { set('sel', el.dataset.id); A.render(); },
      'df.save': (f, d) => {
        const e = H.enc(d.id); const p = H.pat(e.patientId); const items = Object.keys(d).filter((k) => k.startsWith('it_') && d[k]).map((k) => k.slice(3).split('|')[1]);
        let add = 0; items.forEach((it) => { if (!S.where('defs', (x) => x.encId === e.id && x.item === it && x.status !== '완료').length) { S.add('defs', { id: H.uid('df'), encId: e.id, patientId: p.id, item: it, to: d.to, status: '요청', at: Date.now(), by: H.who() }); add++; } });
        S.where('defs', (x) => x.encId === e.id && x.status !== '완료' && !items.includes(x.item)).forEach((x) => { x.status = '완료'; x.doneAt = Date.now(); });
        Object.assign(mi(e), { defChecked: true, defRemark: d.remark, defBy: H.who(), defAt: Date.now() }); S.save();
        if (add) H.notify(/간호사/.test(d.to) ? 'ward:' + e.ward : 'doctor', `미비 기록 작성 요청 (의료정보팀): ${p.name} — ${items.slice(0, 5).join(', ')}${items.length > 5 ? ' 외' : ''}`, { patientId: p.id });
        UI.toast(items.length ? `미비 ${items.length}항목 (새로 ${add}건) — ${d.to}에게 요청` : '미비 없음 — 완료', items.length ? 'warn' : 'ok'); A.render();
      },
      'df.intern': (el) => { const e = H.enc(el.dataset.id); ['인턴 기록', '인턴 서명'].forEach((it) => { if (!S.where('defs', (x) => x.encId === e.id && x.item === it && x.status !== '완료').length) S.add('defs', { id: H.uid('df'), encId: e.id, patientId: e.patientId, item: it, to: `${e.dept} 인턴`, status: '요청', at: Date.now(), by: H.who() }); }); S.save(); UI.toast('인턴 미비 2건 생성', 'ok'); A.render(); },
    }),
  });
})();
