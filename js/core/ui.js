// 화면 공통 부품: 버튼, 표, 선택 버튼 묶음, 팝업, 확인창, 알림, 바코드
(function () {
  const H = window.H;
  const esc = H.esc;

  const attrs = (data) => Object.entries(data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');

  const UI = (H.ui = {
    btn(label, act, o = {}) {
      const cls = ['btn', o.kind || '', o.size || '', o.block ? 'block' : ''].join(' ');
      return `<button type="${o.type || 'button'}" class="${cls}"${act ? ` data-act="${esc(act)}"` : ''}${attrs(o.data)}${o.disabled ? ' disabled' : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>${o.icon ? H.icon(o.icon) : ''}<span>${label}</span></button>`;
    },
    chip(text, tone = 'plain') { return `<span class="chip ${tone}">${esc(text)}</span>`; },
    flag(text, color = 'gray', icon) { return `<span class="flag ${color}">${icon ? H.icon(icon) : ''}${esc(text)}</span>`; },
    empty(title, sub = '') { return `<div class="empty"><b>${esc(title)}</b>${esc(sub)}</div>`; },
    note(html, kind = '') { return `<div class="note ${kind}">${html}</div>`; },
    sec(title) { return `<div class="sec-title">${esc(title)}</div>`; },

    // 표: cols = [{h, cls}], rows = [[cell html...]] or {cells, cls, data}
    table(cols, rows, o = {}) {
      if (!rows.length) return o.empty || UI.empty('표시할 내용이 없습니다');
      const head = cols.map((c) => `<th class="${c.cls || ''}">${esc(c.h)}</th>`).join('');
      const body = rows.map((r) => {
        const cells = Array.isArray(r) ? r : r.cells;
        const cls = Array.isArray(r) ? '' : r.cls || '';
        if (!Array.isArray(r) && r.group) return `<tr class="grp"><td colspan="${cols.length}">${r.group}</td></tr>`;
        return `<tr class="${cls}"${Array.isArray(r) ? '' : attrs(r.data)}>${cells.map((c, i) => `<td class="${cols[i] && cols[i].cls ? cols[i].cls : ''}">${c == null ? '' : c}</td>`).join('')}</tr>`;
      }).join('');
      return `<div class="tbl-wrap"${o.maxH ? ` style="max-height:${o.maxH};overflow-y:auto"` : ''}><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    },

    // 한 번 클릭 선택 묶음 (값은 data-v 로 전달)
    seg(act, options, value, o = {}) {
      return `<div class="seg ${o.cls || ''}">${options.map((op) => {
        const v = typeof op === 'object' ? op.v : op;
        const l = typeof op === 'object' ? op.l : op;
        return `<button type="button" data-act="${esc(act)}" data-v="${esc(v)}"${attrs(o.data)} class="${String(v) === String(value) ? 'on' : ''}">${esc(l)}</button>`;
      }).join('')}</div>`;
    },
    // 폼 안에서 쓰는 단일 선택 (숨은 입력값 + 버튼)
    pick(name, options, value, o = {}) {
      return `<div class="seg" data-pick="${esc(name)}"${o.on ? ` data-onpick="${esc(o.on)}"` : ''}><input type="hidden" name="${esc(name)}" value="${esc(value == null ? '' : value)}">${options.map((op) => {
        const v = typeof op === 'object' ? op.v : op;
        const l = typeof op === 'object' ? op.l : op;
        return `<button type="button" data-pickv="${esc(v)}" class="${String(v) === String(value) ? 'on' : ''}">${esc(l)}</button>`;
      }).join('')}</div>`;
    },
    tabs(act, list, active) {
      return `<div class="tabs" role="tablist">${list.map((t) => `<button class="tab ${t.id === active ? 'on' : ''}" role="tab" data-act="${esc(act)}" data-v="${esc(t.id)}">${t.icon ? H.icon(t.icon) : ''}${esc(t.label)}${t.cnt ? `<span class="cnt">${t.cnt}</span>` : ''}</button>`).join('')}</div>`;
    },
    fld(label, inner, cls = '') { return `<div class="fld ${cls}"><span class="lbl">${esc(label)}</span>${inner}</div>`; },
    input(name, label, value = '', o = {}) {
      return `<div class="fld ${o.cls || ''}"><label for="f-${esc(name)}">${esc(label)}</label><input id="f-${esc(name)}" name="${esc(name)}" type="${o.type || 'text'}" value="${esc(value)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.step ? ` step="${o.step}"` : ''}${o.req ? ' required' : ''}${o.list ? ` list="${o.list}"` : ''} autocomplete="off"></div>`;
    },
    select(name, label, options, value, o = {}) {
      return `<div class="fld ${o.cls || ''}"><label for="f-${esc(name)}">${esc(label)}</label><select id="f-${esc(name)}" name="${esc(name)}">${options.map((op) => {
        const v = typeof op === 'object' ? op.v : op;
        const l = typeof op === 'object' ? op.l : op;
        return `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(l)}</option>`;
      }).join('')}</select></div>`;
    },
    textarea(name, label, value = '', o = {}) {
      return `<div class="fld ${o.cls || 'wide'}"><label for="f-${esc(name)}">${esc(label)}</label><textarea id="f-${esc(name)}" name="${esc(name)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''} style="${o.h ? `min-height:${o.h}` : ''}">${esc(value)}</textarea></div>`;
    },
    check(name, label, checked, o = {}) {
      return `<label class="chk ${checked ? 'on' : ''}"><input type="checkbox" name="${esc(name)}" value="${esc(o.value || 'on')}"${o.multi ? ' data-multi="1"' : ''}${checked ? ' checked' : ''}>${esc(label)}</label>`;
    },

    // 바코드 모양 그림 (교육용 모양만)
    barcode(text) {
      let x = 0, bars = '';
      const s = String(text);
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        for (let b = 0; b < 4; b++) {
          const w = ((c >> b) & 1) + 1;
          if (b % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="40"/>`;
          x += w + 1;
        }
      }
      return `<svg class="barcode" viewBox="0 0 ${x} 40" preserveAspectRatio="none" aria-label="바코드 ${esc(s)}">${bars}</svg>`;
    },

    // ── 팝업 ──
    _modal: null,
    modal(o) {
      UI._modal = o;
      const root = document.getElementById('modal-root');
      root.innerHTML = `<div class="modal-back" data-modal-back="1"><div class="modal ${o.size || ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
        <div class="modal-h">${o.icon ? H.icon(o.icon) : ''}<h3>${esc(o.title)}</h3><button class="btn sm ghost" data-act="ui.close" aria-label="닫기">${H.icon('x')}<span>닫기</span></button></div>
        <div class="modal-b">${o.body}</div>
        ${o.foot ? `<div class="modal-f">${o.foot}</div>` : ''}
      </div></div>`;
      const f = root.querySelector('input:not([type=hidden]), textarea, select');
      if (f && o.focus !== false) setTimeout(() => f.focus(), 30);
      if (o.onOpen) o.onOpen(root);
    },
    refreshModal(body, foot) {
      const root = document.getElementById('modal-root');
      const b = root.querySelector('.modal-b');
      if (b) b.innerHTML = body;
      if (foot != null) { const f = root.querySelector('.modal-f'); if (f) f.innerHTML = foot; }
    },
    close() {
      const o = UI._modal;
      UI._modal = null;
      document.getElementById('modal-root').innerHTML = '';
      if (o && o.onClose) o.onClose();
    },
    confirm({ title = '확인', text = '', ok = '확인', cancel = '취소', danger = false }) {
      return new Promise((resolve) => {
        UI.modal({
          title, size: 'narrow', focus: false,
          body: `<p style="margin:0" class="pre">${text}</p>`,
          foot: `${UI.btn(cancel, 'ui.cf.no', { size: 'lg' })}${UI.btn(ok, 'ui.cf.yes', { kind: danger ? 'danger' : 'pri', size: 'lg' })}`,
          acts: { 'ui.cf.yes': () => { resolve(true); UI.close(); }, 'ui.cf.no': () => { resolve(false); UI.close(); } },
          onClose: () => resolve(false),
        });
      });
    },
    toast(text, kind = '') {
      let box = document.querySelector('.toasts');
      if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
      const t = document.createElement('div');
      t.className = `toast ${kind}`;
      t.innerHTML = `${H.icon(kind === 'err' ? 'alert' : kind === 'warn' ? 'alert' : 'check')}<span>${esc(text)}</span>`;
      box.appendChild(t);
      setTimeout(() => t.remove(), kind === 'err' ? 5000 : 3200);
    },
  });
})();
