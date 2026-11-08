// 왼쪽 부서 메뉴(직군 → 세부 메뉴, 접기·펴기) + 열린 화면 탭
(function () {
  const H = window.H;
  const S = H.store;
  const esc = H.esc;
  const A = H.app;
  const UI = H.ui;

  // 3단 메뉴: 직종 → 부서 → 메뉴 [메뉴 이름, 화면 id, 병동 단위]
  H.NAV = [
    { g: '의사', depts: [
      { d: '진료 (OCS·EMR)', items: [['외래 진료', 'ocs-opd'], ['입원 진료', 'ocs-ipd'], ['응급 진료', 'ocs-er']] } ] },
    { g: '간호사', depts: [
      { d: '병동', items: [['내과 병동 (7A)', 'ward', '7A'], ['외과 병동 (8B)', 'ward', '8B']] },
      { d: '응급실', items: [['응급실 간호', 'ward', 'ER']] },
      { d: '중환자실', items: [['중환자실 간호', 'ward', 'ICU']] },
      { d: '분만실·신생아실', items: [['분만실', 'ward', 'LD'], ['신생아실', 'ward', 'NB']] },
      { d: '외래', items: [['외래 간호', 'opdnurse'], ['주사실', 'injection']] },
      { d: '수술실', items: [['수술실·회복실', 'or']] },
      { d: '인공신장실', items: [['인공신장실', 'dialysis']] },
      { d: '심혈관센터', items: [['심혈관센터', 'cath']] },
      { d: '내시경실', items: [['내시경실', 'endo']] },
      { d: '가정간호', items: [['가정간호', 'homecare']] },
      { d: '감염관리실', items: [['감염관리', 'infection']] },
      { d: '장기이식센터', items: [['장기이식', 'transplant']] },
      { d: '방사선종양', items: [['방사선종양 간호', 'radonc']] },
      { d: '종합검진센터', items: [['종합검진센터', 'checkup']] },
      { d: '중앙공급실', items: [['중앙공급실', 'csr']] },
      { d: '간호행정', items: [['간호행정·교육·보건', 'nadmin']] } ] },
    { g: '의료기사', depts: [
      { d: '진단검사의학과', items: [['채혈실', 'phlebo'], ['진단검사', 'lab']] },
      { d: '병리과', items: [['병리과', 'pathology']] },
      { d: '영상의학과', items: [['영상의학과·PACS', 'radiology']] },
      { d: '기능검사실', items: [['기능검사실', 'func']] },
      { d: '재활치료실', items: [['재활 치료', 'rehab']] } ] },
    { g: '행정직', depts: [
      { d: '원무팀', items: [['외래 등록', 'opdreg'], ['외래 수납', 'opdpay'], ['입원 등록', 'admreg'], ['입원 정산', 'ipdpay'], ['제증명', 'certdoc'], ['원무 (간편 화면)', 'reg'], ['원무 수납 (간편 화면)', 'billing']] },
      { d: '심사팀', items: [['퇴원 심사', 'dcreview'], ['입원 사후 심사', 'postreview'], ['청구·EDI', 'review'], ['재청구', 'reclaim'], ['이의신청', 'appeal']] },
      { d: '의료정보팀', items: [['퇴원분석(I)', 'mi-dc1'], ['진료분석 (코딩)', 'mi-anal'], ['퇴원진단명 관리', 'mi-dxmgr'], ['미비등록', 'mi-def'], ['의료정보 (통합·사본·통계)', 'mrd']] },
      { d: '예약센터', items: [['통합예약센터', 'resv'], ['전화예약센터', 'callctr'], ['예약·도착 접수', 'appt']] },
      { d: '고객관리실', items: [['고객의 소리 (VOC)', 'cs-voc'], ['직원의 소리 (VOE)', 'cs-voe'], ['고객관계관리 (CRM)', 'cs-crm'], ['환자경험평가', 'cs-pxe']] },
      { d: '진료협력센터', items: [['회신/회송/의뢰 전체요약', 'cr-dash'], ['진료협력 (의뢰 받기·예약)', 'referral'], ['회신서', 'cr-reply'], ['진료의뢰·회송서 작성', 'cr-send'], ['전원환자 관리', 'cr-transfer']] },
      { d: '적정관리팀 (QI)', items: [['질향상·환자안전', 'qi']] },
      { d: '구매·물류팀', items: [['구매·재고', 'supply']] } ] },
    { g: '기타', depts: [
      { d: '약제부', items: [['약제부', 'pharmacy']] },
      { d: '영양팀', items: [['영양집중지원 (NST)', 'nst']] },
      { d: '실습 관리', items: [['교수자 화면 · 실습 기록', 'instructor'], ['데이터 점검 (자료 연결·DB)', 'datacheck']] } ] },
  ];
  const keyOf = (mod, unit) => mod + (unit ? ':' + unit : '');
  const each = (fn) => { for (const g of H.NAV) for (const d of g.depts) for (const it of d.items) { const r = fn(g, d, it); if (r) return r; } return null; };
  const findItem = (key) => each((g, d, it) => (keyOf(it[1], it[2]) === key ? { g: g.g, d: d.d, label: it[0], mod: it[1], unit: it[2] } : null));
  const deptOfMod = (mod) => each((g, d, it) => (it[1] === mod ? { g: g.g, d: d.d } : null)) || {};
  A.groupName = (key, mod) => (findItem(key) || {}).d || deptOfMod(mod).d || '';
  A.jobName = (key, mod) => (findItem(key) || {}).g || deptOfMod(mod).g || '';

  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  A.tabs = [];
  A.st.tabKey = 'map';
  const tab = (k) => A.tabs.find((t) => t.key === k);
  const MAXTAB = 12;
  A.saveTabs = () => { const s = S.session(); s.tabs = A.tabs; s.tabKey = A.st.tabKey; S.setSession(s); };
  A.loadTabs = () => { const s = S.session(); A.tabs = (s.tabs || []).filter((t) => H.mods[t.mod]); A.st.tabKey = s.tabKey && (s.tabKey === 'map' || tab(s.tabKey)) ? s.tabKey : 'map'; };

  // 지금 탭의 상태(보던 환자·화면 안 선택)를 그 탭에 맡겨 둠
  function park() { const c = tab(A.st.tabKey); if (c) { c.pid = A.st.pid; c.encId = A.st.encId; c.st = clone(A.st[c.mod]); } }
  A.activate = (key, restore) => {
    if (key !== A.st.tabKey) park();
    A.st.tabKey = key;
    const t = tab(key);
    if (t) {
      if (t.st) A.st[t.mod] = clone(t.st);
      if (t.unit) { A.st.ward = A.st.ward || {}; A.st.ward.unit = t.unit; if (!t.st) A.st.ward.board = true; }
      if (restore && t.pid !== undefined) { A.st.pid = t.pid; A.st.encId = t.encId; }
    }
    A.saveTabs();
  };
  A.open = (mod, unit, label) => {
    if (mod === 'map') { A.activate('map'); A.go('map'); return; }
    if (!H.mods[mod]) return UI.toast('이 화면은 아직 없습니다', 'warn');
    const key = keyOf(mod, unit);
    if (!tab(key)) {
      if (A.tabs.length >= MAXTAB) { const old = A.tabs.find((t) => t.key !== A.st.tabKey); A.tabs = A.tabs.filter((t) => t !== old); UI.toast(`탭이 많아 가장 오래된 "${old.title}" 탭을 닫았습니다`, 'info'); }
      A.tabs.push({ key, mod, unit: unit || '', title: label || (findItem(key) || {}).label || H.mods[mod].title });
      H.log('화면 열기', label || H.mods[mod].title);
    }
    A.activate(key, true);
    A.go(mod);
  };
  // 주소(#)로 화면이 바뀌었을 때 탭을 맞춤 (다른 화면에서 바로가기로 온 경우)
  A.syncTab = (id) => {
    if (['map', 'login', 'soon'].includes(id)) { if (A.st.tabKey !== 'map') { park(); A.st.tabKey = 'map'; A.saveTabs(); } return; }
    const cur = tab(A.st.tabKey);
    if (cur && cur.mod === id) return;
    let t = A.tabs.find((x) => x.mod === id && (id !== 'ward' || x.unit === ((A.st.ward || {}).unit || '7A')));
    if (!t) {
      const unit = id === 'ward' ? (A.st.ward || {}).unit || '7A' : '';
      const key = keyOf(id, unit);
      t = { key, mod: id, unit, title: (findItem(key) || {}).label || H.mods[id].title };
      if (A.tabs.length >= MAXTAB) { const old = A.tabs.find((x) => x.key !== A.st.tabKey); A.tabs = A.tabs.filter((x) => x !== old); }
      A.tabs.push(t);
    }
    A.activate(t.key, false);
  };
  A.closeTab = (key) => {
    const i = A.tabs.findIndex((t) => t.key === key); if (i < 0) return;
    const was = A.st.tabKey === key;
    A.tabs.splice(i, 1);
    if (was) { A.st.tabKey = '__closed'; const nx = A.tabs[i] || A.tabs[i - 1]; if (nx) { A.activate(nx.key, true); A.go(nx.mod); } else { A.st.tabKey = 'map'; A.saveTabs(); A.go('map'); } }
    else { A.saveTabs(); A.render(); }
  };

  // ── 그리기 ──
  const narrow = () => matchMedia('(max-width: 1000px)').matches;
  A.navMob = false;
  // 펼침 상태: prefs.navOpen = { 'g:직종': 참/거짓, 'd:직종/부서': 참/거짓 } — 값이 없으면 지금 화면이 속한 곳만 펼침
  const isOpen = (k, cur) => { const o = S.prefs().navOpen || {}; return o[k] !== undefined ? o[k] : cur; };
  A.navHtml = () => {
    const curG = A.jobName(A.st.tabKey, A.st.mod); const curD = A.groupName(A.st.tabKey, A.st.mod);
    const u = A.user() || {};
    const leaf = (it, cls) => { const k = keyOf(it[1], it[2]); return `<button class="${cls} ${A.st.tabKey === k ? 'on' : ''} ${tab(k) ? 'opened' : ''}" data-act="nav.open" data-v="${it[1]}" data-unit="${it[2] || ''}" data-label="${esc(it[0])}">${esc(it[0])}</button>`; };
    return `<nav class="snav" aria-label="부서 메뉴"><div class="snav-h"><b>부서 메뉴</b><span class="grow"></span><button class="snav-x" data-act="nav.toggle" aria-label="메뉴 닫기">${H.icon('x')}<span>닫기</span></button></div>
      <button class="snav-home ${A.st.tabKey === 'map' ? 'on' : ''}" data-act="nav.open" data-v="map">${H.icon('home')}<span>부서 지도</span></button>
      ${H.NAV.map((g) => { const depts = g.depts.map((d) => Object.assign({}, d, { items: d.items.filter((it) => H.mods[it[1]]) })).filter((d) => d.items.length); if (!depts.length) return '';
        const go = isOpen('g:' + g.g, g.g === curG); const n = A.tabs.filter((t) => A.jobName(t.key, t.mod) === g.g).length;
        return `<div class="snav-g ${go ? 'open' : ''}"><button class="snav-gh ${g.g === curG ? 'cur' : ''}" data-act="nav.grp" data-k="g:${esc(g.g)}" data-cur="${g.g === curG ? 1 : 0}" aria-expanded="${go}"><span class="arw">${go ? '▾' : '▸'}</span><span class="grow">${esc(g.g)}</span>${n ? `<span class="snav-n">${n}</span>` : ''}</button>
          ${go ? `<div class="snav-items">${depts.map((d) => { const label = d.d === '실습 관리' && u.role !== 'instructor' ? '실습 관리 (내 기록)' : d.d;
            if (d.items.length === 1) return leaf([label, d.items[0][1], d.items[0][2]], 'snav-i snav-d1');
            const dk = 'd:' + g.g + '/' + d.d; const dOpen = isOpen(dk, d.d === curD && g.g === curG);
            return `<button class="snav-dh ${d.d === curD ? 'cur' : ''}" data-act="nav.grp" data-k="${esc(dk)}" data-cur="${d.d === curD && g.g === curG ? 1 : 0}" aria-expanded="${dOpen}"><span class="arw">${dOpen ? '▾' : '▸'}</span><span class="grow">${esc(label)}</span></button>${dOpen ? `<div class="snav-sub">${d.items.map((it) => leaf(it, 'snav-i')).join('')}</div>` : ''}`; }).join('')}</div>` : ''}</div>`; }).join('')}
    </nav>`;
  };
  A.tabbarHtml = () => `<div class="mtabs" role="tablist" aria-label="열린 화면">
      <button class="mtab home ${A.st.tabKey === 'map' ? 'on' : ''}" role="tab" data-act="nav.tab" data-k="map">${H.icon('home')}<span>부서 지도</span></button>
      ${A.tabs.map((t) => `<div class="mtab ${t.key === A.st.tabKey ? 'on' : ''}" role="tab" aria-selected="${t.key === A.st.tabKey}"><button class="mtab-t" data-act="nav.tab" data-k="${esc(t.key)}"><small>${esc(A.groupName(t.key, t.mod))}</small>${esc(t.title)}</button><button class="mtab-x" data-act="nav.close" data-k="${esc(t.key)}" aria-label="${esc(t.title)} 탭 닫기">${H.icon('x')}</button></div>`).join('')}
      ${A.tabs.length > 1 ? `<button class="mtab-all" data-act="nav.closeAll">${H.icon('x')}<span>다른 탭 모두 닫기</span></button>` : ''}
    </div>`;
  A.shellCls = () => (narrow() ? (A.navMob ? 'nav-mob' : 'nav-off') : S.prefs().navOff ? 'nav-off' : '');

  A.navActs = ({
    'nav.open': (el) => { const v = el.dataset.v; if (narrow()) A.navMob = false; if (v === 'map') { A.activate('map'); A.go('map'); return; } A.open(v, el.dataset.unit || '', el.dataset.label || ''); },
    'nav.grp': (el) => { const k = el.dataset.k; const o = Object.assign({}, S.prefs().navOpen || {}); const now = o[k] !== undefined ? o[k] : el.dataset.cur === '1'; o[k] = !now; S.setPref('navOpen', o); A.render(); },
    'nav.toggle': () => { if (narrow()) A.navMob = !A.navMob; else S.setPref('navOff', !S.prefs().navOff); A.render(); },
    'nav.tab': (el) => { const k = el.dataset.k; if (k === 'map') { A.activate('map'); A.go('map'); return; } const t = tab(k); if (!t) return; A.activate(k, true); A.go(t.mod); },
    'nav.close': (el) => A.closeTab(el.dataset.k),
    'nav.closeAll': () => { const keep = A.st.tabKey; A.tabs = A.tabs.filter((t) => t.key === keep); A.saveTabs(); A.render(); },
    'nav.dept': (el) => { const g = el.dataset.g, d = el.dataset.d; const o = Object.assign({}, S.prefs().navOpen || {}); o['g:' + g] = true; o['d:' + g + '/' + d] = true; S.setPref('navOpen', o); if (!narrow()) S.setPref('navOff', false);
      const dd = H.NAV.find((x) => x.g === g).depts.find((x) => x.d === d); const it = dd.items.find((x) => H.mods[x[1]]); if (it) A.open(it[1], it[2] || '', it[0]); },
  });
})();
