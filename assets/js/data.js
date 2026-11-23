const Data = (() => {
  const rnd = Kit.rng(2026);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + rnd() * (b - a);
  const round = (v, step = 10) => Math.round(v / step) * step;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => new Date(`${s}T00:00:00`);
  const daysFrom = s => Math.round((today - parse(s)) / 86400000);

  const months = Array.from({ length: 18 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 18 + i, 1);
    const season = 1 + Math.sin(((d.getMonth() + 2) / 12) * Math.PI * 2) * 0.035;
    const revenue = round(3900000 * (1 + i * 0.011) * season * between(0.965, 1.035), 1000);
    const cogs = round(revenue * between(0.36, 0.395), 1000);
    const rd = round(between(700000, 790000) * (1 + i * 0.006), 1000);
    const sm = round(revenue * between(0.14, 0.165), 1000);
    const ga = round(between(360000, 415000), 1000);
    return {
      key: iso(d), year: d.getFullYear(), month: d.getMonth(),
      label: d.toLocaleDateString('en-US', { month: 'short' }) + (d.getMonth() === 0 ? ` '${String(d.getFullYear()).slice(2)}` : ''),
      revenue, services: round(revenue * between(0.25, 0.3), 1000), cogs, rd, sm, ga, expenses: cogs + rd + sm + ga
    };
  });

  const pnl = list => {
    const sum = k => list.reduce((a, m) => a + m[k], 0);
    const revenue = sum('revenue'), services = sum('services'), cogs = sum('cogs');
    const rd = sum('rd'), sm = sum('sm'), ga = sum('ga');
    const gross = revenue - cogs, opex = rd + sm + ga, ebitda = gross - opex;
    const da = 95000 * list.length, interest = 28000 * list.length;
    const ebt = ebitda - da - interest, tax = Math.max(0, Math.round(ebt * 0.24));
    return { revenue, product: revenue - services, services, cogs, gross, rd, sm, ga, opex, ebitda, da, interest, ebt, tax, net: ebt - tax };
  };

  const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const frac = today.getDate() / dim;
  const last = months.at(-1);
  const mtd = {
    revenue: round(last.revenue * 1.034 * frac, 100),
    expenses: round(last.expenses * 1.012 * frac, 100),
    prevRevenue: round(last.revenue * frac, 100),
    prevExpenses: round(last.expenses * frac, 100),
    frac
  };

  const expenseCats = [
    ['Payroll & benefits', 0.46, '#0f9d58'],
    ['Cloud & software', 0.14, '#1a73e8'],
    ['Marketing', 0.12, '#a142f4'],
    ['Rent & facilities', 0.09, '#f29900'],
    ['Professional services', 0.07, '#e8710a'],
    ['Travel', 0.05, '#12b5cb'],
    ['Other', 0.07, '#9aa0a6']
  ].map(([label, share, color]) => ({ label, color, value: round(mtd.expenses * share, 100) }));

  const banks = [
    { name: 'First Meridian Bank', short: 'FM', color: '#0b7a43', account: 'Operating', mask: '4821', type: 'Checking', balance: 5124300, synced: '4 min ago', status: 'Connected' },
    { name: 'Harborline Trust', short: 'HT', color: '#1a73e8', account: 'Payroll', mask: '0937', type: 'Checking', balance: 1478650, synced: '4 min ago', status: 'Connected' },
    { name: 'Summit Ridge Credit Union', short: 'SR', color: '#a142f4', account: 'Reserve', mask: '5512', type: 'Savings', balance: 1652000, synced: '12 min ago', status: 'Connected' },
    { name: 'Pacific Crest Bank', short: 'PC', color: '#e8710a', account: 'EUR collections', mask: '7710', type: 'Multi-currency', balance: 341870, synced: '27 min ago', status: 'Connected' }
  ];
  const availableBanks = ['Bluewater Savings Bank', 'Cordova National Bank', 'Ironbridge Commercial Bank', 'Lakeshore Mutual'];
  const cash = banks.reduce((a, b) => a + b.balance, 0);
  const cashHistory = Array.from({ length: 12 }, (_, i) => round(cash * (0.84 + i * 0.0135 + between(-0.012, 0.012)), 1000));
  cashHistory[11] = cash;

  const customers = ['Brightline Logistics', 'Cobalt Ridge Energy', 'Fernhill Foods', 'Granite Peak Health', 'Harborview Retail Co.', 'Ironleaf Manufacturing', 'Juniper Lane Studios', 'Kestrel Aerospace', 'Lumen Bay Hotels', 'Marlow & Finch Legal', 'Northstar Freight', 'Oakmere Schools', 'Pinecrest Labs', 'Quayside Marine'];
  const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

  const emailFor = c => `ap@${slug(c)}.example`;

  const invoices = Array.from({ length: 62 }, () => {
    const age = Math.floor(between(1, 150));
    const issue = addDays(today, -age);
    const terms = pick([30, 30, 30, 45, 60]);
    const due = addDays(issue, terms);
    const pastDue = due < today;
    const paidChance = pastDue ? (age > 100 ? 0.84 : 0.64) : 0.18;
    const status = rnd() < paidChance ? 'Paid' : pastDue ? 'Overdue' : 'Open';
    const customer = pick(customers);
    const paidOn = status === 'Paid' ? iso(addDays(issue, Math.min(age, Math.floor(between(terms * 0.5, terms + 12))))) : null;
    const reminders = status === 'Overdue' ? Math.floor(between(0, 3)) : 0;
    return {
      id: '', customer, email: emailFor(customer), issue: iso(issue), due: iso(due), terms,
      amount: round(between(18000, 240000)), status, paidOn, reminders,
      lastReminder: reminders ? iso(addDays(today, -Math.floor(between(2, 9)))) : null
    };
  }).sort((a, b) => (a.issue < b.issue ? 1 : -1));
  invoices.forEach((inv, i) => { inv.id = `INV-${String(4862 - i).padStart(5, '0')}`; });

  const vendors = [
    { name: 'Atlas Cloud Hosting', category: 'Cloud & software', dept: 'Engineering', min: 18000, max: 64000 },
    { name: 'Bluefin Office Supply', category: 'Office', dept: 'Operations', min: 900, max: 6400 },
    { name: 'Cedar & Stone Facilities', category: 'Rent & facilities', dept: 'Operations', min: 22000, max: 48000 },
    { name: 'Driftwood Media', category: 'Marketing', dept: 'Marketing', min: 8000, max: 52000 },
    { name: 'Evergreen Insurance Group', category: 'Insurance', dept: 'Finance & legal', min: 12000, max: 30000 },
    { name: 'Foxglove Consulting', category: 'Professional services', dept: 'Finance & legal', min: 9500, max: 38000 },
    { name: 'Gullwing Travel', category: 'Travel', dept: 'Sales', min: 2400, max: 16000 },
    { name: 'Halden Recruiting', category: 'Professional services', dept: 'People', min: 6000, max: 28000 },
    { name: 'Jetstream Telecom', category: 'Cloud & software', dept: 'IT & security', min: 3200, max: 11000 },
    { name: 'Keystone Freight Lines', category: 'Logistics', dept: 'Operations', min: 7000, max: 34000 },
    { name: 'Larkspur Software', category: 'Cloud & software', dept: 'Customer success', min: 4000, max: 19000 }
  ];
  const approvers = ['Dana Whitfield (Controller)', 'Marcus Oliveira (CFO)'];
  const bills = Array.from({ length: 36 }, () => {
    const v = pick(vendors);
    const received = addDays(today, -Math.floor(between(1, 46)));
    const due = addDays(received, pick([15, 30, 30, 45]));
    let status = 'Paid', payDate = iso(addDays(due, -1));
    if (due >= today) {
      const r = rnd();
      status = r < 0.34 ? 'Pending approval' : r < 0.58 ? 'Approved' : r < 0.86 ? 'Scheduled' : 'Paid';
      payDate = status === 'Scheduled' ? iso(addDays(due, -Math.min(2, Math.round((due - today) / 86400000)))) : status === 'Paid' ? iso(addDays(today, -1)) : null;
    }
    return {
      id: '', vendor: v.name, category: v.category, dept: v.dept, received: iso(received), due: iso(due),
      amount: round(between(v.min, v.max)), status, payDate, approver: status === 'Pending approval' ? null : pick(approvers)
    };
  }).sort((a, b) => (a.received < b.received ? 1 : -1));
  bills.forEach((b, i) => { b.id = `BILL-${String(7315 - i)}`; });

  const departments = [
    ['Engineering', 'ENG', 'Priya Raman', 2400000, 0.81],
    ['Sales', 'SAL', 'Tomás Herrera', 1500000, 1.07],
    ['Marketing', 'MKT', 'Elise Lambert', 900000, 1.03],
    ['Operations', 'OPS', 'Kwame Asante', 720000, 0.64],
    ['Customer success', 'CS', 'Hannah Okafor', 460000, 0.92],
    ['Finance & legal', 'FIN', 'Dana Whitfield', 380000, 0.7],
    ['People', 'PPL', 'Lucas Brandt', 310000, 0.68],
    ['IT & security', 'IT', 'Mei Tanaka', 420000, 1.14]
  ].map(([name, code, owner, budget, f]) => ({ name, code, owner, budget, actual: round(budget * f * between(0.99, 1.01), 100) }));

  const qStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);

  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const weeks = Array.from({ length: 17 }, (_, i) => {
    const start = addDays(monday, (i - 3) * 7);
    const end = addDays(start, 6);
    const rent = start.getMonth() !== end.getMonth() || start.getDate() === 1 ? 182000 : 0;
    const payroll = i % 2 === 0 ? 418000 : 0;
    return {
      start: iso(start),
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      short: `${start.getMonth() + 1}/${start.getDate()}`,
      actual: i <= 3,
      inflow: round(985000 * (1 + i * 0.004) * between(0.88, 1.12), 1000),
      outflow: round((618000 + payroll + rent) * between(0.93, 1.07), 1000)
    };
  });

  const scenarios = {
    base: { label: 'Base', inM: 1, outM: 1, notes: [['Collections', 'Follow the last 90-day pattern, average 34 days to pay'], ['Payroll', 'Every other Friday, current headcount'], ['Vendors', 'Approved bills paid on their due date'], ['Financing', 'No draw on the revolving credit line']] },
    conservative: { label: 'Conservative', inM: 0.85, outM: 1.04, notes: [['Collections', '15% slower: two largest customers pay 3 weeks late'], ['Payroll', 'Includes 4 planned hires from week 6'], ['Vendors', 'Cloud costs 8% above plan'], ['Financing', 'Credit line available if cash falls below policy']] },
    optimistic: { label: 'Optimistic', inM: 1.08, outM: 0.97, notes: [['Collections', 'Early-payment discount adopted by 3 key accounts'], ['Payroll', 'Hiring plan unchanged'], ['Vendors', 'Annual SaaS renewals negotiated 6% lower'], ['Financing', 'Excess cash swept to the reserve account']] }
  };

  return { today, iso, parse, daysFrom, addDays, months, pnl, mtd, expenseCats, banks, availableBanks, cashHistory, customers, emailFor, invoices, vendors, bills, departments, qStart, weeks, scenarios, minCash: 8000000 };
})();
