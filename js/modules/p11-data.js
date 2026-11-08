// 데이터 점검 화면 — 자료 연결 점검·자동 고침, 자료 규칙표, 처방 흐름 규칙표, DB 연결용 테이블 생성문
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const E = () => H.erp;
  const ms = (k, d) => A.ms(k, d); const set = (k, v) => A.set(k, v);
  let last = null;
  const run = () => { last = { at: Date.now(), list: H.integrity.check() }; return last; };

  function tabCheck() {
    const r = last || run(); const f = ms('lv', '전체');
    const err = r.list.filter((x) => x.lvl === '오류'); const warn = r.list.filter((x) => x.lvl === '주의');
    const list = r.list.filter((x) => f === '전체' || x.lvl === f);
    const byTab = {}; r.list.forEach((x) => { byTab[x.c] = (byTab[x.c] || 0) + 1; });
    const fixable = r.list.filter((x) => x.fix).length;
    return `<div class="gap-m">${UI.note('자료 연결 점검: 자료 규칙표대로 모든 자료를 검사합니다. 검사하는 것은 이렇습니다. ① 꼭 있어야 하는 칸 ② 다른 자료를 가리키는 열쇠가 실제로 있는지(끊긴 연결) ③ 정해진 값인지 ④ 처방 단계와 결과가 맞는지 ⑤ 같은 침상·중복 입원 ⑥ 처방 흐름 규칙표에 빠진 단계가 없는지. 자동 고침은 자료를 지우지 않고 바로잡기만 합니다.', 'info')}
      <div class="row">${UI.chip(`점검 ${T.mdhm(r.at)}`, 'plain')} ${UI.chip(`오류 ${err.length}건`, err.length ? 'stat' : 'done')} ${UI.chip(`주의 ${warn.length}건`, warn.length ? 'prog' : 'done')} ${UI.chip(`자동 고칠 수 있음 ${fixable}건`, 'sent')} ${UI.chip(`자료 ${Object.keys(H.SCHEMA).reduce((s, c) => s + (S.db[c] || []).length, 0).toLocaleString()}줄 · ${S.sizeKB()}KB`, 'plain')}</div>
      <div class="btn-row">${UI.btn('다시 점검', 'dc.run', { kind: 'pri', icon: 'refresh' })}${fixable ? UI.btn(`자동 고침 (${fixable}건)`, 'dc.fix', { kind: 'warn' }) : ''}${UI.seg('dc.lv', ['전체', '오류', '주의'], f)}</div>
      ${!r.list.length ? UI.note('모든 자료가 서로 맞게 연결되어 있습니다. 끊긴 연결·빠진 칸·맞지 않는 상태가 없습니다.', 'ok') : ''}
      ${E().grid([{ h: '수준' }, { h: '자료 묶음' }, { h: '번호' }, { h: '내용' }, { h: '자동 고침' }], list.slice(0, 300).map((x) => [x.lvl === '오류' ? '<b style="color:var(--t-stat)">오류</b>' : '<span style="color:var(--t-prog)">주의</span>', esc((H.SCHEMA[x.c] || { t: x.c }).t), `<span class="mono small">${esc(String(x.id).slice(0, 18))}</span>`, esc(x.msg), x.fix ? '가능' : '-']), { h: '30rem', empty: '문제가 없습니다' })}
      <div class="row small muted">${Object.entries(byTab).map(([c, n]) => `${esc((H.SCHEMA[c] || { t: c }).t)} ${n}`).join(' · ')}</div></div>`;
  }
  function tabSchema() {
    const sel = ms('tb', 'orders'); const sc = H.SCHEMA[sel];
    const refsIn = Object.entries(H.SCHEMA).flatMap(([c, s]) => Object.entries(s.fk || {}).filter(([, to]) => to === sel || (Array.isArray(to) && to[0] === sel)).map(([k]) => `${s.t}.${k}`));
    return `<div class="gap-m">${UI.note('자료 규칙표: 실습 자료의 묶음(테이블)마다 칸, 꼭 있어야 하는 칸, 다른 묶음을 가리키는 열쇠(FK)를 정리한 표입니다. 병원 DB에 붙일 때 이 표가 테이블 설계서가 됩니다. 새 화면을 만들 때 새 칸·새 묶음은 반드시 이 표에 먼저 적습니다.', 'info')}
      <div class="erp-cols3" style="grid-template-columns:minmax(0,17rem) minmax(0,1fr)">${E().grid([{ h: '자료 묶음' }, { h: '표 이름' }, { h: '줄 수', n: 1 }], Object.entries(H.SCHEMA).map(([c, s]) => ({ cells: [`<span class="mono">${c}</span>`, esc(s.t), (S.db[c] || []).length.toLocaleString()], on: c === sel, act: 'dc.tb', data: { v: c } })), { h: '34rem' })}
        <div class="gap-s"><h3 style="margin:0">${esc(sc.t)} <span class="mono small muted">${sel}</span></h3>
          ${E().grid([{ h: '칸' }, { h: '설명' }, { h: '필수' }, { h: '가리키는 곳 (FK)' }, { h: '허용 값' }], Object.entries(sc.cols).map(([k, d]) => { const fk = (sc.fk || {})[k]; return [`<span class="mono">${k}</span>`, esc(d), (sc.req || []).includes(k) ? '●' : '', fk ? esc(Array.isArray(fk) ? `${H.SCHEMA[fk[0]].t} (목록)` : fk === '@doctors' ? '의사 명단' : fk === '@master' ? '처방 항목 마스터' : H.SCHEMA[fk].t) + ((sc.null || []).includes(k) ? ' · 비어도 됨' : '') : '', esc(((sc.enum || {})[k] || []).join(' · '))]; }), { h: '26rem' })}
          <p class="small" style="margin:0"><b>이 묶음을 가리키는 곳:</b> ${refsIn.map(esc).join(', ') || '없음'}</p></div></div></div>`;
  }
  function tabRoutes() {
    const tbl = (rows) => E().grid([{ h: '처방 분류' }, { h: '단계 (상태)' }, { h: '담당 부서·화면' }, { h: '화면 id' }, { h: '연결' }], rows, { h: '40rem' });
    const rows = []; Object.entries(H.ROUTES).forEach(([cat, rs]) => rs.forEach(([st, who, mods], i) => rows.push([i ? '' : `<b>${esc((H.M.CAT[cat] || {}).l || cat)}</b> <span class="mono small">${cat}</span>`, esc(st), esc(who), `<span class="mono small">${esc(mods)}</span>`, mods.split('|').every((m) => H.mods[m]) ? '<span style="color:var(--t-done)">● 연결됨</span>' : '<b style="color:var(--t-stat)">끊김</b>'])));
    return `<div class="gap-m">${UI.note('처방 흐름 규칙표: OCS(처방전달시스템)에서 낸 처방이 분류별로 어떤 단계를 거쳐 어느 부서 화면에서 처리되는지 정리했습니다. 모든 단계마다 처리하는 화면이 있어야 처방이 끊기지 않습니다. 점검 탭에서 이 표를 자동으로 확인합니다.', 'info')}${tbl(rows)}${UI.note(`수납·청구 연결: ${esc(H.ROUTE_AFTER)}`, 'ok')}</div>`;
  }
  function tabDb() {
    const what = ms('what', 'sql');
    const txt = what === 'sql' ? H.integrity.ddl() : what === 'json' ? JSON.stringify(Object.fromEntries(Object.entries(H.SCHEMA).map(([c, s]) => [c, { 표: s.t, 필수: s.req, 열쇠: s.fk || {}, 허용값: s.enum || {}, 칸: s.cols }])), null, 2) : S.exportJSON();
    return `<div class="gap-m">${UI.note('DB 연결용: 아래 글을 복사해 병원 DB 담당자에게 주면 됩니다. "테이블 생성문"은 자료 규칙표로 자동으로 만든 SQL 문장입니다. "전체 자료"는 지금 실습 자료 전부(JSON)이고, 묶음 이름이 테이블 이름과 같아 그대로 옮겨 넣을 수 있습니다.', 'info')}
      ${UI.seg('dc.what', [{ v: 'sql', l: '테이블 생성문 (SQL)' }, { v: 'json', l: '자료 규칙표 (JSON)' }, { v: 'data', l: '전체 자료 (JSON)' }], what)}
      <textarea id="dc-text" readonly style="width:100%;min-height:26rem;font-family:var(--mono);font-size:.82rem" aria-label="DB 연결용 글">${esc(txt)}</textarea>
      <div class="btn-row end">${UI.btn('전체 복사', 'dc.copy', { kind: 'pri', icon: 'copy' })}</div></div>`;
  }
  function tabSafe() {
    const s = S.health ? S.health() : {};
    return `<div class="gap-m">${UI.note('자료 보호: 실습 자료는 이 컴퓨터 브라우저 저장 공간에 저장됩니다. 저장할 때마다 바로 다시 읽어서 제대로 저장됐는지 확인합니다. 10분마다 예비 사본(백업)을 따로 둡니다. 저장 자료가 손상되면 예비 사본으로 자동 복구합니다. 다른 창(탭)에서 바꾼 자료는 이 창에도 바로 반영되어, 오래된 자료로 덮어쓰지 않습니다.', 'info')}
      ${E().fields([{ l: '자료 형식 판', txt: `제 ${s.version || '-'}판` }, { l: '마지막 저장', txt: s.savedAt ? T.mdhm(s.savedAt) : '-' }, { l: '저장 상태', txt: s.ok ? '정상 (저장 후 다시 읽어 확인함)' : '저장 실패 — 저장 공간 부족 또는 비공개 창', t: s.ok ? 'calc' : 'warn' }, { l: '예비 사본', txt: s.bakAt ? `${T.mdhm(s.bakAt)} (${s.bakKB}KB)` : '아직 없음' }, { l: '저장 용량', txt: `${S.sizeKB()}KB / 약 5,000KB` }, { l: '복구 이력', txt: s.restored ? `${T.mdhm(s.restored)} 예비 사본에서 복구` : '없음' }])}
      <div class="btn-row">${UI.btn('지금 예비 사본 만들기', 'dc.bak', { kind: 'pri' })}${UI.btn('예비 사본으로 되돌리기', 'dc.restore', { kind: 'warn' })}</div></div>`;
  }
  H.reg({
    id: 'datacheck', title: '데이터 점검', actor: '전산 관리자·교수자', layout: 'full', channels: () => ['admin'],
    onEnter() { run(); },
    render() {
      const tab = ms('tab', 'check');
      return `<div class="panel">${UI.tabs('dc.tab', [{ id: 'check', label: '자료 연결 점검', cnt: (last || run()).list.filter((x) => x.lvl === '오류').length || '' }, { id: 'schema', label: '자료 규칙표' }, { id: 'routes', label: '처방 흐름 규칙표' }, { id: 'db', label: 'DB 연결용' }, { id: 'safe', label: '자료 보호' }], tab)}<div class="panel-b">${({ check: tabCheck, schema: tabSchema, routes: tabRoutes, db: tabDb, safe: tabSafe }[tab] || tabCheck)()}</div></div>`;
    },
    acts: {
      'dc.tab': (el) => { set('tab', el.dataset.v); A.render(); }, 'dc.lv': (el) => { set('lv', el.dataset.v); A.render(); }, 'dc.tb': (el) => { set('tb', el.dataset.v); A.render(); }, 'dc.what': (el) => { set('what', el.dataset.v); A.render(); },
      'dc.run': () => { run(); UI.toast('점검 완료', 'ok'); A.render(); },
      'dc.fix': async () => { if (!(await UI.confirm({ title: '자동 고침', text: '자료를 지우지 않고 빠진 이력·시각·열쇠만 바로잡습니다. 고칠까요?', ok: '고치기' }))) return; const n = H.integrity.repair(last ? last.list : null); run(); UI.toast(`${n}건 바로잡았습니다`, 'ok'); A.render(); },
      'dc.copy': () => { const t = document.getElementById('dc-text'); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(() => UI.toast('복사했습니다', 'ok'), () => UI.toast(ok ? '복사했습니다' : '글을 길게 눌러 직접 복사하세요', ok ? 'ok' : 'warn')); else UI.toast(ok ? '복사했습니다' : '글을 직접 선택해 복사하세요', ok ? 'ok' : 'warn'); },
      'dc.bak': () => { S.backup(true); UI.toast('예비 사본을 만들었습니다', 'ok'); A.render(); },
      'dc.restore': async () => { if (!(await UI.confirm({ title: '예비 사본으로 되돌리기', text: '지금 자료를 마지막 예비 사본으로 바꿉니다. 그 뒤에 한 실습은 사라집니다. 되돌릴까요?', ok: '되돌리기' }))) return; if (S.restore()) { run(); UI.toast('예비 사본으로 되돌렸습니다', 'ok'); } else UI.toast('예비 사본이 없습니다', 'warn'); A.render(); },
    },
  });

  // 상태 줄에 자료 점검 결과 표시 (오류가 있으면 눌러서 바로 확인)
  const sb = A.statusbar;
  let cache = null, dirty = true;
  H.bus.on('saved', () => { dirty = true; });
  A.statusbar = () => {
    const html = sb();
    if (!A.user()) return html;
    if (dirty || !cache) { try { const l = H.integrity.check(); cache = { e: l.filter((x) => x.lvl === '오류').length, w: l.filter((x) => x.lvl === '주의').length }; } catch (e) { cache = { e: -1, w: 0 }; } dirty = false; }
    const chip = cache.e ? `<button class="sb-chk bad" data-act="nav.open" data-v="datacheck" data-label="데이터 점검">자료 점검: 오류 ${cache.e}</button>` : `<button class="sb-chk" data-act="nav.open" data-v="datacheck" data-label="데이터 점검">자료 연결 정상${cache.w ? ` · 주의 ${cache.w}` : ''}</button>`;
    return html.replace('<span class="grow"></span>', `${chip}${S.ok ? '' : '<b class="sb-chk bad">저장 실패!</b>'}<span class="grow"></span>`);
  };
})();
