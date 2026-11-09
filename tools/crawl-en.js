// 개발용(링크에 올리지 않음): 영어 화면에서 한글로 남는 글을 모음.
// 미리보기 창 콘솔에서: var s=document.createElement('script'); s.src='/tools/crawl-en.js?'+Date.now(); document.head.appendChild(s);
(function () {
  const W = window;
  W.__L = W.__L || {};
  W.__keep = () => { const S = H.store; return [...new Set([...S.all('patients').map((p) => p.name), ...S.all('patients').map((p) => p.address).filter(Boolean), ...H.M.DOCTORS.map((d) => d.name), ...S.all('staff').map((s) => s.name), ...S.all('refs').map((r) => r.pname), '김간호', '한글로', '영어로'])].filter((x) => x && x.length >= 2).sort((a, b) => b.length - a.length); };
  W.__scan = (where) => {
    const I = H.i18n; const keep = W.__keep();
    const roots = [document.querySelector('main'), document.getElementById('modal-root'), document.querySelector('.pbanner'), document.querySelector('.banner'), document.querySelector('.plist')].filter(Boolean);
    const addT = (t, kind) => { t = String(t).replace(/\s+/g, ' ').trim(); if (!/[가-힣]/.test(t)) return; let s = t; keep.forEach((nm) => { s = s.split(nm).join(''); }); if (!/[가-힣]/.test(s)) return; if (!W.__L[t]) W.__L[t] = `${kind}|${where}`; };
    roots.forEach((root) => {
      // 번역 전 원문을 기억했다가, 번역 뒤에도 한글이 남은 글의 "원문"을 기록
      const before = new Map(); const w0 = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n0;
      while ((n0 = w0.nextNode())) { if (/[가-힣]/.test(n0.nodeValue)) before.set(n0, n0.__trOrig || n0.nodeValue); }
      before.forEach((v, node) => { node.__trOrig = v; });
      I.on = true; I.apply(root); I.on = false; // 자동 번역(관찰자)은 꺼 두고 여기서만 직접 번역
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const p = n.parentElement; if (!p || p.closest('script,style,.no-tr')) continue; if (!/[가-힣]/.test(n.nodeValue)) continue; let s = n.nodeValue; keep.forEach((nm) => { s = s.split(nm).join(''); }); if (!/[가-힣]/.test(s)) continue; addT(n.__trOrig || n.nodeValue, 'T'); }
      root.querySelectorAll('textarea,input[type=text]').forEach((el) => { if (el.value) addT(el.value, 'V'); });
      root.querySelectorAll('select option').forEach((el) => addT(el.textContent, 'O'));
    });
  };
  W.__scanFields = (where) => { const keep = W.__keep(); document.querySelectorAll('main textarea, main input[type=text], #modal-root textarea, #modal-root input[type=text]').forEach((el) => { const t = el.value; if (!t || !/[가-힣]/.test(t)) return; t.split('\n').forEach((line) => { let s = line; keep.forEach((nm) => { s = s.split(nm).join(''); }); if (/[가-힣]/.test(s) && !W.__L[line.trim()]) W.__L[line.trim()] = `F|${where}`; }); }); };
  const tabsIn = () => [...document.querySelectorAll('main [data-act][data-v]')].filter((b) => /\.(tab|v|view|sub)$/.test(b.dataset.act)).slice(0, 14).map((b) => [b.dataset.act, b.dataset.v]);
  // 보기 전용 팝업 버튼(보고서·미리보기·영상 보기 등)
  const VIEW = /(view|preview|print|report|paper|slip|label|pacs|detail|show|img|image|doc)$/i;
  W.__crawlP = (pids, mods, withModal) => {
    const A = H.app, S = H.store; let n = 0; H.i18n.on = false;
    setTimeout(() => { H.i18n.on = H.i18n.lang === 'en'; }, 0);
    for (const pid of pids) {
      const encs = S.all('encounters').filter((e) => e.patientId === pid).sort((a, b) => b.at - a.at); const e = encs[0]; if (!e) continue;
      for (const m of mods) {
        try {
          A.navActs['nav.closeAll'](); A.open(m); A.st.pid = pid; A.st.encId = e.id; A.render(); W.__scan(m); n++;
          for (const [act, v] of tabsIn()) {
            const b = document.querySelector(`main [data-act="${act}"][data-v="${v}"]`); if (!b) continue; b.click(); W.__scan(`${m}/${v}`); n++;
            // 예시 글 채우기 버튼을 눌러 입력칸에 들어가는 글도 점검
            [...document.querySelectorAll('main [data-act], #modal-root [data-act]')].filter((x) => /(fill|Fill|\.ex$|Ex$|tpl|Tpl|sample)/.test(x.dataset.act)).slice(0, 6).forEach((x) => { try { x.click(); H.i18n.on = true; H.i18n.fields(document.body); H.i18n.on = false; W.__scanFields(`${m}/${v}/예시`); } catch (er) { /* 무시 */ } });
            if (withModal) { const vb = [...document.querySelectorAll('main [data-act]')].filter((x) => VIEW.test(x.dataset.act) && !/^nav\./.test(x.dataset.act)).slice(0, 6);
              vb.forEach((x) => { try { x.click(); W.__scan(`${m}/${v}/팝업`); H.ui.close(); } catch (er) { /* 무시 */ } }); }
          }
        } catch (err) { /* 무시 */ }
      }
    }
    return n;
  };
  W.__dump = async (name) => { const body = Object.entries(W.__L).map(([k, v]) => `${v}\t${k}`).join('\n'); await fetch(`/__dump?name=${encodeURIComponent(name)}`, { method: 'POST', body }); return Object.keys(W.__L).length; };
  W.__crawlReady = true;
})();
