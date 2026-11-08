// 로그인, 부서 지도, 준비 중 안내
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;

  // ── 로그인 ──
  let role = 'student';
  H.reg({
    id: 'login', title: '로그인', layout: 'bare',
    render() {
      const nodes = [];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 10; c++) if ((r * 7 + c * 3) % 5 !== 0) nodes.push(`<rect x="${c * 62 + 6}" y="${r * 44 + 6}" width="50" height="30" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/>`);
      return `<div class="login-wrap">
        <section class="login-art">
          <svg class="grid-bg" viewBox="0 0 620 310" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${nodes.join('')}</svg>
          <div style="position:relative">
            <div class="logo" style="margin-bottom:2.5rem"><span class="logo-mark">SSV</span><span>SSV 병원<small>상급종합병원 · 교육용</small></span></div>
            <h1>병원 전산을 직접 눌러 보며 배우는 간호 실습실</h1>
            <p style="margin-top:1rem;line-height:1.7">처방전달시스템(OCS), 전자의무기록(EMR), 간호기록(ENR)이 실제 병원처럼 이어집니다. 의사가 처방을 내면 약제부·검사실·영상의학과를 거쳐 병동 간호사에게 돌아옵니다.</p>
          </div>
          <div style="position:relative;display:flex;gap:1.5rem;flex-wrap:wrap;font-size:.85rem;color:var(--brand-fg-2)">
            <span>가상 환자 30여 명</span><span>처방 항목 170여 개</span><span>실습 부서 32곳</span>
          </div>
        </section>
        <section class="login-form">
          <div><h2>실습 시작하기</h2><p class="muted" style="margin:.3rem 0 0">비밀번호는 없습니다. 이름과 학번만 넣으세요.</p></div>
          <form data-submit="login.go" class="gap-m">
            ${UI.input('name', '이름', S.session().lastName || '', { req: true, ph: '예: 김간호' })}
            ${UI.input('sid', '학번 (교수자는 비워도 됩니다)', S.session().lastSid || '', { ph: '예: 20261234' })}
            <div class="fld"><span class="lbl">나는</span><div class="role-pick">
              <button type="button" data-act="login.role" data-v="student" class="${role === 'student' ? 'on' : ''}"><b>학생</b><span>병원 각 부서에서 실습</span></button>
              <button type="button" data-act="login.role" data-v="instructor" class="${role === 'instructor' ? 'on' : ''}"><b>교수자</b><span>실습 사례 관리·학생 기록 점검</span></button>
            </div></div>
            ${UI.btn('들어가기', '', { type: 'submit', kind: 'pri', size: 'lg', block: true, icon: 'send' })}
          </form>
          ${UI.note('실습 기록은 이 컴퓨터의 브라우저 안에만 저장됩니다. 과제로 낼 때는 안에서 "내 기록 복사하기"를 쓰세요.', 'info')}
          <p class="small muted" style="margin:0">모든 환자·의료진은 가상 인물이며, 약 용량·가격은 교육용 근사치입니다. 실제 진료에 쓰지 마세요.</p>
        </section>
      </div>`;
    },
    acts: {
      'login.role': (el) => { role = el.dataset.v; A.render(); },
      'login.go': (f, d) => {
        if (!d.name) { UI.toast('이름을 넣어 주세요', 'warn'); return; }
        S.setSession({ user: { name: d.name, sid: d.sid, role, at: Date.now() }, lastName: d.name, lastSid: d.sid });
        H.log('로그인', role === 'instructor' ? '교수자' : '학생');
        A.go('map');
      },
    },
  });

  // ── 부서 지도 ──
  // [행, 열, 이름, 종류, 갈 곳]  종류: his(주황) core(파랑) mgmt(초록) ext(회색) dash(점선)
  const NODES = [
    [1, 1, '그룹웨어', 'ext', 'nadmin'], [1, 2, '통합인사', 'core', 'nadmin'], [1, 3, '고객관리\n(VOC·CRM)', 'core', 'cs-voc'], [1, 4, '경리회계', 'mgmt', 'billing'], [1, 5, '교육/안전', 'mgmt', 'nadmin'], [1, 6, '마약류신고', 'ext', 'pharmacy'], [1, 7, '물류/공급', 'core', 'supply'], [1, 8, '구매/재고', 'core', 'supply'], [1, 9, '시설/기타', 'core', 'qi'], [1, 10, '식약청신고', 'ext', 'pharmacy'],
    [2, 1, 'SMS/알림톡', 'ext', 'appt'], [2, 2, '인사총무', 'mgmt', 'nadmin'], [2, 3, '교육수련', 'core', 'nadmin'], [2, 4, '예약/진료일정', 'core', 'resv'], [2, 5, '약/주사', 'core', 'pharmacy'], [2, 6, 'DUR/KIMS', 'ext', 'pharmacy'], [2, 7, '약무/조제', 'core', 'pharmacy'], [2, 8, '재활/물리', 'core', 'rehab'], [2, 9, '검수', 'core', 'supply'], [2, 10, '전화예약\n센터', 'core', 'callctr'],
    [3, 1, '홈페이지', 'ext', 'resv'], [3, 3, 'HIS Main', 'his', 'map'], [3, 4, '원무\n접수수납', 'core', 'opdreg'], [3, 5, '외래/간호', 'core', 'opdnurse'], [3, 6, '진료 OCS', 'his', 'ocs-opd'], [3, 7, '검사/채혈', 'core', 'phlebo'], [3, 8, '영상의학', 'core', 'radiology'], [3, 9, 'PACS', 'ext', 'radiology'],
    [4, 1, '환자\n모바일', 'ext', 'cs-pxe'], [4, 2, '계약처\n청구/미수', 'core', 'billing'], [4, 3, '증명발급', 'core', 'certdoc'], [4, 6, '진료 EMR', 'his', 'ocs-ipd'], [4, 8, '진단검사\n/병리', 'core', 'lab'], [4, 9, 'CP', 'core', 'qi'], [4, 10, 'CI / QI', 'core', 'qi'],
    [5, 1, '진료\n모바일', 'ext', 'ocs-ipd'], [5, 2, '진료협력\n/전원', 'core', 'referral'], [5, 4, '원무\n입퇴원', 'core', 'admreg'], [5, 5, '입원/간호', 'core', 'ward'], [5, 6, '간호 EMR', 'his', 'ward'], [5, 7, 'ACK I/F', 'ext', 'lab'], [5, 8, '기능/기타', 'core', 'func'], [5, 9, '카디악', 'ext', 'cath'],
    [6, 1, '자격조회', 'ext', 'opdreg'], [6, 2, '의뢰/회송', 'ext', 'cr-transfer'], [6, 3, '진단분석\n(KDRG)', 'core', 'mi-anal'], [6, 4, '심사\n사전/사후', 'core', 'dcreview'], [6, 5, '응급/간호', 'core', 'ward-er'], [6, 6, '의료정보', 'core', 'mrd'], [6, 7, '영양/NST', 'core', 'nst'], [6, 8, '감염', 'core', 'infection'], [6, 9, '감염병신고', 'ext', 'infection'], [6, 10, '검진센터', 'dash', 'checkup'],
    [7, 1, '심평원/\n행안부', 'ext', 'review'], [7, 2, '적정성평가', 'ext', 'qi'], [7, 3, '심결/삭감', 'core', 'appeal'], [7, 4, '청구/EDI', 'core', 'review'], [7, 5, 'NEDIS', 'ext', 'ocs-er'], [7, 6, '퇴원분석\n/미비', 'core', 'mi-dc1'], [7, 7, '통계분석', 'core', 'cr-dash'], [7, 8, 'BI', 'ext', 'qi'], [7, 9, 'DA', 'ext', 'mrd'], [7, 10, '산업보건', 'dash', 'nadmin'],
  ];
  const LIVE = { includes: (t) => !!t && !/^s\d/.test(t) && t !== 'map' };

  const JOBS = [
    { t: '진료 (의사 역할)', d: '환자를 진찰하고 처방을 내고 진료 기록을 씁니다. 외래·입원·응급마다 처방 화면이 다릅니다.', list: [
      ['ocs-opd', '외래 진료', '처방·원외처방전'], ['ocs-ipd', '입원 진료', '정규·추가 처방, 경과기록'], ['ocs-er', '응급 진료', '중증도·묶음처방·퇴실'] ] },
    { t: '간호', d: '간호사의 하루 — 인수부터 인계까지. 간호기록(ENR)이 핵심입니다.', list: [
      ['ward', '병동 간호', '7A 내과 · 8B 외과'], ['ward-er', '응급실 간호', '분류(KTAS)·관찰·응급 처치'], ['opdnurse', '외래 간호', '진료 전 준비·안내·주사실'], ['ward-icu', '중환자실 (ICU)', '흐름표·인공호흡기·점적'],
      ['or', '수술실·회복실', '일정·타임아웃·계수·회복실'], ['ward-ld', '분만실', '분만 진행·태아 감시·아프가'], ['ward-nb', '신생아실·신생아중환자실', '사정·수유·황달·접종'], ['dialysis', '인공신장실 (투석)', '투석 전·중·후 관찰'],
      ['cath', '심혈관센터', '응급 심근경색·조영술·스텐트'], ['endo', '내시경실', '장 정결·진정·조직검사·소독'], ['injection', '주사실', '외래 주사·이상반응·항암 주사'] ] },
    { t: '간호 — 전문 분야', d: '병동 밖에서 전문 간호사가 일하는 곳입니다.', list: [
      ['homecare', '가정간호', '방문 준비·방문 기록·욕창'], ['rehab', '재활', '근력·균형·일상생활 평가'], ['radonc', '방사선종양', '치료 회차·피부 부작용'], ['transplant', '장기이식 코디네이터', '대기자·뇌사 기증 9단계'],
      ['infection', '감염관리', '격리·신고·감시·손위생'], ['nst', '영양집중지원 (NST)', '영양 평가·배식 집계'], ['checkup', '종합검진센터', '문진·동선·판정·상담'], ['func', '기능검사실', '심전도·심초음파·폐기능·신경생리'] ] },
    { t: '진료 지원', d: '처방을 받아 조제하고, 채혈·검사·촬영·판독하고, 멸균 기구를 공급합니다.', list: [
      ['pharmacy', '약제부', '감사·조제·집계·불출'], ['phlebo', '채혈실', '라벨·채혈'], ['lab', '진단검사의학과', '자동화·혈액·요·미생물·분자·위탁·혈액은행·정도관리'], ['radiology', '영상의학과·PACS', '조영제실·일반·CT·MRI·투시·유방·골밀도·초음파·핵의학'], ['pathology', '병리과', '접수·육안·슬라이드·판독'], ['csr', '중앙공급실', '세척·포장·멸균·불출'] ] },
    { t: '원무 · 심사 · 의료정보', d: '실제 병원 원무·심사 화면과 같은 배치로 접수부터 청구·이의신청까지 합니다.', list: [
      ['opdreg', '외래 등록', '보험·할인·의뢰·진찰료'], ['opdpay', '외래 수납', '할인·감액·미수·카드·현금영수증'], ['admreg', '입원 등록', '병실·보증금·약정서·보증인'], ['ipdpay', '입원 정산 (퇴원 수납)', '중간정산·DRG 열외군·영수증'],
      ['certdoc', '제증명', '진단서 등 21종 코드별 발급'], ['dcreview', '퇴원 심사 (DRG 심사)', '처방·상병·주석 심사'], ['postreview', '입원 사후 심사', '명세서·POA·심사 1·2차'], ['review', '청구·EDI', '명세서 송신·심사결과'],
      ['reclaim', '재청구·이의신청', '반송 재생성·1·2차 이의신청'], ['mrd', '의료정보', '퇴원분석·미비·코딩·사본'], ['referral', '진료협력센터', '의뢰·전원·회송·회신'], ['appt', '예약센터', '예약·도착 접수·문자'],
      ['reg', '원무 (간편 화면)', '처음 배우는 학생용'], ['billing', '원무 수납 (간편 화면)', '계산 원리 이해용'] ] },
    { t: '관리 · 행정', d: '병원이 안전하고 잘 돌아가게 하는 일입니다. 수간호사·QI 간호사·보건관리자가 맡습니다.', list: [
      ['qi', '질향상·환자안전', '사건 보고·지표·CP·적정성'], ['supply', '구매·재고 (물류)', '재고·청구·발주·검수'], ['nadmin', '간호행정·교육·보건', '근무표·필수 교육·직원 건강'] ] },
  ];

  const target = (t) => {
    if (!t) return '';
    if (t.startsWith('ward-')) return `data-act="map.go" data-v="ward" data-unit="${t.split('-')[1].toUpperCase()}"`;
    if (t === 'ward') return 'data-act="map.go" data-v="ward" data-unit=""';
    if (/^s\d/.test(t)) { const [ph, name] = t.split(':'); return `data-act="map.soon" data-phase="${ph.slice(1)}" data-name="${esc(name || '')}"`; }
    return `data-act="map.go" data-v="${t}"`;
  };

  H.reg({
    id: 'map', title: '부서 지도', layout: 'page', actor: '',
    render() {
      const u = A.user();
      const zone = (n) => `<span class="zone-line" style="left:calc(${n} * (100% - 6.3rem) / 10 + ${n - 0.5} * .7rem)"></span>`;
      const nodes = NODES.map(([r, c, label, kind, t]) => {
        const tt = t === 's2' || t === 's3' || t === 's4' ? `${t}:${label.replace('\n', ' ')}` : t;
        const live = LIVE.includes(t);
        return `<button class="node ${kind} ${live ? 'live' : ''}" style="grid-row:${r};grid-column:${c}" ${target(tt)} ${t ? '' : 'disabled'}>${esc(label).replace('\n', '<br>')}</button>`;
      }).join('');
      return `<div class="map-page">
        <div class="map-head"><div class="grow"><h1>${esc(u.name)} 님, 오늘은 어디에서 일할까요?</h1><p>병원 전산 지도에서 부서를 누르거나, 아래 직종별 부서에서 고르세요. "실습 가능" 표시가 있는 곳은 지금 바로 일할 수 있습니다.</p></div>
          ${u.role === 'instructor' ? UI.btn('교수자 화면', 'map.go', { kind: 'pri', size: 'lg', icon: 'clip', data: { v: 'instructor' } }) : UI.btn('내 실습 기록 보기', 'map.go', { size: 'lg', icon: 'list', data: { v: 'instructor' } })}</div>
        <div class="his-map-wrap"><div class="his-map">${zone(1)}${zone(4)}${zone(6)}${nodes}</div></div>
        <div class="legend"><span><i style="border-color:#E07A1F"></i>핵심 전산 (HIS·OCS·EMR)</span><span><i style="border-color:var(--t-sent)"></i>병원 업무</span><span><i style="border-color:#5E9E3A"></i>경영 지원</span><span><i style="border-color:var(--line-strong);background:var(--surface-3)"></i>외부 연계 기관·시스템</span><span><i style="border-color:var(--t-stat);border-style:dashed"></i>업무 구역 경계</span></div>
        <div class="job-groups">${H.NAV.map((g) => { const ds = g.depts.filter((d) => d.items.some((it) => H.mods[it[1]])); if (!ds.length) return '';
          return `<section class="job-group"><h3>${esc(g.g)}</h3><div class="job-list">${ds.map((d) => { const k = g.g + '/' + d.d; const on = A.st.mapOpen === k;
            return `<button class="job ${on ? 'open' : ''}" data-act="map.dept" data-k="${esc(k)}" aria-expanded="${on}"><span class="arw">${on ? '▾' : '▸'}</span><b>${esc(d.d === '실습 관리' && u.role !== 'instructor' ? '실습 관리 (내 기록)' : d.d)}</b></button>${on ? `<div class="job-sub">${d.items.filter((it) => H.mods[it[1]]).map((it) => `<button class="job-i" data-act="nav.open" data-v="${it[1]}" data-unit="${it[2] || ''}" data-label="${esc(it[0])}"><span class="muted">${esc(g.g)} › ${esc(d.d)} ›</span> <b>${esc(it[0])}</b></button>`).join('')}</div>` : ''}`; }).join('')}</div></section>`; }).join('')}</div>
        <p class="small muted" style="margin:0">부서를 누르면 그 아래에 메뉴가 펼쳐집니다 (한 번에 한 부서만). 메뉴를 누르면 위쪽 탭으로 열립니다.</p>
      </div>`;
    },
    acts: {
      'map.go': (el) => {
        const v = el.dataset.v;
        if (v === 'ward') {
          A.st.ward = A.st.ward || {};
          if (el.dataset.unit) A.st.ward.unit = el.dataset.unit;
          else if (!['7A', '8B'].includes(A.st.ward.unit)) A.st.ward.unit = '7A';
          A.st.ward.board = true;
        }
        H.log('직군 선택', el.textContent.trim().split('\n')[0]);
        if (A.open) A.open(v, v === 'ward' ? A.st.ward.unit : ''); else A.go(v);
      },
      'map.dept': (el) => {
        const k = el.dataset.k; A.st.mapOpen = A.st.mapOpen === k ? null : k;
        // 왼쪽 메뉴도 같은 곳만 펼침 (다른 곳은 닫음)
        if (A.st.mapOpen) { const [g, d] = k.split('/'); const o = {}; H.NAV.forEach((x) => { o['g:' + x.g] = x.g === g; x.depts.forEach((y) => { o['d:' + x.g + '/' + y.d] = x.g === g && y.d === d; }); }); S.setPref('navOpen', o); }
        A.render();
      },
      'map.soon': (el) => { A.st.soon = { phase: el.dataset.phase, name: el.dataset.name || el.querySelector('b')?.textContent || el.textContent.trim() }; A.go('soon'); },
    },
  });

  // ── 준비 중 ──
  const PHASE = {
    2: '2단계 — 수술실(예약·확정·수술 중 기록·응급 처방), 중환자실, 분만실, 신생아실, 투석실, 외래·응급 간호',
    3: '3단계 — 수가 계산(자격별 본인부담·산정특례), 원무 수납·퇴원 정산, 진단서·제증명, 보험 심사·EDI 청구·삭감·이의신청, 의료정보(퇴원분석·미비기록·질병 코딩)',
    4: '4단계 — 진료협력(의뢰·회송·회신·통계), 감염관리, 가정간호, 방사선종양, 재활, 장기이식, 구매·재고, 중앙공급, 종합검진, 영양, 기능검사, 질 향상',
  };
  H.reg({
    id: 'soon', title: '준비 중', layout: 'page', actor: '',
    render() {
      const s = A.st.soon || { phase: 4, name: '이 부서' };
      return `<div class="map-page" style="max-width:52rem">
        <h1 style="font-size:1.6rem">${esc(s.name)} — 준비 중입니다</h1>
        ${UI.note(`이 부서는 <b>${esc(PHASE[s.phase] || '')}</b>에 포함되어 있습니다. 지금은 1단계(처방 → 약제·검사·영상·병리 → 병동 간호)와 2단계(수술실·중환자실·분만실·신생아실·인공신장실·외래 간호·응급실 분류)를 실습할 수 있습니다.`, 'info')}
        <div class="btn-row">${UI.btn('부서 지도로 돌아가기', 'shell.home', { kind: 'pri', size: 'lg', icon: 'home' })}${UI.btn('병동 간호로 가기', 'map.go', { size: 'lg', data: { v: 'ward', unit: '' } })}</div>
      </div>`;
    },
    acts: { 'map.go': (el) => A.go(el.dataset.v) },
  });
})();
