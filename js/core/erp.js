// 원무·심사 실무 화면 공통 부품 (상용 HIS 입력 화면 모양)
(function () {
  const H = window.H;
  const S = H.store;
  const esc = H.esc;
  const won = (n) => (Math.round(n) || 0).toLocaleString('ko-KR');

  // 감염주의 표시 A~E
  const INF = [['A', '공기주의', '#1F4AB8'], ['B', '혈액주의', '#C21F2B'], ['C+', '강화된 접촉주의', '#E07A1F'], ['C', '접촉주의', '#C9A100'], ['D', '비말주의', '#2E9BD6'], ['E', '보호격리', '#6B3FA8']];

  // 환자 원무 정보 (없으면 가상으로 만들어 둠)
  function info(p) {
    if (!p.erp) {
      const b = (p.birth || '1970-01-01').replace(/-/g, '').slice(2);
      const y = Number((p.birth || '1970').slice(0, 4));
      const g = y >= 2000 ? (p.sex === 'M' ? 3 : 4) : (p.sex === 'M' ? 1 : 2);
      const seed = (p.mrn || '0').slice(-4);
      p.erp = {
        rrn: `${b}-${g}${seed.slice(0, 2)}****`, eng: '', zip: `0${seed.slice(0, 4)}`, sub: '', email: '', car: '', tel2: (p.guardian || '').match(/010-[\dx-]+/)?.[0] || '', home: '',
        insNo: `${seed}${String(p.mrn).slice(2, 6)}`, insOrg: p.ins && p.ins.startsWith('의료급여') ? '가상구청' : p.ins && p.ins.startsWith('산재') ? '근로복지공단' : p.ins && p.ins.startsWith('자동차') ? ((p.payerInfo || {}).name || '가상손해보험') : '국민건강보험공단',
        insCode: p.ins && p.ins.startsWith('건강') ? `1${seed}${seed.slice(0, 2)}${seed.slice(1, 3)}` : '', holder: p.name, holderRrn: '', rel: '본인', outEx: '00 해당 없음', consent: false, infect: [], memo: '', abo: (p.blood || '').replace(/[+-]/, ''), rh: (p.blood || '').includes('-') ? '-' : '+',
      };
      if (p.flags && p.flags.isolation) { if (/접촉/.test(p.flags.isolation)) p.erp.infect.push('C'); if (/공기/.test(p.flags.isolation)) p.erp.infect.push('A'); if (/비말/.test(p.flags.isolation)) p.erp.infect.push('D'); if (/보호/.test(p.flags.isolation)) p.erp.infect.push('E'); }
    }
    return p.erp;
  }

  // 수가 세부 (교육용 근사): 적용단가에 상급종합 종별가산 30% 포함, 환산지수 95원
  const CONV = 95, ADD = 0.3;
  function lineDetail(l) {
    const it = l.orderId ? H.M.item((S.get('orders', l.orderId) || {}).code) : null;
    const cat = it ? it.cat : '';
    const mat = ['MED', 'INJ', 'BLOOD'].includes(cat) ? 1 : cat === 'OP' || cat === 'CV' ? 0.12 : 0;
    const edi = it ? ({ MED: '6', INJ: '6', LAB: 'B', RAD: 'HA', PATH: 'C5', PROC: 'M', OP: 'Q', BLOOD: 'X', CV: 'M6', EN: 'E7' }[cat] || 'Z') + l.code.replace(/\D/g, '').padStart(4, '0') : l.code;
    const act = l.amount * (1 - mat);
    return Object.assign({}, l, { group: l.group, single: l.code, edi, mat: Math.round(l.amount * mat), act: Math.round(act), add: Math.round((act / (1 + ADD)) * ADD), point: (l.price * (1 - mat) / (1 + ADD) / CONV).toFixed(2), half: cat === 'LAB' || cat === 'RAD' ? '' : '', pay: l.pay ? '급여' : '비급여', incl: '' });
  }

  const E = (H.erp = {
    INF, info, lineDetail, won, CONV, ADD,
    bar(items) {
      return `<div class="erp-bar">${items.map((x) => x === '|' ? '<span class="sep"></span>' : typeof x === 'string' ? x : `<button type="button" class="btn ${x.kind || ''}" data-act="${esc(x.act)}"${x.data ? Object.entries(x.data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('') : ''}${x.disabled ? ' disabled' : ''}>${x.fk ? `<span class="fk">${esc(x.fk)}</span>` : ''}${esc(x.l)}</button>`).join('')}</div>`;
    },
    // fields: [{l, n(name), v, t:'key|req|warn|calc|ro', type, opts, w:2|'full', ro, txt, lc:'red|blue'}]
    fields(list, o = {}) {
      return `<div class="erp-f"${o.cols ? ` style="grid-template-columns:repeat(auto-fill,minmax(${o.cols},1fr))"` : ''}>${list.map((f) => {
        const cls = `c ${f.t || ''} ${f.w === 2 ? 'w2' : f.w === 'full' ? 'full' : ''}`;
        let inner;
        if (f.html != null) inner = f.html;
        else if (f.txt != null) inner = `<span class="txt" title="${esc(f.txt)}">${esc(f.txt)}</span>`;
        else if (f.opts) inner = `<select name="${esc(f.n || '')}"${f.ro ? ' disabled' : ''} aria-label="${esc(f.l)}">${f.opts.map((x) => { const v = typeof x === 'object' ? x.v : x; const l = typeof x === 'object' ? x.l : x; return `<option value="${esc(v)}"${String(v) === String(f.v) ? ' selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
        else inner = `<input name="${esc(f.n || '')}" value="${esc(f.v == null ? '' : f.v)}" type="${f.type || 'text'}"${f.ro || !f.n ? ' readonly' : ''} aria-label="${esc(f.l)}"${f.step ? ` step="${f.step}"` : ''}>`;
        return `<div class="${cls}"><div class="l ${f.lc || ''}">${esc(f.l)}</div><div class="v">${inner}</div></div>`;
      }).join('')}</div>`;
    },
    // cols: [{h, k, n(숫자), w}] rows: [{cells|obj, on, act, data}]
    grid(cols, rows, o = {}) {
      return `<div class="erp-grid" style="${o.h ? `max-height:${o.h}` : ''}"><table><thead><tr>${cols.map((c) => `<th>${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((r) => {
        const cells = Array.isArray(r) ? r : r.cells;
        const attrs = Array.isArray(r) ? '' : `${r.act ? ` data-act="${esc(r.act)}"` : ''}${r.data ? Object.entries(r.data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('') : ''}`;
        return `<tr class="${!Array.isArray(r) && r.on ? 'on' : ''} ${!Array.isArray(r) && r.act ? 'click' : ''}"${attrs}>${cells.map((c, i) => `<td class="${cols[i] && cols[i].n ? 'n' : ''}">${c == null ? '' : c}</td>`).join('')}</tr>`;
      }).join('') : `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--fg-3);padding:1.5rem">${esc(o.empty || '자료가 없습니다')}</td></tr>`}</tbody></table></div>`;
    },
    // rows: [{k, v(number|string), cls:'bold y b p dark red', input:{n, v}}] or 'hr'
    money(rows) {
      return `<div class="erp-money">${rows.map((r) => r === 'hr' ? '<div class="hr"></div>' : `<div class="r ${r.cls || ''}"><div class="k">${esc(r.k)}</div><div class="x">${r.input ? `<input name="${esc(r.input.n)}" value="${esc(r.input.v ?? 0)}" type="number" data-inp="${esc(r.input.on || '')}" aria-label="${esc(r.k)}">` : typeof r.v === 'number' ? won(r.v) : esc(r.v ?? '')}</div></div>`).join('')}</div>`;
    },
    infect(p, act) {
      const i = info(p);
      return `<span class="row" style="gap:.1rem">${INF.map(([c, l, col]) => `<span class="inf ${i.infect.includes(c) ? '' : 'off'}" ${act ? `data-act="${act}" data-c="${c}"` : ''} title="${l}"><b style="background:${col}">${c}</b>${l}</span>`).join('')}</span>`;
    },
    tabs(act, list, on) { return `<div class="erp-tabs">${list.map(([id, l]) => `<button type="button" class="${id === on ? 'on' : ''}" data-act="${esc(act)}" data-v="${esc(id)}">${esc(l)}</button>`).join('')}</div>`; },
    // 환자 기본 정보 칸 (외래·입원 등록, 수납 공통)
    patFields(p) {
      const i = info(p);
      return E.fields([
        { l: '등록번호', txt: p.mrn, t: 'key', lc: 'blue' }, { l: '주민/여권', txt: i.rrn, t: 'key' }, { l: '휴대[환자]', n: 'e_phone', v: p.phone || '', t: 'key' }, { l: '우편번호', n: 'e_zip', v: i.zip },
        { l: '성명[한글]', txt: p.name, t: 'key' }, { l: '생년월일', txt: p.birth }, { l: '휴대[보호]', n: 'e_tel2', v: i.tel2 }, { l: '하위주소', n: 'e_addr', v: p.address || '', t: 'warn', w: 2 },
        { l: '성명[영문]', n: 'e_eng', v: i.eng, t: 'key' }, { l: 'ABO · Rh', txt: `${i.abo || '-'} · ${i.rh}` }, { l: '기타[자택]', n: 'e_home', v: i.home }, { l: 'E-mail', n: 'e_email', v: i.email, t: 'req' },
        { l: '차량번호', n: 'e_car', v: i.car }, { l: '원외예외', n: 'e_outEx', v: i.outEx, opts: ['00 해당 없음', '01 원내 조제 (거동 불편)', '02 응급 환자', '03 마약류', '04 결핵'], t: 'calc' }, { l: '참고사항', n: 'e_memo', v: i.memo, w: 2 },
      ]);
    },
    savePat(p, d) {
      const i = info(p);
      if (d.e_phone != null) p.phone = d.e_phone;
      if (d.e_addr != null) p.address = d.e_addr;
      ['zip', 'tel2', 'eng', 'home', 'email', 'car', 'outEx', 'memo'].forEach((k) => { if (d['e_' + k] != null) i[k] = d['e_' + k]; });
    },
    // 결제 계산: 본인부담총액 - 할인 - 감액 - 기납입 - 미수 → 10원 미만 절사 → 받을 돈
    payCalc(base, d) {
      const n = (k) => Math.max(0, Number(d[k]) || 0);
      const disc = n('p_disc'), red = n('p_red'), misu = n('p_misu'), blood = n('p_blood'), sanjeon = n('p_sanjeon');
      const raw = Math.max(0, base.totalSelf - base.prepaid - disc - red - misu - blood - sanjeon);
      const cut = raw % 10; const due = raw - cut;
      return { disc, red, misu, blood, sanjeon, cut, due };
    },
  });
})();
