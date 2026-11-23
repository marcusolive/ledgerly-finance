(() => {
  const { $, $$, icon, fmt } = Kit;
  const nav = Kit.shell();

  const RATES = { USD: 1, EUR: 0.92, GBP: 0.79, BRL: 5.35 };
  const STAGES = ['Pending approval', 'Approved', 'Scheduled', 'Paid'];
  const BUCKETS = [['0–30', 0, 30, '#0f9d58'], ['31–60', 31, 60, '#f29900'], ['61–90', 61, 90, '#e8710a'], ['90+', 91, Infinity, '#d93025']];
  const state = {
    cur: 'USD', fyStart: 0, range: 12, scenario: 'base', flow: 'net', quarter: 3, apStage: '',
    policies: [
      { key: 'ctrl', label: 'Controller can approve bills up to', limit: 10000, on: true },
      { key: 'cfo', label: 'CFO approval required above', limit: 25000, on: true },
      { key: 'board', label: 'Board sign-off required above', limit: 250000, on: true },
      { key: 'dual', label: 'Two approvers for the first bill from a new vendor', on: true },
      { key: 'auto', label: 'Auto-schedule approved bills on their due date', on: false }
    ]
  };

  const todayIso = Data.iso(Data.today);
  const rate = () => RATES[state.cur];
  const conv = v => v * rate();
  const cur = v => fmt.money(v, state.cur);
  const money = v => cur(conv(v));
  const sym = () => new Intl.NumberFormat('en-US', { style: 'currency', currency: state.cur }).formatToParts(0).find(p => p.type === 'currency').value;
  const shortC = v => `${v < 0 ? '−' : ''}${sym()}${fmt.compact(Math.abs(v))}`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const date = s => (s ? Data.parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
  const dateShort = s => Data.parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const until = s => { const n = -Data.daysFrom(s); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? `${-n} days ago` : `in ${n} days`; };
  const sum = (list, k = 'amount') => list.reduce((a, x) => a + x[k], 0);
  const policy = key => state.policies.find(p => p.key === key);
  const cashTotal = () => sum(Data.banks, 'balance');

  const BADGE = { Paid: 'ok', Open: 'info', Overdue: 'bad', 'Pending approval': 'warn', Approved: 'mute', Scheduled: 'info', Connected: 'ok', Syncing: 'info', Actual: 'mute', Forecast: 'info', 'On track': 'ok', 'At risk': 'warn', 'Over budget': 'bad' };
  const badge = s => `<span class="badge dot ${BADGE[s] || 'mute'}">${s}</span>`;
  const delta = (d, invert = false, unit = '%', suffix = 'vs last month') => `<div class="delta ${(d >= 0) !== invert ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}${unit} ${suffix}</div>`;
  const note = (text, tone = 'muted') => `<div class="delta ${tone}">${text}</div>`;

  function kpis(host, prefix, list) {
    host.innerHTML = list.map((k, i) => `<div class="card kpi"><div class="lbl">${icon(k.icon)}${k.label}</div><div class="val" id="${prefix}v${i}">0</div>${k.foot || ''}${k.data ? `<div class="spark" id="${prefix}s${i}"></div>` : ''}</div>`).join('');
    list.forEach((k, i) => {
      Kit.countUp($(`#${prefix}v${i}`), k.value, k.f);
      if (k.data) Kit.spark($(`#${prefix}s${i}`), k.data, k.color || 'var(--brand)');
    });
  }

  const seg = (sel, fn) => $(sel).addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    $$('button', $(sel)).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    fn(b.dataset);
  });
  const setFilter = (host, i, v) => { const s = $(`${host} select[data-f="${i}"]`); if (s) { s.value = v; s.dispatchEvent(new Event('change')); } };
  const tableSearch = (host, v) => { const s = $(`${host} input[type=search]`); if (s) { s.value = v; s.dispatchEvent(new Event('input')); } };

  $$('[data-go]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); nav.go(b.dataset.go); }));
  const hour = new Date().getHours();
  $('#greet').textContent = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, Marcus`;

  function updateBadges() {
    const overdue = Data.invoices.filter(i => i.status === 'Overdue').length;
    const pending = Data.bills.filter(b => b.status === 'Pending approval').length;
    [['#arBadge', overdue], ['#apBadge', pending]].forEach(([sel, n]) => { $(sel).textContent = n; $(sel).style.display = n ? '' : 'none'; });
  }

  const netIncome = (rev, exp, f) => { const ebt = rev - exp - 123000 * f; return ebt - Math.max(0, ebt * 0.24); };

  function renderOverview() {
    const m = Data.mtd, cash = cashTotal(), hist = Data.months.slice(-12);
    const margin = netIncome(m.revenue, m.expenses, m.frac) / m.revenue * 100;
    const prevMargin = netIncome(m.prevRevenue, m.prevExpenses, m.frac) / m.prevRevenue * 100;
    $('#bankCount').textContent = Data.banks.filter(b => b.status === 'Connected').length;
    $('#cashHead').textContent = money(cash);
    kpis($('#kpis'), 'k', [
      { label: 'Cash balance', icon: 'bank', value: conv(cash), f: cur, foot: delta((cash / Data.cashHistory[10] - 1) * 100), data: [...Data.cashHistory.slice(0, -1), cash] },
      { label: 'Revenue MTD', icon: 'chart', value: conv(m.revenue), f: cur, foot: delta((m.revenue / m.prevRevenue - 1) * 100, false, '%', 'vs same day last month'), data: hist.map(x => x.revenue) },
      { label: 'Expenses MTD', icon: 'wallet', value: conv(m.expenses), f: cur, foot: delta((m.expenses / m.prevExpenses - 1) * 100, true, '%', 'vs same day last month'), data: hist.map(x => x.expenses), color: '#e8710a' },
      { label: 'Net margin', icon: 'spark', value: margin, f: v => fmt.pct(v), foot: delta(margin - prevMargin, false, ' pts', 'vs last month'), data: hist.map(x => { const p = Data.pnl([x]); return p.net / p.revenue; }) }
    ]);
    renderUpcoming();
    renderAlerts();
  }

  function drawRevenue() {
    const hist = Data.months.slice(-state.range);
    Kit.line($('#revChart'), {
      labels: hist.map(x => x.label), height: 260, format: cur,
      series: [{ name: 'Revenue', color: '#0f9d58', data: hist.map(x => conv(x.revenue)) }, { name: 'Expenses', color: '#e8710a', data: hist.map(x => conv(x.expenses)) }]
    });
  }
  seg('#range', d => { state.range = Number(d.r); drawRevenue(); });

  function drawDonut() {
    Kit.donut($('#expDonut'), { items: Data.expenseCats.map(c => ({ ...c, value: conv(c.value) })), center: { value: shortC(conv(Data.mtd.expenses)), label: 'month to date' }, format: shortC });
  }

  function renderUpcoming() {
    const list = Data.bills.filter(b => b.status !== 'Paid').sort((a, b) => ((a.payDate || a.due) > (b.payDate || b.due) ? 1 : -1)).slice(0, 6);
    $('#upcoming').innerHTML = list.length ? list.map(b => {
      const when = b.payDate || b.due;
      return `<div class="li click" data-bill="${b.id}" tabindex="0" role="button" aria-label="Open ${b.id} from ${esc(b.vendor)}"><span class="ic">${icon('calendar')}</span><div class="grow"><b>${esc(b.vendor)}</b><small>${b.status === 'Scheduled' ? 'Pays' : 'Due'} ${dateShort(when)} · ${until(when)}</small></div><div class="side-r"><span class="amt">${money(b.amount)}</span>${badge(b.status)}</div></div>`;
    }).join('') : '<p class="empty">No payments due.</p>';
  }
  const openFromList = e => {
    const li = e.target.closest('[data-bill]');
    if (!li || (e.type === 'keydown' && e.key !== 'Enter')) return;
    nav.go('payables');
    openBill(Data.bills.find(b => b.id === li.dataset.bill));
  };
  $('#upcoming').addEventListener('click', openFromList);
  $('#upcoming').addEventListener('keydown', openFromList);

  let alertActions = [];
  function renderAlerts() {
    const list = [];
    const overdue = Data.invoices.filter(i => i.status === 'Overdue');
    if (overdue.length) list.push({ tone: 'bad', ic: 'alert', title: `${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''}`, text: `${money(sum(overdue))} past due, oldest ${Math.max(...overdue.map(i => Data.daysFrom(i.due)))} days late`, go: () => { nav.go('receivables'); setFilter('#arTable', 0, 'Overdue'); } });
    const over = Data.departments.filter(d => d.actual > d.budget);
    if (over.length) list.push({ tone: 'bad', ic: 'chart', title: `Budget overrun in ${over.length} department${over.length > 1 ? 's' : ''}`, text: over.map(d => `${d.name} ${(d.actual / d.budget * 100).toFixed(0)}%`).join(' · '), go: () => nav.go('budgets') });
    const pending = Data.bills.filter(b => b.status === 'Pending approval');
    if (pending.length) list.push({ tone: 'warn', ic: 'clock', title: `${pending.length} bill${pending.length > 1 ? 's' : ''} awaiting approval`, text: `${money(sum(pending))} in total, first due ${dateShort(pending.map(b => b.due).sort()[0])}`, go: () => { nav.go('payables'); setFilter('#apTable', 0, 'Pending approval'); } });
    ['base', 'conservative'].some(key => {
      const low = lowest(forecast(key));
      if (low.balance >= Data.minCash) return false;
      list.push({ tone: key === 'base' ? 'bad' : 'warn', ic: 'swap', title: `${Data.scenarios[key].label} forecast falls below minimum cash`, text: `Lowest ${money(low.balance)} in the week of ${low.label}, policy ${money(Data.minCash)}`, go: () => { setScenario(key); nav.go('cashflow'); } });
      return true;
    });
    alertActions = list.map(a => a.go);
    $('#alertCount').textContent = list.length ? `${list.length} need attention` : '';
    $('#alerts').innerHTML = list.length ? list.map((a, i) => `<div class="li"><span class="ic ${a.tone}">${icon(a.ic)}</span><div class="grow"><b>${a.title}</b><small>${a.text}</small></div><button class="btn sm" data-alert="${i}">Review</button></div>`).join('')
      : `<div class="li"><span class="ic ok">${icon('check')}</span><div class="grow"><b>All clear</b><small>No overdue invoices, overruns or cash risks.</small></div></div>`;
  }
  $('#alerts').addEventListener('click', e => { const b = e.target.closest('[data-alert]'); if (b) alertActions[Number(b.dataset.alert)](); });
  $('#bell').addEventListener('click', () => { nav.go('overview'); $('#alerts').closest('.card').scrollIntoView({ behavior: 'smooth', block: 'center' }); });

  function forecast(key) {
    const s = Data.scenarios[key], cash = cashTotal();
    const rows = Data.weeks.map(w => ({ ...w, type: w.actual ? 'Actual' : 'Forecast', inflow: w.actual ? w.inflow : Math.round(w.inflow * s.inM), outflow: w.actual ? w.outflow : Math.round(w.outflow * s.outM) }));
    let b = cash;
    for (let i = 3; i >= 0; i--) { rows[i].balance = b; b -= rows[i].inflow - rows[i].outflow; }
    b = cash;
    rows.forEach((r, i) => { r.net = r.inflow - r.outflow; if (i > 3) { b += r.net; r.balance = b; } });
    return rows;
  }
  const lowest = rows => rows.slice(4).reduce((a, r) => (r.balance < a.balance ? r : a));

  let weeksTbl;
  function renderCash() {
    const rows = forecast(state.scenario), cash = cashTotal(), end = rows.at(-1).balance, low = lowest(rows);
    const below = rows.slice(4).filter(r => r.balance < Data.minCash).length;
    kpis($('#cashKpis'), 'c', [
      { label: 'Cash today', icon: 'bank', value: conv(cash), f: cur, foot: note(`${Data.banks.length} bank accounts`) },
      { label: 'Ending cash · week 13', icon: 'swap', value: conv(end), f: cur, foot: delta((end / cash - 1) * 100, false, '%', 'vs today') },
      { label: 'Lowest projected balance', icon: 'alert', value: conv(low.balance), f: cur, foot: note(`Week of ${low.label}`, low.balance < Data.minCash ? 'down' : 'up') },
      { label: 'Weeks below policy', icon: 'shield', value: below, f: v => fmt.num(v), foot: note(`Minimum ${money(Data.minCash)}`, below ? 'down' : 'up') }
    ]);
    $('#policyNote').textContent = `${Data.scenarios[state.scenario].label} scenario · policy minimum ${money(Data.minCash)}`;
    $('#assumptions').innerHTML = Data.scenarios[state.scenario].notes.map(([t, d]) => `<div class="li"><span class="ic">${icon({ Collections: 'users', Payroll: 'calendar', Vendors: 'card', Financing: 'bank' }[t])}</span><div class="grow"><b>${t}</b><small>${d}</small></div></div>`).join('');
    const table = {
      columns: [
        { key: 'start', label: 'Week of', render: (v, r) => r.label },
        { key: 'type', label: 'Type', render: badge },
        { key: 'inflow', label: 'Inflows', num: true, render: money },
        { key: 'outflow', label: 'Outflows', num: true, render: money },
        { key: 'net', label: 'Net', num: true, render: v => `<span class="${v < 0 ? 'down' : 'up'}">${v < 0 ? '−' : '+'}${money(Math.abs(v))}</span>` },
        { key: 'balance', label: 'Ending balance', num: true, render: v => `<b class="${v < Data.minCash ? 'down' : ''}">${money(v)}</b>` }
      ],
      rows, pageSize: 9, searchable: false,
      filters: [{ label: 'Type', key: 'type', options: ['Actual', 'Forecast'] }]
    };
    weeksTbl ? weeksTbl.refresh(rows) : (weeksTbl = Kit.table($('#weeksTable'), table));
  }

  function drawForecast() {
    const rows = forecast(state.scenario), host = $('#forecastChart'), bal = rows.map(r => conv(r.balance));
    Kit.line(host, {
      labels: rows.map(r => r.label), height: 280, format: cur,
      series: [
        { name: 'Actual', color: '#0f9d58', data: bal },
        { name: `Forecast · ${Data.scenarios[state.scenario].label}`, color: '#1a73e8', dashed: true, data: bal },
        { name: 'Minimum cash policy', color: '#d93025', dashed: true, data: rows.map(() => conv(Data.minCash)) }
      ]
    });
    splitActual(host, 3, rows);
  }

  function splitActual(host, k, rows) {
    const svg = $('svg', host), [area, actual, projected] = $$('path', svg);
    const points = d => d.replace(/[MZ]/g, '').split('L');
    const all = points(actual.getAttribute('d')), xs = all.map(p => Number(p.split(',')[0]));
    const floor = points(area.getAttribute('d')).at(-1).split(',')[1];
    const head = all.slice(0, k + 1).join('L');
    actual.setAttribute('d', `M${head}`);
    area.setAttribute('d', `M${head}L${xs[k]},${floor}L${xs[0]},${floor}Z`);
    projected.setAttribute('d', `M${all.slice(k).join('L')}`);
    const cursor = $('line[stroke-dasharray="3 3"]', svg), tip = $('.tip', host);
    const NS = 'http://www.w3.org/2000/svg';
    const mark = document.createElementNS(NS, 'line');
    [['x1', xs[k]], ['x2', xs[k]], ['y1', cursor.getAttribute('y1')], ['y2', cursor.getAttribute('y2')], ['stroke', '#9aa0a6']].forEach(([a, v]) => mark.setAttribute(a, v));
    const label = document.createElementNS(NS, 'text');
    [['x', xs[k] + 6], ['y', Number(cursor.getAttribute('y1')) + 10], ['font-size', 11], ['fill', '#5f6368']].forEach(([a, v]) => label.setAttribute(a, v));
    label.textContent = 'Today';
    svg.insertBefore(mark, cursor);
    svg.insertBefore(label, cursor);
    svg.addEventListener('mousemove', () => {
      const x = Number(cursor.getAttribute('x1'));
      const i = xs.reduce((b, v, j) => (Math.abs(v - x) < Math.abs(xs[b] - x) ? j : b), 0), r = rows[i];
      tip.innerHTML = `<b>Week of ${r.label}</b> · ${r.type}<br>Balance: ${money(r.balance)}<br>In ${money(r.inflow)} · Out ${money(r.outflow)}`;
    });
  }

  function drawFlow() {
    const rows = forecast(state.scenario), host = $('#flowBars');
    const out = state.flow === 'out', palette = out ? ['#b3261e', '#f28b82'] : ['#0b7a43', '#5bb98c'];
    const value = { net: r => r.net, in: r => r.inflow, out: r => r.outflow }[state.flow];
    const data = rows.map(r => conv(value(r)));
    Kit.bars(host, { labels: rows.map(r => r.short), data, height: 240, format: v => `${v < 0 ? '−' : ''}${cur(Math.abs(v))}`, colors: data.map((v, i) => (v < 0 ? '#d93025' : palette[rows[i].actual ? 0 : 1])) });
    host.insertAdjacentHTML('beforeend', `<div class="legend"><span><i style="background:${palette[0]}"></i>Actual</span><span><i style="background:${palette[1]}"></i>Forecast</span>${state.flow === 'net' ? '<span><i style="background:#d93025"></i>Net cash out</span>' : ''}</div>`);
  }

  function setScenario(key) {
    state.scenario = key;
    $$('#scenario button').forEach(b => { b.classList.toggle('on', b.dataset.s === key); b.setAttribute('aria-pressed', b.dataset.s === key); });
    renderCash();
    if ($('#cashflow').classList.contains('on')) { drawForecast(); drawFlow(); }
  }
  seg('#scenario', d => { setScenario(d.s); Kit.toast(`Forecast recalculated: ${Data.scenarios[d.s].label} scenario`); });
  seg('#flowMode', d => { state.flow = d.m; drawFlow(); });

  let arTbl;
  function renderAR() {
    const open = Data.invoices.filter(i => i.status !== 'Paid'), overdue = open.filter(i => i.status === 'Overdue');
    const dso = sum(open) / sum(Data.months.slice(-3), 'revenue') * 90;
    const collected = Data.invoices.filter(i => i.paidOn && Data.daysFrom(i.paidOn) <= 30);
    kpis($('#arKpis'), 'a', [
      { label: 'Outstanding', icon: 'doc', value: conv(sum(open)), f: cur, foot: note(`${open.length} open invoices`) },
      { label: 'Overdue', icon: 'alert', value: conv(sum(overdue)), f: cur, foot: note(`${overdue.length} invoices past due`, overdue.length ? 'down' : 'up') },
      { label: 'Days sales outstanding', icon: 'clock', value: dso, f: v => `${v.toFixed(0)} days`, foot: note('Target: 35 days', dso <= 35 ? 'up' : 'down') },
      { label: 'Collected · 30 days', icon: 'check', value: conv(sum(collected)), f: cur, foot: note(`${collected.length} payments received`, 'up') }
    ]);
    renderAgingList();
    if (arTbl) { arTbl.refresh(Data.invoices); return; }
    arTbl = Kit.table($('#arTable'), {
      columns: [
        { key: 'id', label: 'Invoice', render: v => `<span class="mono">${v}</span>` },
        { key: 'customer', label: 'Customer', render: (v, r) => `<b>${esc(v)}</b>${r.reminders ? `<span class="sub">${r.reminders} reminder${r.reminders > 1 ? 's' : ''} sent</span>` : ''}` },
        { key: 'issue', label: 'Issued', render: date },
        { key: 'due', label: 'Due', render: (v, r) => `${date(v)}${r.status === 'Overdue' ? `<span class="late">${Data.daysFrom(v)} days late</span>` : ''}` },
        { key: 'amount', label: 'Amount', num: true, render: money },
        { key: 'status', label: 'Status', render: badge }
      ],
      rows: Data.invoices, pageSize: 10,
      filters: [{ label: 'Status', key: 'status', options: ['Paid', 'Open', 'Overdue'] }, { label: 'Customer', key: 'customer', options: [...Data.customers].sort() }],
      onRow: openInvoice
    });
  }

  const aging = () => {
    const open = Data.invoices.filter(i => i.status !== 'Paid');
    return BUCKETS.map(([label, lo, hi, color]) => {
      const list = open.filter(i => { const d = Data.daysFrom(i.issue); return d >= lo && d <= hi; });
      return { label, color, count: list.length, total: sum(list) };
    });
  };
  function drawAging() {
    const a = aging(), host = $('#agingBars');
    if (!a.some(b => b.total)) { host.innerHTML = '<p class="empty">Nothing outstanding.</p>'; return; }
    Kit.bars(host, { labels: a.map(b => b.label), data: a.map(b => conv(b.total)), colors: a.map(b => b.color), format: cur, height: 200 });
  }
  function renderAgingList() {
    const a = aging(), total = sum(a, 'total') || 1;
    $('#agingList').innerHTML = a.map(b => `<div class="li"><span class="ic" style="background:${b.color}1f;color:${b.color}">${icon('clock')}</span><div class="grow"><b>${b.label} days</b><small>${b.count} invoice${b.count === 1 ? '' : 's'} · ${(b.total / total * 100).toFixed(0)}% of open balance</small></div><span class="amt">${money(b.total)}</span></div>`).join('');
  }

  function openInvoice(inv) {
    const late = inv.status === 'Overdue' ? Data.daysFrom(inv.due) : 0;
    const parts = inv.memo ? [[inv.memo, 1]] : [['Industrial sensor units', 0.68], ['Installation & calibration', 0.22], ['Support plan · 12 months', 0.1]];
    const lines = parts.map(([d, s]) => [d, Math.round(inv.amount * s)]);
    lines[lines.length - 1][1] += inv.amount - sum(lines.map(l => ({ amount: l[1] })));
    const events = [
      [inv.issue, `Invoice issued and emailed to ${inv.email}`],
      ...(inv.lastReminder ? [[inv.lastReminder, `Reminder ${inv.reminders > 1 ? `#${inv.reminders} ` : ''}sent`]] : []),
      ...(inv.paidOn ? [[inv.paidOn, `Payment received · ${money(inv.amount)}`]] : [])
    ];
    const body = `<div class="facts">
        <div><small>Customer</small><b>${esc(inv.customer)}</b></div>
        <div><small>Status</small>${badge(inv.status)}${late ? ` <span class="down" style="font-size:12.5px;font-weight:600">${late} days late</span>` : ''}</div>
        <div><small>Billing contact</small><span class="mono">${inv.email}</span></div>
        <div><small>Payment terms</small><span>Net ${inv.terms}</span></div>
        <div><small>Issued</small><span>${date(inv.issue)}</span></div>
        <div><small>Due</small><span>${date(inv.due)}</span></div>
      </div>
      <table class="items"><thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
        <tbody>${lines.map(([d, v]) => `<tr><td>${esc(d)}</td><td class="num">${money(v)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${money(inv.amount)}</td></tr></tfoot></table>
      <div class="timeline">${events.map(([d, t]) => `<div><i></i><span><b>${date(d)}</b> · ${t}</span></div>`).join('')}</div>`;
    Kit.openModal({
      title: `Invoice ${inv.id}`, body,
      actions: inv.status === 'Paid' ? [{ label: 'Close', primary: true }] : [
        { label: 'Send reminder', onClick: () => { inv.reminders += 1; inv.lastReminder = todayIso; arTbl.refresh(Data.invoices); Kit.toast(`Reminder sent to ${inv.email}`); } },
        { label: 'Mark as paid', primary: true, onClick: () => { inv.status = 'Paid'; inv.paidOn = todayIso; Data.banks[0].balance += inv.amount; refreshAll(); Kit.toast(`${inv.id} marked as paid · ${money(inv.amount)}`); } }
      ]
    });
  }

  function newInvoice() {
    Kit.openModal({
      title: 'New invoice',
      body: `<form class="form" id="invForm">
        <label>Customer<select name="customer">${Data.customers.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
        <label>Amount (${state.cur})<input name="amount" type="number" min="1" step="0.01" required placeholder="e.g. 45000"></label>
        <div class="grid g2" style="gap:14px"><label>Issue date<input name="issue" type="date" value="${todayIso}" max="${todayIso}"></label>
        <label>Payment terms<select name="terms"><option value="30">Net 30</option><option value="45">Net 45</option><option value="60">Net 60</option></select></label></div>
        <label>Description<input name="memo" placeholder="e.g. Sensor units, batch 12"></label></form>`,
      actions: [{ label: 'Cancel' }, { label: 'Create invoice', primary: true, onClick: m => {
        const f = new FormData($('#invForm', m)), amount = Number(f.get('amount'));
        if (!(amount > 0)) { $('[name=amount]', m).focus(); return false; }
        const issue = f.get('issue') || todayIso, terms = Number(f.get('terms')), customer = f.get('customer');
        const due = Data.iso(Data.addDays(Data.parse(issue), terms));
        const next = Math.max(...Data.invoices.map(i => Number(i.id.slice(4)))) + 1;
        const inv = { id: `INV-${String(next).padStart(5, '0')}`, customer, email: Data.emailFor(customer), issue, due, terms, amount: Math.round(amount / rate()), status: due < todayIso ? 'Overdue' : 'Open', paidOn: null, reminders: 0, lastReminder: null, memo: f.get('memo').trim() };
        Data.invoices.unshift(inv);
        nav.go('receivables');
        setFilter('#arTable', 0, ''); setFilter('#arTable', 1, ''); tableSearch('#arTable', '');
        refreshAll();
        Kit.toast(`${inv.id} created for ${esc(customer)}`);
      } }]
    });
  }
  $$('[data-new-invoice]').forEach(b => b.addEventListener('click', newInvoice));

  let apTbl;
  function renderAP() {
    $('#apFlow').innerHTML = STAGES.map(s => {
      const list = Data.bills.filter(b => b.status === s);
      return `<li><button data-stage="${s}" class="${state.apStage === s ? 'on' : ''}" aria-pressed="${state.apStage === s}"><span class="st">${s}</span><div class="n">${list.length}</div><small>${money(sum(list))}</small></button></li>`;
    }).join('');
    if (apTbl) { apTbl.refresh(Data.bills); return; }
    apTbl = Kit.table($('#apTable'), {
      columns: [
        { key: 'id', label: 'Bill', render: v => `<span class="mono">${v}</span>` },
        { key: 'vendor', label: 'Vendor', render: (v, r) => `<b>${esc(v)}</b><span class="sub">${r.category}</span>` },
        { key: 'dept', label: 'Department' },
        { key: 'due', label: 'Due', render: (v, r) => `${date(v)}${r.status !== 'Paid' ? `<span class="sub">${until(v)}</span>` : ''}` },
        { key: 'amount', label: 'Amount', num: true, render: money },
        { key: 'status', label: 'Status', render: badge },
        { key: 'payDate', label: 'Payment date', render: (v, r) => (v ? `${date(v)}${r.status === 'Scheduled' ? '<span class="sub">scheduled</span>' : ''}` : '<span class="muted">—</span>') }
      ],
      rows: Data.bills, pageSize: 10,
      filters: [{ label: 'Status', key: 'status', options: STAGES }, { label: 'Department', key: 'dept', options: [...new Set(Data.vendors.map(v => v.dept))].sort() }],
      onRow: openBill
    });
  }
  $('#apFlow').addEventListener('click', e => { const b = e.target.closest('[data-stage]'); if (b) setFilter('#apTable', 0, state.apStage === b.dataset.stage ? '' : b.dataset.stage); });
  $('#apTable').addEventListener('change', e => {
    if (!e.target.matches('select[data-f="0"]')) return;
    state.apStage = e.target.value;
    $$('#apFlow button').forEach(b => { b.classList.toggle('on', b.dataset.stage === state.apStage); b.setAttribute('aria-pressed', b.dataset.stage === state.apStage); });
  });

  function openBill(b) {
    const idx = STAGES.indexOf(b.status), paid = b.status === 'Paid';
    const steps = `<ol class="steps" aria-label="Approval workflow">${STAGES.map((s, i) => `<li class="${i < idx || paid ? 'done' : i === idx ? 'now' : ''}"${i === idx ? ' aria-current="step"' : ''}>${s}</li>`).join('')}</ol>`;
    const facts = `<div class="facts">
        <div><small>Vendor</small><b>${esc(b.vendor)}</b></div>
        <div><small>Amount</small><b>${money(b.amount)}</b></div>
        <div><small>Category</small><span>${b.category}</span></div>
        <div><small>Department</small><span>${b.dept}</span></div>
        <div><small>Received</small><span>${date(b.received)}</span></div>
        <div><small>Due</small><span>${date(b.due)} · ${until(b.due)}</span></div>
        <div><small>Approved by</small><span>${b.approver || '—'}</span></div>
        <div><small>Payment date</small><span>${date(b.payDate)}${b.bank ? ` · ${esc(b.bank)}` : ''}</span></div>
      </div>`;
    let extra = '', actions = [{ label: 'Close', primary: true }];
    if (b.status === 'Pending approval') {
      const cfo = policy('cfo'), ctrl = policy('ctrl'), board = policy('board');
      if (board.on && b.amount > board.limit) extra = `<div class="note">${icon('alert')}Above ${money(board.limit)}: board sign-off is required before payment.</div>`;
      else if (cfo.on && b.amount > cfo.limit) extra = `<div class="note">${icon('shield')}Above ${money(cfo.limit)}: CFO approval required. You are signed in as CFO.</div>`;
      else if (ctrl.on && b.amount <= ctrl.limit) extra = `<div class="note info">${icon('check')}Within the controller limit of ${money(ctrl.limit)}.</div>`;
      if (policy('auto').on) extra += `<div class="note info">${icon('calendar')}Auto-schedule is on: payment will be scheduled for the due date.</div>`;
      actions = [{ label: 'Cancel' }, { label: 'Approve', primary: true, onClick: () => {
        b.status = 'Approved'; b.approver = 'Marcus Oliveira (CFO)';
        if (policy('auto').on) { b.status = 'Scheduled'; b.payDate = b.due < todayIso ? todayIso : b.due; b.bank = Data.banks[0].name; }
        refreshAll();
        Kit.toast(b.status === 'Scheduled' ? `${b.id} approved and scheduled for ${date(b.payDate)}` : `${b.id} approved · ${money(b.amount)}`);
      } }];
    } else if (b.status === 'Approved') {
      const def = b.due < todayIso ? todayIso : b.due;
      extra = `<form class="form" id="schedForm" style="margin-top:18px">
        <label>Payment date<input type="date" name="date" min="${todayIso}" value="${def}" required></label>
        <label>Pay from<select name="bank">${Data.banks.filter(x => x.status === 'Connected').map(x => `<option value="${esc(x.name)}">${esc(x.name)} · ${x.account} ••${x.mask}</option>`).join('')}</select></label></form>`;
      actions = [{ label: 'Cancel' }, { label: 'Schedule payment', primary: true, onClick: m => {
        const input = $('[name=date]', m), v = input.value;
        if (!v || v < todayIso) { input.focus(); Kit.toast('Choose a payment date from today onwards'); return false; }
        b.status = 'Scheduled'; b.payDate = v; b.bank = $('[name=bank]', m).value;
        refreshAll();
        Kit.toast(`Payment of ${money(b.amount)} to ${esc(b.vendor)} scheduled for ${date(v)}`);
      } }];
    } else if (b.status === 'Scheduled') {
      actions = [{ label: 'Cancel' }, { label: 'Mark as paid', primary: true, onClick: () => {
        const bank = Data.banks.find(x => x.name === b.bank) || Data.banks[0];
        bank.balance -= b.amount; b.status = 'Paid'; b.payDate = todayIso;
        refreshAll();
        Kit.toast(`${b.id} paid from ${esc(bank.name)}`);
      } }];
    }
    Kit.openModal({ title: `Bill ${b.id}`, body: steps + facts + extra, actions });
  }

  const deptStatus = d => { const u = d.actual / d.budget; return u > 1 ? 'Over budget' : u >= 0.9 ? 'At risk' : 'On track'; };
  const fiscal = (year, month) => {
    const s = state.fyStart, q = Math.floor(((month - s + 12) % 12) / 3) + 1, fy = s === 0 || month < s ? year : year + 1;
    return `Q${q} FY${String(fy).slice(2)}`;
  };

  function renderBudgets() {
    const q = Data.qStart, end = new Date(q.getFullYear(), q.getMonth() + 3, 0);
    $('#budgetSub').textContent = `${fiscal(q.getFullYear(), q.getMonth())} to date (${dateShort(Data.iso(q))} – ${date(Data.iso(end))}): actual spend plus committed purchase orders.`;
    const budget = sum(Data.departments, 'budget'), actual = sum(Data.departments, 'actual');
    const over = Data.departments.filter(d => d.actual > d.budget);
    kpis($('#budgetKpis'), 'b', [
      { label: 'Quarter budget', icon: 'wallet', value: conv(budget), f: cur, foot: note(`${Data.departments.length} departments`) },
      { label: 'Actual + committed', icon: 'chart', value: conv(actual), f: cur, foot: note(`${(actual / budget * 100).toFixed(1)}% of budget used`, actual > budget ? 'down' : 'up') },
      { label: 'Departments over budget', icon: 'alert', value: over.length, f: v => fmt.num(v), foot: note(over.length ? `${money(sum(over.map(d => ({ amount: d.actual - d.budget }))))} above plan` : 'All within budget', over.length ? 'down' : 'up') }
    ]);
    $('#deptList').innerHTML = Data.departments.map((d, i) => {
      const u = d.actual / d.budget * 100, st = deptStatus(d), left = d.budget - d.actual;
      return `<div class="dept"><div><b>${d.name}</b><span class="sub">Owner: ${esc(d.owner)}</span></div>
        <div class="meta"><b class="${u > 100 ? 'down' : ''}">${u.toFixed(0)}%</b>${badge(st)}<button class="btn sm" data-edit="${i}" aria-label="Edit ${d.name} budget">Edit</button></div>
        <div class="track"><div class="bar" role="progressbar" aria-label="${d.name} budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(u)}"><i class="${u > 100 ? 'over' : u >= 90 ? 'risk' : ''}" style="width:${Math.min(100, u)}%"></i></div></div>
        <div class="nums"><span>${money(d.actual)} of ${money(d.budget)}</span><span class="${left < 0 ? 'down' : ''}">${left < 0 ? `${money(-left)} over` : `${money(left)} left`}</span></div></div>`;
    }).join('');
  }
  $('#deptList').addEventListener('click', e => { const b = e.target.closest('[data-edit]'); if (b) editBudget(Data.departments[Number(b.dataset.edit)]); });

  function drawBudgetBars() {
    const u = Data.departments.map(d => d.actual / d.budget * 100);
    Kit.bars($('#budgetBars'), { labels: Data.departments.map(d => d.code), data: u, height: 260, format: v => `${v.toFixed(0)}%`, colors: u.map(v => (v > 100 ? '#d93025' : v >= 90 ? '#f29900' : '#0f9d58')) });
    $('#budgetBars').insertAdjacentHTML('beforeend', `<div class="legend">${Data.departments.map(d => `<span><b>${d.code}</b>&nbsp;${d.name}</span>`).join('')}</div>`);
  }

  function editBudget(d) {
    Kit.openModal({
      title: `Edit budget · ${d.name}`,
      body: `<form class="form" id="budForm">
        <label>Quarter budget (${state.cur})<input name="budget" type="number" min="1" step="1000" value="${Math.round(conv(d.budget))}" required></label>
        <label>Budget owner<input name="owner" value="${esc(d.owner)}"></label>
        <label>Reason for change<textarea name="reason" placeholder="e.g. Approved headcount increase"></textarea></label></form>
        <div class="note info">${icon('chart')}Spent and committed so far: ${money(d.actual)} (${(d.actual / d.budget * 100).toFixed(0)}% of the current budget).</div>`,
      actions: [{ label: 'Cancel' }, { label: 'Save budget', primary: true, onClick: m => {
        const f = new FormData($('#budForm', m)), v = Number(f.get('budget'));
        if (!(v > 0)) { $('[name=budget]', m).focus(); return false; }
        d.budget = Math.round(v / rate());
        d.owner = f.get('owner').trim() || d.owner;
        refreshAll();
        Kit.toast(`${d.name} budget set to ${money(d.budget)} · ${(d.actual / d.budget * 100).toFixed(0)}% used`);
      } }]
    });
  }

  const LINES = [
    ['Product revenue', 'product', 'ind', 1], ['Services revenue', 'services', 'ind', 1], ['Total revenue', 'revenue', 'subtotal', 1],
    ['Cost of goods sold', 'cogs', 'ind', -1], ['Gross profit', 'gross', 'subtotal', 1], ['Gross margin', 'gross', 'ratio'],
    ['Research & development', 'rd', 'ind', -1], ['Sales & marketing', 'sm', 'ind', -1], ['General & administrative', 'ga', 'ind', -1], ['Total operating expenses', 'opex', 'subtotal', -1],
    ['EBITDA', 'ebitda', 'subtotal', 1], ['EBITDA margin', 'ebitda', 'ratio'],
    ['Depreciation & amortization', 'da', 'ind', -1], ['Interest expense', 'interest', 'ind', -1], ['Income tax', 'tax', 'ind', -1],
    ['Net income', 'net', 'total', 1], ['Net margin', 'net', 'ratio']
  ];

  function quarters() {
    const groups = [];
    Data.months.forEach(m => {
      const label = fiscal(m.year, m.month);
      if (groups.at(-1)?.label !== label) groups.push({ label, months: [] });
      groups.at(-1).months.push(m);
    });
    return groups.filter(g => g.months.length === 3).slice(-4).map(g => {
      const [a, , c] = g.months, name = m => Data.parse(m.key).toLocaleDateString('en-US', { month: 'short' });
      return { ...g, range: `${name(a)}–${name(c)} ${c.year}`, p: Data.pnl(g.months) };
    });
  }

  function statement() {
    const qs = quarters(), now = qs[state.quarter], prev = qs[state.quarter - 1];
    const rows = LINES.map(([label, key, kind, sign]) => {
      if (kind === 'ratio') {
        const a = now.p[key] / now.p.revenue * 100, b = prev.p[key] / prev.p.revenue * 100;
        return { label, kind, a, b, change: a - b, good: a >= b };
      }
      const a = now.p[key] * sign, b = prev.p[key] * sign, change = (now.p[key] - prev.p[key]) / Math.abs(prev.p[key]) * 100;
      return { label, kind, a, b, change, good: sign < 0 ? change <= 0 : change >= 0, share: now.p[key] / now.p.revenue * 100 };
    });
    return { qs, now, prev, rows };
  }

  const acc = v => (v < 0 ? `(${money(-v)})` : money(v));

  function renderReports() {
    const { qs, now, prev, rows } = statement();
    $('#quarterSeg').innerHTML = qs.slice(1).map((q, i) => `<button data-q="${i + 1}" class="${i + 1 === state.quarter ? 'on' : ''}" aria-pressed="${i + 1 === state.quarter}">${q.label}</button>`).join('');
    const pct = (a, b) => (a - b) / Math.abs(b) * 100;
    kpis($('#pnlKpis'), 'p', [
      { label: 'Revenue', icon: 'chart', value: conv(now.p.revenue), f: cur, foot: delta(pct(now.p.revenue, prev.p.revenue), false, '%', `vs ${prev.label}`) },
      { label: 'Gross margin', icon: 'spark', value: now.p.gross / now.p.revenue * 100, f: v => fmt.pct(v), foot: delta((now.p.gross / now.p.revenue - prev.p.gross / prev.p.revenue) * 100, false, ' pts', `vs ${prev.label}`) },
      { label: 'EBITDA', icon: 'wallet', value: conv(now.p.ebitda), f: cur, foot: delta(pct(now.p.ebitda, prev.p.ebitda), false, '%', `vs ${prev.label}`) },
      { label: 'Net income', icon: 'bank', value: conv(now.p.net), f: cur, foot: delta(pct(now.p.net, prev.p.net), false, '%', `vs ${prev.label}`) }
    ]);
    $('#pnlTitle').innerHTML = `Statement · ${now.label} <small>${now.range} · ${state.cur}</small>`;
    $('#pnl').innerHTML = `<thead><tr><th>Line</th><th class="num">${now.label}</th><th class="num">${prev.label}</th><th class="num">Change</th><th class="num">% of revenue</th></tr></thead>
      <tbody>${rows.map(r => r.kind === 'ratio'
        ? `<tr class="ratio"><td class="ind">${r.label}</td><td class="num">${fmt.pct(r.a)}</td><td class="num">${fmt.pct(r.b)}</td><td class="num ${r.good ? 'up' : 'down'}">${r.change >= 0 ? '+' : '−'}${Math.abs(r.change).toFixed(1)} pts</td><td class="num"></td></tr>`
        : `<tr class="${r.kind}"><td class="${r.kind === 'ind' ? 'ind' : ''}">${r.label}</td><td class="num">${acc(r.a)}</td><td class="num">${acc(r.b)}</td><td class="num ${r.good ? 'up' : 'down'}">${r.change >= 0 ? '▲' : '▼'} ${Math.abs(r.change).toFixed(1)}%</td><td class="num">${fmt.pct(Math.abs(r.share))}</td></tr>`).join('')}</tbody>`;
  }
  seg('#quarterSeg', d => { state.quarter = Number(d.q); renderReports(); });

  function drawReports() {
    const hist = Data.months.slice(-12), p = hist.map(m => Data.pnl([m]));
    Kit.bars($('#ebitdaBars'), { labels: hist.map(m => m.label), data: p.map(x => conv(x.ebitda)), height: 220, format: cur, color: '#0f9d58' });
    Kit.line($('#marginChart'), {
      labels: hist.map(m => m.label), height: 220, area: false, format: v => fmt.pct(v),
      series: [
        { name: 'Gross margin', color: '#0f9d58', data: p.map(x => x.gross / x.revenue * 100) },
        { name: 'EBITDA margin', color: '#1a73e8', data: p.map(x => x.ebitda / x.revenue * 100) },
        { name: 'Net margin', color: '#a142f4', data: p.map(x => x.net / x.revenue * 100) }
      ]
    });
  }

  $('#exportPnl').addEventListener('click', () => {
    const { now, prev, rows } = statement();
    const cell = v => `"${String(v).replace(/"/g, '""')}"`;
    const num = (r, v) => (r.kind === 'ratio' ? v.toFixed(2) : Math.round(conv(v)));
    const csv = [
      ['Harlow & Pike Industries', `Profit and loss ${now.label} (${now.range})`, `Currency ${state.cur}`].map(cell).join(','),
      ['Line', now.label, prev.label, 'Change %', '% of revenue'].map(cell).join(','),
      ...rows.map(r => [r.label, num(r, r.a), num(r, r.b), r.change.toFixed(2), r.share == null ? '' : Math.abs(r.share).toFixed(2)].map(cell).join(','))
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `ledgerly-pnl-${now.label.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    Kit.toast(`P&L ${now.label} exported as CSV`);
  });

  function renderSettings() {
    $('#bankTotal').textContent = `${money(cashTotal())} total`;
    $('#banks').innerHTML = Data.banks.map((b, i) => `<div class="li"><span class="bank-logo" style="background:${b.color}">${b.short}</span><div class="grow"><b>${esc(b.name)}</b><small>${esc(b.account)} · ${b.type} · ••${b.mask} · synced ${b.synced}</small></div><div class="side-r"><span class="amt">${money(b.balance)}</span>${badge(b.status)}</div><button class="icon-btn" data-sync="${i}" aria-label="Sync ${esc(b.name)}">${icon('swap')}</button></div>`).join('');
    $('#currency').value = state.cur;
    $('#fyStart').value = String(state.fyStart);
    $('#minCash').value = Math.round(conv(Data.minCash));
    $('#policies').innerHTML = state.policies.map((p, i) => {
      const text = p.limit ? `${p.label} ${money(p.limit)}` : p.label;
      return `<div class="li"><span class="ic">${icon(p.limit ? 'shield' : p.key === 'auto' ? 'calendar' : 'users')}</span><div class="grow"><b>${text}</b></div><button class="switch ${p.on ? 'on' : ''}" role="switch" aria-checked="${p.on}" aria-label="${text}" data-p="${i}"></button></div>`;
    }).join('');
  }

  $('#banks').addEventListener('click', e => {
    const btn = e.target.closest('[data-sync]');
    if (!btn) return;
    const b = Data.banks[Number(btn.dataset.sync)];
    btn.classList.add('spin'); btn.disabled = true;
    setTimeout(() => { b.synced = 'just now'; renderSettings(); Kit.toast(`${esc(b.name)} synced · balance ${money(b.balance)}`); }, 900);
  });

  $('#connectBank').addEventListener('click', () => {
    const options = Data.availableBanks.filter(n => !Data.banks.some(b => b.name === n));
    if (!options.length) { Kit.toast('All available banks are already connected'); return; }
    Kit.openModal({
      title: 'Connect a bank account',
      body: `<form class="form" id="bankForm">
        <label>Bank<select name="bank">${options.map(n => `<option>${n}</option>`).join('')}</select></label>
        <label>Account nickname<input name="account" placeholder="e.g. Treasury" required></label>
        <label>Account type<select name="type"><option>Checking</option><option>Savings</option><option>Multi-currency</option></select></label></form>
        <div class="note info">${icon('lock')}Demo only: no credentials are requested and no real bank is contacted.</div>`,
      actions: [{ label: 'Cancel' }, { label: 'Connect', primary: true, onClick: m => {
        const f = new FormData($('#bankForm', m)), account = f.get('account').trim();
        if (!account) { $('[name=account]', m).focus(); return false; }
        const name = f.get('bank');
        const bank = { name, short: name.split(' ').slice(0, 2).map(w => w[0]).join(''), color: '#12b5cb', account, mask: String(1000 + Data.banks.length * 1373 % 9000), type: f.get('type'), balance: 0, synced: 'never', status: 'Syncing' };
        Data.banks.push(bank);
        renderSettings();
        Kit.toast(`Connecting to ${name}…`);
        setTimeout(() => { bank.status = 'Connected'; bank.synced = 'just now'; bank.balance = 250000 + Data.banks.length * 12500; refreshAll(); Kit.toast(`${name} connected · ${money(bank.balance)} imported`); }, 1600);
      } }]
    });
  });

  $('#policies').addEventListener('click', e => {
    const s = e.target.closest('.switch');
    if (!s) return;
    const p = state.policies[Number(s.dataset.p)];
    p.on = !p.on;
    s.classList.toggle('on', p.on); s.setAttribute('aria-checked', p.on);
    Kit.toast(`${s.getAttribute('aria-label')}: ${p.on ? 'on' : 'off'}`);
  });
  $('#prefs').addEventListener('submit', e => e.preventDefault());
  $('#currency').addEventListener('change', e => { state.cur = e.target.value; refreshAll(); Kit.toast(`Reporting currency set to ${state.cur}`); });
  $('#fyStart').addEventListener('change', e => { state.fyStart = Number(e.target.value); refreshAll(); Kit.toast(`Fiscal year now starts in ${e.target.selectedOptions[0].text}`); });
  $('#minCash').addEventListener('change', e => {
    const v = Number(e.target.value);
    if (!(v >= 0)) { e.target.value = Math.round(conv(Data.minCash)); return; }
    Data.minCash = v / rate();
    refreshAll();
    Kit.toast(`Minimum cash policy set to ${money(Data.minCash)}`);
  });

  $('#q').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const raw = e.target.value.trim(), term = raw.toLowerCase();
    if (!term) return;
    const has = s => s.toLowerCase().includes(term);
    const inv = Data.invoices.find(i => has(i.id));
    if (inv) { nav.go('receivables'); openInvoice(inv); return; }
    const customer = Data.customers.find(has);
    if (customer) { nav.go('receivables'); setFilter('#arTable', 0, ''); tableSearch('#arTable', customer); Kit.toast(`Showing invoices for ${esc(customer)}`); return; }
    const bill = Data.bills.find(b => has(b.id));
    if (bill) { nav.go('payables'); openBill(bill); return; }
    const vendor = Data.vendors.find(v => has(v.name));
    if (vendor) { nav.go('payables'); setFilter('#apTable', 0, ''); tableSearch('#apTable', vendor.name); Kit.toast(`Showing bills from ${esc(vendor.name)}`); return; }
    const dept = Data.departments.find(d => has(d.name));
    if (dept) { nav.go('budgets'); editBudget(dept); return; }
    Kit.toast(`No results for "${esc(raw)}"`);
  });

  const drawers = {
    overview: () => { drawRevenue(); drawDonut(); },
    cashflow: () => { drawForecast(); drawFlow(); },
    receivables: drawAging,
    budgets: drawBudgetBars,
    reports: drawReports
  };
  const drawCurrent = () => drawers[$('.view.on')?.id]?.();

  function refreshAll() {
    renderOverview(); renderCash(); renderAR(); renderAP(); renderBudgets(); renderReports(); renderSettings();
    updateBadges();
    drawCurrent();
  }

  document.addEventListener('view', e => drawers[e.detail]?.());
  let lastW = window.innerWidth, timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; drawCurrent(); } }, 200);
  });

  refreshAll();
})();
