// 병동 간호 확장: 분만실(LD) + 신생아실·신생아중환자실(NB)
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const K = H.wardKit;
  const HR = 3600000;
  H.wardExt = H.wardExt || {};
  const pick = (name, opts, v, on) => UI.pick(name, opts.map((o) => (typeof o === 'object' ? o : { v: o, l: o })), v, on ? { on } : {});

  // ───────── 분만실 ─────────
  function partograph(recs) {
    if (!recs.length) return UI.empty('분만 진행 기록이 없습니다');
    const W = 720, Hh = 300, L = 44, R = 20, Tp = 16, B = 34;
    const t0 = recs[0].at; const hours = 12;
    const x = (t) => L + ((t - t0) / (hours * HR)) * (W - L - R);
    const y = (cm) => Tp + (1 - cm / 10) * (Hh - Tp - B);
    let g = '';
    for (let c = 0; c <= 10; c += 2) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(c)}" y2="${y(c)}"/><text x="${L - 6}" y="${y(c) + 4}" text-anchor="end">${c}cm</text>`;
    for (let h = 0; h <= hours; h += 2) g += `<line class="grid" x1="${x(t0 + h * HR)}" x2="${x(t0 + h * HR)}" y1="${Tp}" y2="${Hh - B}" stroke-dasharray="3 3"/><text x="${x(t0 + h * HR)}" y="${Hh - 12}" text-anchor="middle">${h}시간</text>`;
    const act = recs.find((r) => r.dil >= 4);
    let lines = '';
    if (act) {
      const a0 = act.at, d0 = act.dil, tEnd = a0 + (10 - d0) * HR;
      lines = `<line x1="${x(a0)}" y1="${y(d0)}" x2="${x(tEnd)}" y2="${y(10)}" stroke="var(--t-prog)" stroke-width="2" stroke-dasharray="6 4"/><text x="${x(tEnd) + 4}" y="${y(10) + 14}" fill="var(--t-prog)">경계선</text>
        <line x1="${x(a0 + 4 * HR)}" y1="${y(d0)}" x2="${x(tEnd + 4 * HR)}" y2="${y(10)}" stroke="var(--t-stat)" stroke-width="2" stroke-dasharray="6 4"/><text x="${Math.min(W - 60, x(tEnd + 4 * HR) - 40)}" y="${y(10) + 28}" fill="var(--t-stat)">조치선</text>`;
    }
    const path = recs.map((r, i) => `${i ? 'L' : 'M'}${x(r.at).toFixed(1)} ${y(r.dil).toFixed(1)}`).join(' ');
    const pts = recs.map((r) => `<circle cx="${x(r.at)}" cy="${y(r.dil)}" r="5" fill="var(--accent)"/><text x="${x(r.at) + 7}" y="${y(r.dil) - 7}" fill="var(--fg-2)">하강 ${r.station > 0 ? '+' : ''}${r.station}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="분만 진행표">${g}${lines}<path d="${path}" stroke="var(--accent)" stroke-width="3" fill="none"/>${pts}</svg>
      <div class="legend"><span><i style="border-color:var(--accent)"></i>자궁경부 열림(cm)</span><span><i style="border-color:var(--t-prog);border-style:dashed"></i>경계선 (시간당 1cm)</span><span><i style="border-color:var(--t-stat);border-style:dashed"></i>조치선 (경계선 + 4시간)</span></div>`;
  }
  function labor(p, e) {
    const recs = H.recs(p.id, 'labor').slice().reverse();
    const last = recs[recs.length - 1] || {};
    const o = p.obs || {};
    return `<div class="gap-m">
      <div class="row box" style="background:var(--surface)"><span><b>임신·출산</b> ${o.g || '-'}회 임신 ${o.p ?? '-'}회 출산</span><span><b>임신 주수</b> ${esc(o.ga || '-')}</span><span><b>B군 연쇄상구균</b> ${esc(o.gbs || '-')}</span><span><b>B형간염 항원</b> ${esc(o.hbsag || '-')}</span></div>
      <div class="panel"><div class="panel-h"><h3>분만 진행표 (파토그램)</h3></div><div class="panel-b">${partograph(recs)}
        ${UI.note('자궁경부가 4cm 이상 열린 뒤에는 시간당 1cm 정도 열리는 것이 정상입니다. 진행선이 경계선 오른쪽으로 넘어가면 진행이 느린 것이고, 조치선을 넘으면 의사가 조치(옥시토신·제왕절개 등)를 결정합니다.', 'info')}</div></div>
      <form data-submit="ob.labor" class="panel"><div class="panel-h"><h3>내진·진통 기록 — ${T.hm(Date.now())}</h3></div><div class="panel-b gap-m">
        <div class="form-grid">${UI.select('dil', '자궁경부 열림 (cm)', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(String), String(last.dil ?? 4))}${UI.select('station', '아기 머리 하강도', ['-3', '-2', '-1', '0', '+1', '+2', '+3'], String(last.station ?? -1))}
          ${UI.input('freq', '수축 횟수 (10분에)', last.freq ?? '', { type: 'number' })}${UI.input('dur', '수축 지속 (초)', last.dur ?? '', { type: 'number' })}${UI.select('intensity', '수축 강도', ['약함', '중간', '강함'], last.intensity || '중간')}
          ${UI.select('membrane', '양막', ['유지', '파수 — 맑음', '파수 — 태변 섞임', '파수 — 피 섞임'], last.membrane || '유지')}${UI.input('fhr', '태아 심박 (회/분)', '', { type: 'number' })}</div>
        ${H.recs(p.id, 'labor').length && last.freq > 5 ? UI.note('10분에 5번 넘는 수축은 과다 수축입니다. 옥시토신을 쓰고 있다면 멈추고 의사에게 알립니다.', 'danger') : ''}
        <div class="btn-row end">${UI.btn('기록', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></div></form></div>`;
  }

  function ctg(pattern) {
    const W = 760, Hh = 300, L = 40; const top = 10, fh = 190, ub = 210, uh = 70;
    const yF = (b) => top + (1 - (b - 50) / 160) * fh;
    const yU = (v) => ub + (1 - v / 100) * uh;
    let g = '';
    for (let b = 60; b <= 200; b += 20) g += `<line class="grid" x1="${L}" x2="${W}" y1="${yF(b)}" y2="${yF(b)}"/><text x="${L - 4}" y="${yF(b) + 4}" text-anchor="end">${b}</text>`;
    g += `<rect x="${L}" y="${yF(160)}" width="${W - L}" height="${yF(110) - yF(160)}" fill="var(--t-done-soft)" opacity=".5"/>`;
    for (let m = 0; m <= 20; m += 2) g += `<line class="grid" x1="${L + m * 36}" x2="${L + m * 36}" y1="${top}" y2="${ub + uh}"/>`;
    const base = { normal: 140, late: 152, variable: 138, brady: 96 }[pattern] || 140;
    const varAmp = { normal: 8, late: 2.5, variable: 7, brady: 3 }[pattern] || 8;
    const contr = [3, 6.5, 10, 13.5, 17]; // 분
    let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const fpts = [], upts = [];
    for (let s = 0; s <= 1200; s += 4) {
      const m = s / 60; let v = base + (rnd() * 2 - 1) * varAmp;
      let u = 8;
      contr.forEach((c) => { const d = m - c; if (Math.abs(d) < 0.75) u += 70 * Math.cos((d / 0.75) * Math.PI / 2) ** 2;
        if (pattern === 'normal' && Math.abs(d + 1.4) < 0.4) v += 22 * Math.cos(((d + 1.4) / 0.4) * Math.PI / 2) ** 2;
        if (pattern === 'late' && d > 0 && d < 1.6) v -= 26 * Math.sin((d / 1.6) * Math.PI);
        if (pattern === 'variable' && Math.abs(d) < 0.35) v -= 45 * (1 - Math.abs(d) / 0.35); });
      fpts.push(`${(L + (s / 1200) * (W - L)).toFixed(1)},${yF(v).toFixed(1)}`); upts.push(`${(L + (s / 1200) * (W - L)).toFixed(1)},${yU(u).toFixed(1)}`);
    }
    return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="태아 심박 감시 그래프">${g}
      <polyline points="${fpts.join(' ')}" fill="none" stroke="var(--t-stat)" stroke-width="1.6"/><line x1="${L}" x2="${W}" y1="${ub}" y2="${ub}" stroke="var(--line-strong)"/>
      <polyline points="${upts.join(' ')}" fill="none" stroke="var(--t-sent)" stroke-width="1.6"/><text x="${L + 4}" y="${ub + 14}">자궁 수축</text><text x="${L + 4}" y="${top + 12}">태아 심박 (회/분) · 초록 띠 = 정상 110~160</text></svg>`;
  }
  function fhr(p) {
    const pat = (p.scenario && p.scenario.fhr) || 'normal';
    const hist = H.recs(p.id, 'fhr');
    return `<div class="gap-m"><div class="panel"><div class="panel-h"><h3>태아 심박 감시 (최근 20분)</h3><span class="grow"></span><span class="small muted">한 칸 = 2분</span></div><div class="panel-b">${ctg(pat)}</div></div>
      <form data-submit="ob.fhr" class="panel"><div class="panel-h"><h3>판독</h3></div><div class="panel-b gap-m">
        <div class="form-grid">${UI.input('base', '기본 심박 (회/분)', '', { type: 'number' })}</div>
        <div class="q-block"><div class="q">변이 (심박이 오르내리는 폭)</div>${pick('var', ['없음', '최소 (5 이하)', '중등도 (6~25)', '현저 (25 초과)'], '')}</div>
        <div class="q-block"><div class="q">가속 (15회 이상 15초 이상 올라감)</div>${pick('acc', ['있음', '없음'], '')}</div>
        <div class="q-block"><div class="q">감속</div>${pick('dec', ['없음', '조기 감속 (수축과 같이)', '후기 감속 (수축 뒤에 늦게)', '변이성 감속 (갑자기 V자)', '지연 감속 (2분 이상)'], '')}</div>
        ${UI.sec('이상이 있으면 하는 자궁 내 소생술')}
        <div class="gap-s">${['산모를 왼쪽으로 눕힘', '산소 투여', '수액 속도 올림', '옥시토신 중단', '의사에게 즉시 알림', '지속 감시'].map((t) => UI.check('iv', t, false, { multi: true, value: t })).join('')}</div>
        <div class="btn-row end">${UI.btn('판독 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div>
        ${hist.length ? UI.table([{ h: '시각' }, { h: '기본' }, { h: '변이' }, { h: '감속' }, { h: '단계' }], hist.slice(0, 5).map((r) => [`<span class="num small">${T.hm(r.at)}</span>`, r.base, esc(r.var), esc(r.dec), UI.chip(r.cat + '단계', r.cat === 1 ? 'done' : r.cat === 2 ? 'prog' : 'stat')])) : ''}
      </div></form></div>`;
  }

  const APGAR = [['hr', '심박', ['없음', '100 미만', '100 이상']], ['resp', '호흡', ['없음', '약하게 울음·불규칙', '크게 울음']], ['tone', '근육 긴장', ['늘어짐', '팔다리 약간 굽힘', '활발히 움직임']], ['refl', '자극 반응', ['반응 없음', '얼굴 찡그림', '울거나 기침·재채기']], ['color', '피부색', ['온몸 파랗거나 창백', '몸은 분홍·손발 파랑', '온몸 분홍']]];
  function birth(p, e) {
    const done = H.recs(p.id, 'birth')[0];
    if (done) return `${UI.note(`분만 완료 — ${T.dhm(done.at)} ${esc(done.method)}. 아기: ${done.sex === 'M' ? '남' : '여'}, ${done.weight}g, 아프가 1분 ${done.apgar1}점 / 5분 ${done.apgar5}점 → ${esc(done.to || '신생아실')}`, 'ok')}<p class="muted">이제 "산후 관찰" 탭에서 산모를 관찰하세요.</p>`;
    const ap = (m) => APGAR.map(([k, q, opts]) => `<div class="q-block"><div class="q">${esc(q)}</div>${pick(`a${m}_${k}`, opts.map((l, i) => ({ v: i, l: `${l} (${i})` })), '', 'ob.apgar')}</div>`).join('');
    return `<form data-submit="ob.birth" class="gap-m" id="birth-form">
      ${UI.note('아기가 태어나면 시각을 기록하고, 1분·5분에 아프가 점수를 매깁니다. 7점 미만이면 신생아 소생술이 필요할 수 있습니다. 저장하면 아기가 신생아실(또는 신생아중환자실)에 자동으로 입원됩니다.', 'info')}
      <div class="form-grid">${UI.input('time', '출생 시각', T.hm(Date.now()))}${UI.fld('분만 방법', pick('method', ['자연분만', '흡입 분만', '제왕절개'], '자연분만'))}${UI.fld('성별', pick('sex', [{ v: 'M', l: '남아' }, { v: 'F', l: '여아' }], 'F'))}
        ${UI.input('weight', '몸무게 (g)', '3150', { type: 'number' })}${UI.input('length', '키 (cm)', '50', { type: 'number' })}${UI.input('head', '머리둘레 (cm)', '34', { type: 'number' })}</div>
      <div class="grid2"><div class="gap-s">${UI.sec('아프가 1분')}${ap(1)}<div class="box"><span class="muted small">1분 점수</span> <span class="score-big" id="ap1">-</span></div></div>
        <div class="gap-s">${UI.sec('아프가 5분')}${ap(5)}<div class="box"><span class="muted small">5분 점수</span> <span class="score-big" id="ap5">-</span></div></div></div>
      <div class="form-grid">${UI.input('placenta', '태반 나온 시각', T.hm(Date.now() + 10 * 60000))}${UI.input('ebl', '출혈량 (mL)', '300', { type: 'number' })}${UI.select('peri', '회음부', ['손상 없음', '1도 열상', '2도 열상', '3도 열상', '4도 열상', '회음 절개 후 봉합'], '2도 열상')}</div>
      <div class="btn-row end">${UI.btn('분만 기록 저장 → 아기 입원', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div></form>`;
  }
  function pp(p) {
    const list = H.recs(p.id, 'pp');
    const total = list.reduce((s, r) => s + (Number(r.blood) || 0), 0) + Number((H.recs(p.id, 'birth')[0] || {}).ebl || 0);
    return `<div class="grid2" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)">
      <form data-submit="ob.pp" class="panel"><div class="panel-h"><h3>산후 관찰 (첫 1시간 15분마다, 다음 1시간 30분마다)</h3></div><div class="panel-b gap-m">
        <div class="q-block"><div class="q">자궁저부 높이</div>${pick('fundus', ['배꼽 아래 1~2cm', '배꼽 높이', '배꼽 위 1cm', '배꼽 위 2cm 이상'], '배꼽 높이')}</div>
        <div class="q-block"><div class="q">자궁 수축</div>${pick('tone', ['단단함', '물렁함'], '단단함')}</div>
        <div class="q-block"><div class="q">오로 (질 분비물) 양</div>${pick('lochia', ['적음', '중간', '많음 (패드 1시간에 1개 이상)', '덩어리 나옴'], '중간')}</div>
        <div class="form-grid">${UI.select('bladder', '방광', ['비어 있음', '차 있음 (배뇨 유도)'], '비어 있음')}${UI.select('peri', '회음부', ['붓기·혈종 없음', '약간 부음', '혈종 의심'], '붓기·혈종 없음')}
          ${UI.input('sbp', '혈압 (수축기)', '', { type: 'number' })}${UI.input('hr', '맥박', '', { type: 'number' })}${UI.input('blood', '이번 출혈량 (mL)', '30', { type: 'number' })}</div>
        <div class="btn-row end">${UI.btn('기록', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></div></form>
      <div class="gap-m"><div class="box"><span class="muted small">분만 후 누적 출혈</span> <span class="score-big" style="${total >= 500 ? 'color:var(--t-stat)' : ''}">${total}mL</span> ${total >= 500 ? UI.chip('산후출혈 기준 (자연분만 500mL)', 'stat') : ''}</div>
        ${UI.note('<b>산후출혈 대처:</b> 자궁저부 마사지 → 방광 비우기 → 처방된 자궁수축제(옥시토신) 확인 → 의사 즉시 알림 → 정맥로 2개·혈액 준비', 'warn')}
        <div class="panel"><div class="panel-h"><h3>관찰 기록</h3></div><div class="panel-b">${UI.table([{ h: '시각' }, { h: '자궁' }, { h: '오로' }, { h: '혈압·맥박' }], list.map((r) => [`<span class="num">${T.hm(r.at)}</span>`, `${esc(r.fundus)} · ${r.tone === '물렁함' ? '<b style="color:var(--t-stat)">물렁함</b>' : '단단함'}`, esc(r.lochia), `${r.sbp || '-'}/${r.hr || '-'}`]), { empty: UI.empty('아직 없습니다') })}</div></div></div></div>`;
  }
  H.wardExt.LD = {
    tabs: [{ id: 'labor', label: '분만 진행표', icon: 'list' }, { id: 'fhr', label: '태아 심박 감시', icon: 'heart' }, { id: 'birth', label: '분만 기록', icon: 'user' }, { id: 'pp', label: '산후 관찰', icon: 'drop' }],
    render: { labor, fhr, birth, pp },
  };

  // ───────── 신생아실·NICU ─────────
  const hoursOld = (p) => Math.floor((Date.now() - (p.bornAt || new Date(p.birth).getTime())) / HR);
  function nbAssess(p) {
    const b = H.recs(p.id, 'birth')[0] || {};
    const list = H.recs(p.id, 'nb');
    const lastW = list[0] ? list[0].weight : b.weight;
    const loss = b.weight && lastW ? (((b.weight - lastW) / b.weight) * 100).toFixed(1) : null;
    return `<div class="gap-m">
      <div class="row box" style="background:var(--surface)"><span><b>출생</b> ${b.at ? T.dhm(b.at) : '-'} (생후 ${hoursOld(p)}시간)</span><span><b>재태 기간</b> ${esc(b.ga || '-')}</span><span><b>분만</b> ${esc(b.method || '-')}</span><span><b>아프가</b> ${b.apgar1 ?? '-'} / ${b.apgar5 ?? '-'}</span><span><b>출생 체중</b> ${b.weight || '-'}g</span>
        <span><b>체중 변화</b> ${loss != null ? `${loss > 0 ? '-' : '+'}${Math.abs(loss)}%` : '-'} ${loss > 10 ? UI.chip('10% 넘게 줄어듦 — 수유 확인', 'stat') : loss > 7 ? UI.chip('7% 넘음 — 주의', 'prog') : ''}</span></div>
      <form data-submit="ob.nb" class="panel"><div class="panel-h"><h3>신생아 사정</h3></div><div class="panel-b gap-m">
        <div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))">${UI.input('weight', '몸무게 (g)', '', { type: 'number' })}${UI.input('temp', '체온 (겨드랑이 ℃)', '', { type: 'number', step: '0.1' })}${UI.input('hr', '심박 (회/분)', '', { type: 'number' })}${UI.input('rr', '호흡 (회/분)', '', { type: 'number' })}${UI.input('spo2', '산소포화도', '', { type: 'number' })}</div>
        ${UI.sec('머리부터 발끝까지 신체 검진 (정상이면 표시)')}
        <div class="row">${['대천문 평평함', '입천장 갈라짐 없음', '쇄골 골절 없음', '고관절 탈구 없음 (오르톨라니·바로우)', '항문 열려 있음', '제대 혈관 3개 (동맥 2·정맥 1)', '모로 반사', '빨기 반사', '잡기 반사', '피부 분홍색', '황달 눈에 띄지 않음'].map((t) => UI.check('exam', t, false, { multi: true, value: t })).join('')}</div>
        ${UI.input('note', '특이 사항', '', { cls: 'wide' })}
        <div class="btn-row end">${UI.btn('사정 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></div></form>
      <div class="panel"><div class="panel-h"><h3>측정 기록</h3></div><div class="panel-b">${UI.table([{ h: '시각' }, { h: '몸무게' }, { h: '체온' }, { h: '심박·호흡' }, { h: '메모' }], list.map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, `${r.weight || '-'}g`, r.temp, `${r.hr || '-'} / ${r.rr || '-'}`, `<span class="small">${esc(r.note || '')}</span>`]), { empty: UI.empty('기록이 없습니다') })}</div></div></div>`;
  }
  function feed(p) {
    const list = H.recs(p.id, 'feed'); const day = Date.now() - 24 * HR;
    const today = list.filter((r) => r.at > day);
    const ml = today.reduce((s, r) => s + (Number(r.ml) || 0), 0); const kg = (p.weight || 3);
    const nicu = (H.activeEnc(p.id) || {}).room === 'NICU';
    return `<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)">
      <form data-submit="ob.feed" class="panel"><div class="panel-h"><h3>수유·배설 기록</h3></div><div class="panel-b gap-m">
        ${UI.fld('수유 종류', pick('type', nicu ? ['위관 (유축 모유)', '위관 (미숙아 분유)', '젖병 (유축 모유)', '모유 직접'] : ['모유 직접', '유축 모유 (젖병)', '분유'], nicu ? '위관 (유축 모유)' : '모유 직접'))}
        <div class="form-grid">${UI.input('ml', '양 (mL, 직접 수유는 분)', '', { type: 'number' })}${nicu ? UI.input('residual', '위 잔류량 (mL)', '0', { type: 'number' }) : ''}${UI.input('urine', '소변 (기저귀 수)', '1', { type: 'number' })}${UI.select('stool', '대변', ['없음', '태변 (검은 녹색)', '이행변', '노란 변'], '없음')}${UI.select('vomit', '토함', ['없음', '조금 게움', '많이 토함', '초록색 토 (즉시 보고)'], '없음')}</div>
        ${nicu ? UI.note('위관 수유 전: 관 위치 확인(흡인물 산도), 잔류량이 이전 수유량의 절반 넘으면 수유 보류하고 보고', 'warn') : ''}
        <div class="btn-row end">${UI.btn('기록', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></div></form>
      <div class="gap-m"><div class="mini-vs"><div><div class="k">24시간 수유량</div><div class="v">${ml}mL</div></div><div><div class="k">하루 체중당</div><div class="v">${Math.round(ml / kg)}mL/kg</div></div><div><div class="k">24시간 소변</div><div class="v">${today.reduce((s, r) => s + (Number(r.urine) || 0), 0)}번</div></div><div><div class="k">24시간 대변</div><div class="v">${today.filter((r) => r.stool && r.stool !== '없음' && r.stool !== 0).length}번</div></div></div>
        <div class="panel"><div class="panel-h"><h3>수유 기록</h3></div><div class="panel-b">${UI.table([{ h: '시각' }, { h: '종류' }, { h: '양' }, { h: '잔류' }, { h: '배설' }], list.slice(0, 16).map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, esc(r.type), r.ml ? `${r.ml}mL` : '-', r.residual ? `${r.residual}mL` : '-', `소변 ${r.urine || 0} · ${esc(r.stool === 1 ? '대변' : r.stool || '-')}`]), { maxH: '22rem' })}</div></div></div></div>`;
  }
  const biliLimit = (h, pre) => (h < 24 ? 8 : h < 48 ? 12 : h < 72 ? 15 : 17) - (pre ? 3 : 0);
  function bili(p) {
    const list = H.recs(p.id, 'bili'); const h = hoursOld(p); const pre = p.scenario && p.scenario.preterm;
    const photo = list[0] && list[0].photo;
    return `<div class="grid2">
      <form data-submit="ob.bili" class="panel"><div class="panel-h"><h3>황달 측정</h3></div><div class="panel-b gap-m">
        ${UI.note(`생후 ${h}시간 · 광선치료 기준 약 <b>${biliLimit(h, pre)} mg/dL</b> ${pre ? '(미숙아라 더 낮게 봄)' : ''}. 교육용으로 단순화한 기준입니다. 생후 24시간 안에 생긴 황달은 언제나 비정상입니다.`, 'info')}
        <div class="form-grid">${UI.input('val', '경피 빌리루빈 (mg/dL)', '', { type: 'number', step: '0.1' })}${UI.fld('광선치료', pick('photo', [{ v: '1', l: '하는 중' }, { v: '', l: '안 함' }], photo ? '1' : ''))}</div>
        <div class="btn-row end">${UI.btn('측정값 불러오기 (사례값)', 'ob.biliFill', { icon: 'refresh' })}${UI.btn('저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div>
        ${photo ? `${UI.sec('광선치료 중 간호')}<div class="gap-s">${['눈 가리개 씌움', '기저귀만 입히고 피부 최대한 노출', '2~3시간마다 자세 바꾸기', '체온 측정 (과열·저체온)', '수유 늘리기 (탈수 예방)', '피부 발진·묽은 변 관찰'].map((t) => UI.check('care', t, false, { multi: true, value: t })).join('')}</div>` : ''}</div></form>
      <div class="panel"><div class="panel-h"><h3>황달 기록</h3></div><div class="panel-b">${UI.table([{ h: '시각' }, { h: '생후' }, { h: '수치' }, { h: '기준' }, { h: '광선치료' }], list.map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, `${r.hours}시간`, `<b class="num">${r.val}</b>`, r.val >= biliLimit(r.hours, pre) ? UI.chip('기준 넘음', 'stat') : UI.chip('기준 아래', 'done'), r.photo ? '하는 중' : '-']), { empty: UI.empty('기록이 없습니다') })}</div></div></div>`;
  }
  const CARE = ['비타민 K 근육주사', '안연고 (에리스로마이신)', 'B형간염 1차 접종', '선천성 대사이상 검사 (생후 48~72시간 발뒤꿈치 채혈)', '청각 선별 검사 (양쪽 귀)', '제대 관리 교육 (말려 두기)', '퇴원 교육 (목욕·수유·황달 관찰)', '결핵 예방접종(BCG) 안내 — 생후 4주 안'];
  function nbcare(p) {
    const recs = H.recs(p.id, 'nbcare'); const e = H.activeEnc(p.id) || {};
    const nicu = H.recs(p.id, 'nicu');
    return `<div class="gap-m">
      <div class="panel"><div class="panel-h"><h3>예방접종·선별검사</h3></div><div class="panel-b">${UI.table([{ h: '항목' }, { h: '상태' }, { h: '' }], CARE.map((c) => { const r = recs.find((x) => x.item === c); return [esc(c), r ? `${UI.chip('완료', 'done')} <span class="small muted">${T.mdhm(r.at)} ${esc(r.result || '')}</span>` : UI.chip('아직', 'prog'), r ? '' : UI.btn('시행 기록', 'ob.care', { size: 'sm', kind: 'pri', data: { item: c } })]; }))}</div></div>
      ${e.room === 'NICU' ? `<form data-submit="ob.nicu" class="panel"><div class="panel-h"><h3>신생아중환자실 — 인큐베이터·사건 기록</h3></div><div class="panel-b gap-m">
        <div class="form-grid">${UI.input('incTemp', '인큐베이터 온도 (℃)', (nicu[0] || {}).incTemp ?? 33.5, { type: 'number', step: '0.1' })}${UI.input('humid', '습도 (%)', (nicu[0] || {}).humid ?? 60, { type: 'number' })}${UI.select('mode', '온도 조절 방식', ['피부 온도 조절 (36.5℃)', '공기 온도 조절'], '피부 온도 조절 (36.5℃)')}
          ${UI.select('event', '무호흡·서맥 사건', ['없음', '무호흡 20초 미만 — 저절로 회복', '무호흡 — 가벼운 자극으로 회복', '서맥 (100 미만) + 산소포화도 저하 — 산소 공급', '앰부 백 환기 필요 (즉시 보고)'], '없음')}${UI.input('kangaroo', '캥거루 케어 (분)', '0', { type: 'number' })}</div>
        <div class="btn-row end">${UI.btn('기록', '', { type: 'submit', kind: 'pri' })}</div>
        ${UI.table([{ h: '시각' }, { h: '인큐베이터' }, { h: '사건' }], nicu.slice(0, 6).map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, `${r.incTemp}℃ · ${r.humid}%`, esc(r.event || '-')]))}</div></form>` : ''}</div>`;
  }
  H.wardExt.NB = {
    tabs: [{ id: 'nbassess', label: '신생아 사정', icon: 'user' }, { id: 'feed', label: '수유·배설', icon: 'drop' }, { id: 'bili', label: '황달', icon: 'sun' }, { id: 'nbcare', label: '접종·선별검사', icon: 'clip' }],
    render: { nbassess: nbAssess, feed, bili, nbcare },
  };

  const apgarSum = (d, m) => APGAR.reduce((s, [k]) => s + (H.num(d[`a${m}_${k}`]) || 0), 0);
  const apgarDone = (d, m) => APGAR.every(([k]) => d[`a${m}_${k}`] !== '');

  Object.assign(H.mods.ward.acts, {
    'ob.labor': (f, d) => {
      const p = A.pat(); const e = K.curEnc();
      H.addRec('labor', p.id, { dil: Number(d.dil), station: Number(d.station), freq: H.num(d.freq), dur: H.num(d.dur), intensity: d.intensity, membrane: d.membrane, fhr: H.num(d.fhr) });
      const warn = [];
      if (H.num(d.freq) > 5) warn.push('과다 수축'); if (d.membrane.includes('태변')) warn.push('태변 착색 양수'); if (H.num(d.fhr) && (H.num(d.fhr) < 110 || H.num(d.fhr) > 160)) warn.push(`태아 심박 ${d.fhr}`);
      if (Number(d.dil) === 10) warn.push('자궁경부 완전 개대 — 분만 준비');
      UI.toast(warn.length ? warn.join(', ') + ' — 의사에게 알리세요' : '분만 진행 기록', warn.length ? 'warn' : 'ok'); A.render();
    },
    'ob.fhr': (f, d) => {
      const p = A.pat(); if (!d.var || !d.dec) return UI.toast('변이와 감속을 골라 주세요', 'warn');
      const b = H.num(d.base) || 0;
      let cat = 2;
      if (d.var === '없음' && (d.dec.startsWith('후기') || d.dec.startsWith('변이') || b < 110)) cat = 3;
      else if (b >= 110 && b <= 160 && d.var.startsWith('중등도') && (d.dec === '없음' || d.dec.startsWith('조기'))) cat = 1;
      H.addRec('fhr', p.id, { base: b, var: d.var, acc: d.acc, dec: d.dec, cat, iv: d.iv || [] });
      if (cat >= 2) H.notify('doctor', `태아 심박 ${cat}단계: ${p.name} — ${d.dec}`, { patientId: p.id, level: cat === 3 ? 'stat' : '' });
      UI.toast(`태아 심박 ${cat}단계 (${cat === 1 ? '정상' : cat === 2 ? '불확실 — 관찰·중재' : '비정상 — 즉시 분만 고려'})`, cat === 1 ? 'ok' : cat === 2 ? 'warn' : 'err'); A.render();
    },
    'ob.apgar': (el) => { const d = H.formData(el.closest('form')); [1, 5].forEach((m) => { const s = document.getElementById('ap' + m); if (s) s.textContent = apgarDone(d, m) ? String(apgarSum(d, m)) : '-'; }); },
    'ob.birth': (f, d) => {
      if (!apgarDone(d, 1) || !apgarDone(d, 5)) return UI.toast('아프가 1분·5분 점수를 모두 골라 주세요', 'warn');
      const mom = A.pat(); const me = K.curEnc(); const a1 = apgarSum(d, 1), a5 = apgarSum(d, 5); const wt = Number(d.weight) || 3000;
      const ga = (mom.obs || {}).ga || '';
      const toNicu = wt < 2500 || a5 < 7 || /^3[0-6]주/.test(ga);
      const [hh, mm] = (d.time || '').split(':').map(Number); const bornAt = isNaN(hh) ? Date.now() : T.at(Date.now(), hh, mm || 0);
      const baby = S.add('patients', { id: H.uid('pt'), mrn: S.nextMrn(), name: `${mom.name} 아기`, sex: d.sex, birth: T.d(bornAt), bornAt, blood: '검사 전', height: Number(d.length) || 50, weight: wt / 1000, birthWeight: wt, ins: mom.ins, guardian: `엄마 ${mom.name}`, hx: `재태 기간 ${ga}, ${d.method}`, allergies: [], flags: {}, scenario: { bili: 6.5, preterm: toNicu } });
      const be = S.add('encounters', { id: H.uid('en'), patientId: baby.id, type: 'IPD', dept: '소아청소년과', doctorId: 'dr10', status: '입원중', at: bornAt, ward: 'NB', room: toNicu ? 'NICU' : '신생아실', bed: '1', diet: toNicu ? '위관 영양' : '모유 수유', cc: '출생', dx: [{ code: 'Z38.0', name: '병원에서 출생한 단태아', main: true }] });
      H.transfer(be, 'NB', be.room);
      const rec = { method: d.method, sex: d.sex, weight: wt, length: d.length, head: d.head, apgar1: a1, apgar5: a5, mother: mom.name, ga, ebl: Number(d.ebl) || 0, placenta: d.placenta, peri: d.peri, to: toNicu ? '신생아중환자실' : '신생아실' };
      H.addRec('birth', mom.id, rec); H.addRec('birth', baby.id, Object.assign({}, rec, { at: bornAt }));
      if (d.method === '제왕절개') { const mk = me.dx.find((x) => x.main); if (mk) Object.assign(mk, { code: 'O82', name: '제왕절개에 의한 단일 분만' }); }
      H.transfer(me, 'LD', '산후회복'); me.diet = '일반식';
      S.save();
      H.notify('ward:NB', `새 아기: ${baby.name} (${d.sex === 'M' ? '남' : '여'}, ${wt}g, 아프가 ${a1}/${a5}) → ${rec.to}`, { patientId: baby.id, level: toNicu ? 'stat' : '' });
      H.log('분만 기록', `${mom.name} ${d.method}, 아기 ${wt}g 아프가 ${a1}/${a5}`, mom.id);
      UI.toast(`분만 기록 저장 — 아기가 ${rec.to}에 입원했습니다`, 'ok'); K.set('tab', 'pp'); A.render();
    },
    'ob.pp': (f, d) => {
      const p = A.pat(); const e = K.curEnc();
      H.addRec('pp', p.id, { fundus: d.fundus, tone: d.tone, lochia: d.lochia, bladder: d.bladder, peri: d.peri, sbp: H.num(d.sbp), hr: H.num(d.hr), blood: H.num(d.blood) || 0 });
      if (d.sbp) S.add('vitals', { id: H.uid('vs'), patientId: p.id, encId: e.id, at: Date.now(), by: H.who(), sbp: H.num(d.sbp), hr: H.num(d.hr) }, true);
      S.save();
      const bad = d.tone === '물렁함' || d.lochia.includes('많음') || d.lochia.includes('덩어리') || (H.num(d.hr) > 110);
      if (bad) H.notify('doctor', `산후출혈 의심: ${p.name} — 자궁 ${d.tone}, 오로 ${d.lochia}`, { patientId: p.id, level: 'stat' });
      UI.toast(bad ? '산후출혈 의심 — 자궁저부 마사지, 방광 비우기, 의사에게 알렸습니다' : '산후 관찰 기록', bad ? 'err' : 'ok'); A.render();
    },
    'ob.nb': (f, d) => {
      const p = A.pat(); const e = K.curEnc();
      H.addRec('nb', p.id, { weight: H.num(d.weight), temp: H.num(d.temp), hr: H.num(d.hr), rr: H.num(d.rr), exam: d.exam || [], note: d.note });
      if (d.weight) p.weight = Number(d.weight) / 1000;
      S.add('vitals', { id: H.uid('vs'), patientId: p.id, encId: e.id, at: Date.now(), by: H.who(), bt: H.num(d.temp), hr: H.num(d.hr), rr: H.num(d.rr), spo2: H.num(d.spo2) }, true);
      S.save();
      const warn = [];
      if (H.num(d.temp) && (H.num(d.temp) < 36.5 || H.num(d.temp) > 37.5)) warn.push(`체온 ${d.temp}`); if (H.num(d.rr) > 60) warn.push(`호흡 ${d.rr} (빠름)`); if (H.num(d.hr) && (H.num(d.hr) < 100 || H.num(d.hr) > 180)) warn.push(`심박 ${d.hr}`);
      UI.toast(warn.length ? `주의: ${warn.join(', ')}` : '신생아 사정 저장', warn.length ? 'warn' : 'ok'); A.render();
    },
    'ob.feed': (f, d) => {
      const p = A.pat(); H.addRec('feed', p.id, { type: d.type, ml: H.num(d.ml) || 0, residual: H.num(d.residual) || 0, urine: H.num(d.urine) || 0, stool: d.stool, vomit: d.vomit });
      if (d.vomit.includes('초록')) H.notify('doctor', `초록색 구토: ${p.name} — 장폐색 의심`, { patientId: p.id, level: 'stat' });
      UI.toast('수유 기록', d.vomit.includes('초록') ? 'err' : 'ok'); A.render();
    },
    'ob.biliFill': (el) => { const p = A.pat(); const i = el.closest('form').querySelector('[name=val]'); if (i && !i.value) i.value = (((p.scenario && p.scenario.bili) || 8) + Math.random() * 1.5).toFixed(1); },
    'ob.bili': (f, d) => {
      const p = A.pat(); if (!d.val) return UI.toast('수치를 넣어 주세요', 'warn');
      const h = hoursOld(p); const lim = biliLimit(h, p.scenario && p.scenario.preterm);
      H.addRec('bili', p.id, { val: Number(d.val), hours: h, photo: !!d.photo, care: d.care || [] });
      if (Number(d.val) >= lim && !d.photo) H.notify('doctor', `황달 ${d.val}mg/dL (생후 ${h}시간) — 광선치료 기준 넘음: ${p.name}`, { patientId: p.id, level: 'stat' });
      UI.toast(Number(d.val) >= lim ? `기준(${lim}) 넘음 — 의사에게 알렸습니다` : '황달 기록', Number(d.val) >= lim ? 'warn' : 'ok'); A.render();
    },
    'ob.care': (el) => {
      const item = el.dataset.item;
      if (item.startsWith('청각')) return UI.modal({ title: '청각 선별 검사', size: 'narrow', body: `<form data-submit="ob.careGo" class="gap-m"><input type="hidden" name="item" value="${esc(item)}">${UI.fld('결과', pick('result', ['양쪽 통과', '오른쪽 재검 필요', '왼쪽 재검 필요', '양쪽 재검 필요'], '양쪽 통과'))}<div class="btn-row end">${UI.btn('저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
      const p = A.pat(); H.addRec('nbcare', p.id, { item }); H.log('신생아 처치', item, p.id); UI.toast(`${item} 기록`, 'ok'); A.render();
    },
    'ob.careGo': (f, d) => { const p = A.pat(); H.addRec('nbcare', p.id, { item: d.item, result: d.result }); UI.close(); UI.toast('청각 선별 검사 기록', d.result.includes('재검') ? 'warn' : 'ok'); A.render(); },
    'ob.nicu': (f, d) => {
      const p = A.pat(); H.addRec('nicu', p.id, { incTemp: H.num(d.incTemp), humid: H.num(d.humid), mode: d.mode, event: d.event, kangaroo: H.num(d.kangaroo) });
      if (d.event.includes('앰부')) H.notify('doctor', `NICU 사건: ${p.name} — ${d.event}`, { patientId: p.id, level: 'stat' });
      UI.toast('신생아중환자실 기록', d.event === '없음' ? 'ok' : 'warn'); A.render();
    },
  });
})();
