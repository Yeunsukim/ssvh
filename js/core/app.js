// 프로그램 틀: 화면 이동, 상단 막대, 환자 정보 띠, 환자 목록, 알림, 클릭 처리
(function () {
  const H = window.H;
  const S = H.store;
  const esc = H.esc;
  const UI = H.ui;

  H.mods = {};
  H.reg = (m) => { H.mods[m.id] = m; };

  const A = (H.app = {
    st: { mod: null, pid: null, encId: null },
    mod() { return H.mods[A.st.mod]; },
    user() { return S.session().user || null; },
    curDeptName() { const m = A.mod(); return m ? m.title : '-'; },
    ms(key, def) { const m = A.st.mod; A.st[m] = A.st[m] || {}; if (key === undefined) return A.st[m]; return A.st[m][key] !== undefined ? A.st[m][key] : def; },
    set(key, v) { const m = A.st.mod; A.st[m] = A.st[m] || {}; A.st[m][key] = v; A.saveNav(); },
    saveNav() { const s = S.session(); s.nav = { pid: A.st.pid, encId: A.st.encId, mods: Object.fromEntries(Object.entries(A.st).filter(([k]) => H.mods[k])) }; S.setSession(s); },
    selectPatient(pid, encId) {
      A.st.pid = pid;
      A.st.encId = encId || (H.activeEnc(pid) || {}).id || null;
      A.saveNav();
      A.render();
    },
    pat() { return A.st.pid ? H.pat(A.st.pid) : null; },
    enc() { return A.st.encId ? H.enc(A.st.encId) : null; },
    go(hash) { if (location.hash === '#' + hash) A.render(); else location.hash = hash; },

    // ── 화면 그리기 ──
    render() {
      const root = document.getElementById('app');
      const user = A.user();
      let id = (location.hash || '').replace('#', '') || 'map';
      if (!user) id = 'login';
      else if (id === 'login') id = 'map';
      if (!H.mods[id]) id = 'map';
      if (A.syncTab && id !== 'login') A.syncTab(id);
      if (A.st.mod !== id) { A.st.mod = id; const m = H.mods[id]; if (m.onEnter) m.onEnter(); }
      const m = H.mods[id];
      document.title = id === 'login' || id === 'map' ? 'SSV 병원 전산 실습' : `${m.title} · SSV 병원 전산 실습`;

      const keep = { y: window.scrollY, list: (root.querySelector('.plist-body') || {}).scrollTop || 0, main: (root.querySelector('[data-keep-scroll]') || {}).scrollTop || 0 };
      if (m.layout === 'bare') { root.innerHTML = m.render(); }
      else {
        const list = m.layout === 'patient' ? A.listHtml(m) : '';
        const side = m.side ? m.side() : '';
        const wsCls = m.layout === 'patient' ? (side ? '' : 'no-side') : side ? 'full-side' : 'full';
        root.innerHTML = `${A.topbar(m)}<div class="shell ${A.shellCls ? A.shellCls() : ''}">${A.navHtml ? A.navHtml() : ''}${A.navMob ? '<div class="snav-back" data-act="nav.toggle"></div>' : ''}<div class="shell-main">${A.tabbarHtml ? A.tabbarHtml() : ''}${m.layout === 'patient' ? A.banner() : ''}
          ${m.layout === 'page' ? m.render() : `<div class="ws ${wsCls}">${list}<main class="main" id="main">${m.render()}</main>${side ? `<aside class="side">${side}</aside>` : ''}</div>`}</div></div>
          ${A.statusbar()}`;
      }
      const lb = root.querySelector('.plist-body'); if (lb) lb.scrollTop = keep.list;
      const km = root.querySelector('[data-keep-scroll]'); if (km) km.scrollTop = keep.main;
      if (A._lastMod === id) window.scrollTo(0, keep.y); else window.scrollTo(0, 0);
      A._lastMod = id;
      if (m.after) m.after(root);
    },
    part(sel, html) { const el = document.querySelector(sel); if (el) el.innerHTML = html; },

    topbar(m) {
      const u = A.user();
      const n = A.myNotifs().filter((x) => !x.read).length;
      const fs = S.prefs().fs || 'l';
      const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      const navOff = A.shellCls && A.shellCls().includes('nav-off');
      return `<header class="topbar">
        <button class="tb-btn tb-menu" data-act="nav.toggle" aria-label="부서 메뉴 ${navOff ? '열기' : '닫기'}">${H.icon('menu')}<span>${navOff ? '메뉴 열기' : '메뉴 접기'}</span></button>
        <button class="logo" data-act="shell.home" style="background:none;border:0;color:inherit;cursor:pointer;padding:0" aria-label="부서 지도로">
          <span class="logo-mark">SSV</span><span>SSV 병원<small>병원 전산 실습</small></span></button>
        ${m.id !== 'map' ? `<div class="dept-pill"><span class="k">지금 일하는 곳</span><span class="v">${esc((A.groupName && A.groupName(A.st.tabKey, m.id)) || m.title)}</span></div>` : '<div class="dept-pill"><span class="k">지금</span><span class="v">일할 곳 고르기</span></div>'}
        <span class="spacer"></span>
        <span class="tb-user">${u.role === 'instructor' ? '교수자' : '학생'} <b>${esc(u.name)}</b>${u.sid ? ` · ${esc(u.sid)}` : ''}</span>
        ${m.id !== 'map' ? `<button class="tb-btn" data-act="shell.bell" aria-label="알림 ${n}건">${H.icon('bell')}<span>알림</span>${n ? `<span class="cnt">${n}</span>` : ''}</button>` : ''}
        <button class="tb-btn" data-act="shell.home">${H.icon('home')}<span>부서 지도</span></button>
        <span class="lang-seg no-tr" role="group" aria-label="화면 언어 Language"><button type="button" class="${H.i18n && H.i18n.on ? '' : 'on'}" data-act="shell.lang" data-v="ko">한글로</button><button type="button" class="${H.i18n && H.i18n.on ? 'on' : ''}" data-act="shell.lang" data-v="en">영어로</button></span>
        <button class="tb-btn" data-act="shell.theme" aria-label="화면 밝기 바꾸기">${H.icon(dark ? 'sun' : 'moon')}<span>${dark ? '밝게' : '어둡게'}</span></button>
        <button class="tb-btn" data-act="shell.fs" aria-label="글씨 크기 바꾸기">${H.icon('text')}<span>글씨 ${{ m: '보통', l: '크게', xl: '아주 크게' }[fs]}</span></button>
        <button class="tb-btn" data-act="shell.logout">${H.icon('logout')}<span>나가기</span></button>
      </header>`;
    },

    flagsOf(p, enc) {
      const f = [];
      (p.allergies || []).forEach((a) => f.push(UI.flag(`알레르기: ${a.name}`, 'red', 'alert')));
      const morse = H.lastAssess(p.id, 'morse');
      if (morse && morse.score >= 45) f.push(UI.flag(`낙상 고위험 ${morse.score}점`, 'amber'));
      const braden = H.lastAssess(p.id, 'braden');
      if (braden && braden.score <= 14) f.push(UI.flag(`욕창 위험 ${braden.score}점`, 'amber'));
      if (p.flags && p.flags.dnr) f.push(UI.flag('심폐소생술 거부 (DNR)', 'purple'));
      if (p.flags && p.flags.isolation) f.push(UI.flag(p.flags.isolation, 'blue'));
      if (enc && enc.diet && enc.diet.includes('금식')) f.push(UI.flag('금식 (NPO)', 'gray'));
      if (p.special) f.push(UI.flag(p.special.name, 'blue'));
      return f.join('');
    },
    banner() {
      const p = A.pat();
      if (!p) return `<div class="pbanner empty">${H.icon('user')} 왼쪽 목록에서 환자를 고르면 환자 정보가 여기에 보입니다.</div>`;
      const e = A.enc();
      const loc = e ? (e.type === 'OPD' ? `외래 ${e.dept}` : e.type === 'ER' ? `응급실 ${e.room}-${e.bed}` : `${e.ward} ${e.room}-${e.bed}`) : '진료 없음';
      const dx = e && e.dx && e.dx.length ? (e.dx.find((d) => d.main) || e.dx[0]).name : '진단 전';
      const kv = (k, v, mono) => `<div class="pb-kv"><span class="k">${k}</span><span class="v ${mono ? 'num' : ''}">${esc(v)}</span></div>`;
      return `<div class="pbanner">
        <div class="pb-name"><b>${esc(p.name)}</b><span class="muted">${H.sexAge(p)}</span></div>
        ${kv('등록번호', p.mrn, true)}${kv('위치', loc)}${e ? kv('진료과·주치의', `${e.dept} ${H.M.doctor(e.doctorId).name}`) : ''}
        ${kv('진단', dx)}${kv('혈액형', p.blood)}${kv('키·몸무게', `${p.height}cm · ${p.weight}kg`, true)}${kv('보험', p.ins)}
        ${e && e.type === 'ER' && e.ktas ? `<div class="pb-kv"><span class="k">중증도</span><span class="v">${UI.chip('KTAS ' + e.ktas, 'ktas' + e.ktas)}</span></div>` : ''}
        <div class="pb-flags">${A.flagsOf(p, e)}</div>
      </div>`;
    },

    refreshList() { const m = A.mod(); const L = m.list(); A.part('.plist-body', A.rowsHtml(L)); },
    rowsHtml(L) {
      return L.rows.map((r) => `<button class="prow ${r.pid === A.st.pid && (!r.encId || r.encId === A.st.encId) ? 'on' : ''}" data-act="shell.pick" data-pid="${esc(r.pid)}" data-enc="${esc(r.encId || '')}">
        <span class="loc">${esc(r.loc || '')}</span><span class="nm">${esc(r.name)}</span><span class="mk">${r.marks || ''}</span>
        <span class="sub">${r.sub || ''}</span></button>`).join('') || UI.empty(L.empty || '환자가 없습니다');
    },
    listHtml(m) {
      const L = m.list();
      const rows = L.rows.map((r) => `<button class="prow ${r.pid === A.st.pid && (!r.encId || r.encId === A.st.encId) ? 'on' : ''}" data-act="shell.pick" data-pid="${esc(r.pid)}" data-enc="${esc(r.encId || '')}">
        <span class="loc">${esc(r.loc || '')}</span><span class="nm">${esc(r.name)}</span><span class="mk">${r.marks || ''}</span>
        <span class="sub">${r.sub || ''}</span></button>`).join('');
      return `<aside class="panel plist">
        <div class="panel-h"><h3>${esc(L.title)}</h3><span class="grow"></span><span class="chip plain">${L.rows.length}명</span></div>
        ${L.filter ? `<div class="panel-b" style="padding:.5rem .6rem;border-bottom:1px solid var(--line)">${L.filter}</div>` : ''}
        <div class="plist-body">${rows || UI.empty(L.empty || '환자가 없습니다')}</div>
      </aside>`;
    },

    statusbar() {
      const sh = H.t.shiftOf();
      return `<footer class="statusbar"><span>${H.icon('check')} <b id="sb-saved">${S.ok ? '자동 저장됨' : '저장 안 됨 (브라우저 저장 공간을 쓸 수 없음)'}</b></span>
        <span>저장 용량 ${S.sizeKB()}KB</span><span class="grow"></span>
        <span>${H.icon('clock')} <b id="sb-clock">${H.t.dhm(Date.now())}</b> · ${H.t.shiftName[sh]}</span>
        <span class="edu">교육용 가상 데이터 — 실제 진료에 쓰지 마세요</span></footer>`;
    },

    myNotifs() {
      const m = A.mod();
      if (!m || !m.channels) return [];
      const ch = m.channels();
      return S.where('notifs', (n) => ch.includes(n.to)).sort((a, b) => b.at - a.at);
    },
  });

  H.lastAssess = (pid, kind) => S.where('assess', (a) => a.patientId === pid && a.kind === kind).sort((a, b) => b.at - a.at)[0];
  H.lastVs = (pid) => S.where('vitals', (v) => v.patientId === pid).sort((a, b) => b.at - a.at)[0];
  H.who = () => { const u = A.user() || {}; const m = A.mod(); return `${u.name || '-'} (${(m && m.actor) || '-'})`; };

  // ── 공통 동작 ──
  const SHELL = {
    'shell.lang': (el) => { if (H.i18n) H.i18n.set(el.dataset.v); },
    'shell.home': () => { if (A.activate) A.activate('map'); A.go('map'); },
    'shell.pick': (el) => { A.selectPatient(el.dataset.pid, el.dataset.enc || null); const m = A.mod(); if (m.onPick) m.onPick(); },
    'shell.theme': () => {
      const root = document.documentElement;
      const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'light' : 'dark';
      S.setPref('theme', root.dataset.theme);
      A.render();
    },
    'shell.fs': () => {
      const order = ['m', 'l', 'xl'];
      const cur = S.prefs().fs || 'l';
      const nx = order[(order.indexOf(cur) + 1) % 3];
      document.documentElement.dataset.fs = nx;
      S.setPref('fs', nx);
      A.render();
    },
    'shell.logout': async () => {
      if (!(await UI.confirm({ title: '나가기', text: '로그아웃할까요?\n실습 기록은 이 브라우저에 그대로 남습니다.', ok: '로그아웃' }))) return;
      H.log('로그아웃');
      S.setSession({});
      A.st = { mod: null, pid: null, encId: null, tabKey: 'map' }; A.tabs = [];
      A.go('login');
    },
    'shell.bell': () => {
      const list = A.myNotifs().slice(0, 40);
      UI.modal({
        title: `알림 — ${A.curDeptName()}`, icon: 'bell',
        body: list.length ? `<div class="gap-s">${list.map((n) => `<button class="btn block" style="justify-content:flex-start;text-align:left;white-space:normal;${n.read ? 'opacity:.6' : ''}" data-act="shell.notif" data-id="${n.id}">
          ${n.level === 'stat' ? UI.chip('응급', 'stat') : n.read ? UI.chip('읽음', 'plain') : UI.chip('새 알림', 'sent')}
          <span class="grow">${esc(n.text)}</span><span class="muted small nowrap">${H.t.ago(n.at)}</span></button>`).join('')}</div>` : UI.empty('알림이 없습니다'),
        foot: list.length ? UI.btn('모두 읽음으로', 'shell.notifAll', { kind: '' }) : '',
      });
    },
    'shell.notif': (el) => {
      const n = S.get('notifs', el.dataset.id);
      if (n) { n.read = true; S.save(); }
      UI.close();
      if (n && n.patientId) {
        const m = A.mod();
        if (m.layout === 'patient') A.selectPatient(n.patientId);
        else { A.st.pid = n.patientId; A.render(); }
      } else A.render();
    },
    'shell.notifAll': () => { A.myNotifs().forEach((n) => { n.read = true; }); S.save(); UI.close(); A.render(); },
    'ui.close': () => UI.close(),
  };

  function dispatch(act, el, e, data) {
    const md = UI._modal;
    if (md && md.acts && md.acts[act]) return md.acts[act](el, data, e);
    if (SHELL[act]) return SHELL[act](el, data, e);
    if (A.navActs && A.navActs[act]) return A.navActs[act](el, data, e);
    const m = A.mod();
    if (m && m.acts && m.acts[act]) return m.acts[act](el, data, e);
    if (H.common && H.common[act]) return H.common[act](el, data, e);
    console.warn('처리할 수 없는 동작:', act);
  }
  A.dispatch = dispatch;

  function boot() {
    const pr = S.prefs();
    if (pr.theme) document.documentElement.dataset.theme = pr.theme;
    document.documentElement.dataset.fs = pr.fs || 'l';
    document.documentElement.lang = 'ko';
    S.load();
    const nav = S.session().nav;
    if (nav) { A.st.pid = nav.pid || null; A.st.encId = nav.encId || null; Object.assign(A.st, nav.mods || {}); }
    if (A.loadTabs) A.loadTabs();
    if (H.i18n) H.i18n.init();
    window.addEventListener('resize', () => { clearTimeout(A._rz); A._rz = setTimeout(() => { const n = matchMedia('(max-width: 1000px)').matches; if (n !== A._narrow) { A._narrow = n; A.navMob = false; A.render(); } }, 200); });

    document.addEventListener('click', (e) => {
      const pk = e.target.closest('[data-pickv]');
      if (pk) {
        const box = pk.closest('[data-pick]');
        const inp = box.querySelector('input[type=hidden]');
        inp.value = pk.dataset.pickv;
        box.querySelectorAll('[data-pickv]').forEach((b) => b.classList.toggle('on', b === pk));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        if (box.dataset.onpick) dispatch(box.dataset.onpick, pk, e);
        return;
      }
      const chk = e.target.closest('label.chk');
      if (chk) { setTimeout(() => { const i = chk.querySelector('input'); chk.classList.toggle('on', i.checked); }, 0); }
      const el = e.target.closest('[data-act]');
      if (!el) { if (e.target.dataset && e.target.dataset.modalBack) UI.close(); return; }
      if (el.tagName === 'A') e.preventDefault();
      dispatch(el.dataset.act, el, e);
    });
    document.addEventListener('submit', (e) => {
      const f = e.target;
      if (!f.dataset.submit) return;
      e.preventDefault();
      dispatch(f.dataset.submit, f, e, H.formData(f));
    });
    document.addEventListener('change', (e) => { const el = e.target.closest('[data-chg]'); if (el) dispatch(el.dataset.chg, el, e); });
    document.addEventListener('input', (e) => { const el = e.target.closest('[data-inp]'); if (el) dispatch(el.dataset.inp, el, e); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && UI._modal) UI.close(); });
    window.addEventListener('hashchange', () => A.render());
    H.bus.on('saved', () => { const s = document.getElementById('sb-saved'); if (s) s.textContent = S.ok ? `자동 저장됨 ${H.t.hm(Date.now())}` : '저장 안 됨'; });
    setInterval(() => { const c = document.getElementById('sb-clock'); if (c) c.textContent = H.t.dhm(Date.now()); }, 20000);
    A.render();
  }
  H.boot = boot;
})();
