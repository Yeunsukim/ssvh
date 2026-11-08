// 한글로 / 영어로 전환 — 화면을 그린 뒤 화면 글자(이름표·버튼·표 머리글·메시지·의학 용어)를 영어 사전으로 바꿈
// 사용자가 입력하는 칸(input·textarea)과 사람 이름은 바꾸지 않음. 사전: js/i18n/dict-en.js (H.I18N_EN)
(function () {
  const H = window.H;
  const S = H.store;
  const KO = /[가-힣]/;
  const I = (H.i18n = { lang: 'ko', cache: new Map(), on: false });

  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let nameRe = null, nameSet = null, termRe = null, termMap = null, dict = null;
  function names() {
    const me = (S.session().user || {}).name;
    const refN = S.db ? [...S.all('refs').map((r) => r.pname), ...S.all('recs').filter((r) => r.kind === 'voc' && r.name).map((r) => String(r.name).split(' ')[0]).filter((n) => /^[가-힣]{2,4}$/.test(n) && n !== '익명')] : [];
    const l = [...new Set([me, ...refN, ...(S.db ? S.all('patients').map((p) => p.name) : []), ...(H.M.DOCTORS || []).map((d) => d.name), ...(S.db ? S.all('staff').map((s) => s.name) : [])].filter((n) => n && n.length >= 2))].sort((a, b) => b.length - a.length);
    nameSet = new Set(l); nameRe = l.length ? new RegExp(l.map(escRe).join('|'), 'g') : null;
  }
  function build() {
    dict = H.I18N_EN || {};
    // 문구 일부만 맞을 때 쓰는 용어 사전 (자리표 없는 것, 2글자 이상, 긴 것부터)
    const keys = Object.keys(dict).filter((k) => !/[#@]/.test(k) && k.length >= 2 && KO.test(k)).sort((a, b) => b.length - a.length);
    termMap = new Map(keys.map((k) => [k, dict[k]]));
    termRe = keys.length ? new RegExp(keys.map(escRe).join('|'), 'g') : null;
    names();
  }
  // 사람 이름 로마자 표기 (국어의 로마자 표기법 기본형, 성은 관용 표기) — 저장 자료는 그대로 한글
  const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
  const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
  const JONG = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
  const SUR = { 김: 'Kim', 이: 'Lee', 박: 'Park', 최: 'Choi', 정: 'Jeong', 강: 'Kang', 조: 'Jo', 윤: 'Yoon', 장: 'Jang', 임: 'Lim', 한: 'Han', 오: 'Oh', 서: 'Seo', 신: 'Shin', 권: 'Kwon', 황: 'Hwang', 안: 'Ahn', 송: 'Song', 류: 'Ryu', 전: 'Jeon', 홍: 'Hong', 고: 'Ko', 문: 'Moon', 손: 'Son', 배: 'Bae', 백: 'Baek', 허: 'Heo', 노: 'Noh', 하: 'Ha', 주: 'Joo', 구: 'Koo', 심: 'Shim', 나: 'Na', 진: 'Jin', 남궁: 'Namgung' };
  const syl = (ch) => { const c = ch.charCodeAt(0) - 0xac00; if (c < 0 || c > 11171) return ch; return CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28]; };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function roman(name) {
    return name.split(' ').map((w) => {
      if (w === '아기') return 'Baby';
      if (!KO.test(w)) return w;
      const s2 = w.length >= 3 && SUR[w.slice(0, 2)] ? 2 : 1; const sur = w.slice(0, s2); const given = w.slice(s2);
      const S1 = SUR[sur] || cap([...sur].map(syl).join(''));
      return given ? `${S1} ${cap([...given].map(syl).join('-'))}` : S1;
    }).join(' ');
  }
  I.roman = roman;
  // 숫자+단위 규칙 (사전에 없는 조합 문구용)
  const N = '(\\d[\\d,.]*)';
  const RULES = [
    [/(남|여)\/생후 (\d+)일/g, (m, s, d) => `${s === '남' ? 'M' : 'F'}/day ${d}`],
    [/(남|여)\/(\d+)세/g, (m, s, a) => `${s === '남' ? 'M' : 'F'}/${a}y`],
    [/생후 (\d+)일/g, 'day $1'],
    [new RegExp(N + '원', 'g'), '₩$1'], [new RegExp(N + '개월', 'g'), '$1 mo'], [new RegExp(N + '시간', 'g'), '$1 h'],
    [new RegExp(N + '건', 'g'), '$1 items'], [new RegExp(N + '명', 'g'), '$1 pts'], [new RegExp(N + '일', 'g'), '$1 d'], [new RegExp(N + '분', 'g'), '$1 min'],
    [new RegExp(N + '회', 'g'), '$1 times'], [new RegExp(N + '시(?!간)', 'g'), '$1h'], [new RegExp(N + '세', 'g'), '$1y'], [new RegExp(N + '점', 'g'), '$1 pts'], [new RegExp(N + '주', 'g'), '$1 wk'],
    [new RegExp(N + '개', 'g'), '$1'], [new RegExp(N + '차', 'g'), 'round $1'], [new RegExp(N + '단위', 'g'), '$1 units'], [new RegExp(N + '번', 'g'), 'no. $1'],
    [/ 님/g, ''], [/님 /g, ' '],
  ];
  // 글자 한 덩어리 번역
  function tr(text) {
    if (!text || !KO.test(text)) return text;
    const hit = I.cache.get(text); if (hit !== undefined) return hit;
    const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
    const t = text.replace(/\s+/g, ' ').trim();
    // 사람 이름(환자·직원·로그인)은 영어 화면에서도 한글 그대로 둠
    let out = nameSet && nameSet.has(t) ? t : dict[t];
    if (out === undefined) {
      const ns = [], nums = [];
      let k = nameRe ? t.replace(nameRe, (m) => { ns.push(m); return '@'; }) : t;
      k = k.replace(/\d+(?:[.,:\-/]\d+)*/g, (m) => { nums.push(m); return '#'; });
      const tpl = dict[k];
      if (tpl !== undefined) { let ni = 0, ai = 0; out = tpl.replace(/[#@]/g, (c) => (c === '#' ? (nums[ni++] ?? '') : (ns[ai++] ?? ''))); }
      else {
        // 이름은 잠시 표시로 감춰 보호 → 숫자+단위 규칙 → 용어 사전 → 이름 되돌림
        const keep = [];
        out = nameRe ? t.replace(nameRe, (m) => { keep.push(m); return `\u0001${keep.length - 1}\u0001`; }) : t;
        RULES.forEach(([re, to]) => { out = out.replace(re, to); });
        if (termRe && t.length <= 60) out = out.replace(termRe, (m) => ` ${termMap.get(m)} `);
        out = out.replace(/\u0001(\d+)\u0001/g, (m, i) => keep[Number(i)]);
        out = out.replace(/\s{2,}/g, ' ').replace(/ ([,.:)\]·/])/g, '$1').replace(/([([]) /g, '$1').trim();
      }
    }
    out = lead + out + trail;
    I.cache.set(text, out); return out;
  }
  I.tr = tr;
  const SKIP = new Set(['INPUT', 'TEXTAREA', 'SCRIPT', 'STYLE']);
  const skipEl = (el) => !el || SKIP.has(el.tagName) || el.tagName === 'TITLE' || (el.closest && el.closest('.no-tr,[contenteditable="true"],title'));
  function applyText(n) {
    if (n.__trOut !== undefined && n.__trOut === n.nodeValue) return; // 이미 바꾼 글자
    const orig = n.nodeValue; if (!KO.test(orig)) return;
    const out = tr(orig); n.__trOut = out; if (out !== orig) n.nodeValue = out;
  }
  const ATTR = ['placeholder', 'aria-label', 'title'];
  function apply(root) {
    if (!I.on || !root) return;
    if (root.nodeType === 3) { if (!skipEl(root.parentElement)) applyText(root); return; }
    if (root.nodeType !== 1 || skipEl(root)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (KO.test(n.nodeValue) && !skipEl(n.parentElement) ? 1 : 2) });
    const list = []; let n; while ((n = w.nextNode())) list.push(n); list.forEach(applyText);
    const els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[aria-label],[title]') : [];
    [root, ...els].forEach((el) => { if (!el.getAttribute || skipEl(el) && el !== root) return; ATTR.forEach((a) => { const v = el.getAttribute(a); if (v && KO.test(v)) el.setAttribute(a, tr(v)); }); });
  }
  I.apply = apply;
  let mo = null, busy = false;
  // 창 제목: 이미 바꾼 제목은 다시 바꾸지 않음 (제목 태그가 본문 안에 있으면 무한 반복될 수 있음)
  let titleOut = null;
  const fixTitle = () => { const t = document.title; if (t === titleOut || !KO.test(t)) return; titleOut = tr(t); if (titleOut !== t) document.title = titleOut; };

  function observe() {
    if (mo) return;
    mo = new MutationObserver((ms) => { if (!I.on || busy) return; busy = true; try { ms.forEach((m) => { if (m.type === 'characterData') { if (!skipEl(m.target.parentElement)) applyText(m.target); } else m.addedNodes.forEach(apply); }); fixTitle(); } finally { busy = false; } });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  I.set = (lang) => {
    I.lang = lang === 'en' ? 'en' : 'ko'; I.on = I.lang === 'en';
    S.setPref('lang', I.lang); document.documentElement.lang = I.on ? 'en' : 'ko';
    if (I.on) { build(); I.cache.clear(); observe(); }
    if (H.app && H.app.render) H.app.render();
    if (I.on) { apply(document.body); fixTitle(); }
  };
  I.init = () => { const l = S.prefs().lang; if (l === 'en') { I.lang = 'en'; I.on = true; document.documentElement.lang = 'en'; build(); observe(); setTimeout(() => apply(document.body), 0); } };
  // 저장할 때 새 환자 이름이 생기면 이름 목록을 다시 만듦
  H.bus.on('saved', () => { if (I.on && S.db && nameRe && S.all('patients').length !== I._np) { I._np = S.all('patients').length; names(); I.cache.clear(); } });
})();
