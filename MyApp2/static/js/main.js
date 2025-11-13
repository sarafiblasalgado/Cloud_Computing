async function fetchExpenses() {
  const res = await fetch('/api/expenses');
  return res.json();
}

// Format numbers as Euro currency using user's locale when possible
function formatCurrency(amount) {
  const v = Number(amount) || 0;
  try {
    const locale = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-IE';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(v);
  } catch (e) {
    return '€' + v.toFixed(2);
  }
}

// Fixed categories (used for dropdown and chart colors). pct values are kept for reference but
// the chart now shows spent amounts per category (pct is not used for the spent-only chart).
const ALLOCATIONS = [
  { category: 'Rent', pct: 0.30, color: '#1f77b4' },      // blue
  { category: 'Food', pct: 0.12, color: '#ff7f0e' },      // orange
  { category: 'Transport', pct: 0.08, color: '#16a085' }, // teal (distinct from Remaining green)
  { category: 'Utilities', pct: 0.08, color: '#8c564b' }, // brown
  { category: 'Entertainment', pct: 0.06, color: '#e377c2' }, // pink
  { category: 'Healthcare', pct: 0.05, color: '#7f7f7f' }, // gray
  { category: 'Education', pct: 0.04, color: '#17becf' }, // teal
  { category: 'Subscriptions', pct: 0.04, color: '#bcbd22' }, // olive
  { category: 'Misc', pct: 0.08, color: '#d62728' }       // red
];

let chart = null;

function populateCategorySelect() {
  const sel = document.getElementById('category-select');
  if (!sel) return;
  sel.innerHTML = '';
  ALLOCATIONS.forEach((a, i) => {
    const opt = document.createElement('option');
    opt.value = a.category;
    opt.textContent = a.category;
    opt.dataset.color = a.color;
    sel.appendChild(opt);
  });
  // set swatch initial
  // build custom dropdown UI in parallel
  const optsContainer = document.getElementById('category-options');
  const btnLabel = document.getElementById('category-button-label');
  const btnSwatch = document.getElementById('category-button-swatch');
  if (optsContainer) optsContainer.innerHTML = '';
  ALLOCATIONS.forEach((a, i) => {
    // add to native select already done above
    if (optsContainer) {
      const li = document.createElement('li');
      li.className = 'custom-option';
      li.tabIndex = 0;
      li.dataset.value = a.category;

      // create swatch element explicitly to avoid rendering differences across browsers
      const sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.backgroundColor = a.color;
      // ensure consistent box model
      sw.style.width = '16px';
      sw.style.height = '16px';
      sw.style.display = 'inline-block';
      sw.style.border = '1px solid rgba(0,0,0,0.12)';
      sw.style.borderRadius = '4px';

      const lbl = document.createElement('span');
      lbl.className = 'label';
      lbl.textContent = a.category;

      li.appendChild(sw);
      li.appendChild(lbl);

      li.addEventListener('click', () => {
        sel.value = a.category;
        if (btnLabel) btnLabel.textContent = a.category;
        if (btnSwatch) btnSwatch.style.background = a.color;
        optsContainer.classList.remove('open');
      });
      li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') li.click(); });
      optsContainer.appendChild(li);
    }
  });

  // initialize visible button
  if (sel.options.length && btnLabel && btnSwatch) {
    btnLabel.textContent = sel.options[0].textContent;
    btnSwatch.style.background = sel.options[0].dataset.color;
    sel.value = sel.options[0].value;
  }

  // toggle dropdown
  const dropdownBtn = document.getElementById('category-button');
  const optsEl = document.getElementById('category-options');
  if (dropdownBtn && optsEl) {
    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      optsEl.classList.toggle('open');
    });
    // close when clicking outside
    document.addEventListener('click', () => optsEl.classList.remove('open'));
  }
}

function renderSpentChart(salary, expenses) {
  const labels = ALLOCATIONS.map(a => a.category);

  const budgetMsgEl = document.getElementById('budget-message');
  const canvas = document.getElementById('expenseChart');
  if (!canvas) {
    if (budgetMsgEl) budgetMsgEl.textContent = 'Chart canvas not found in the page.';
    console.error('renderSpentChart: #expenseChart canvas not found');
    return;
  }
  // Quick visual/debug helpers: outline the canvas & wrapper and log sizes so we can tell
  // whether the element exists but has zero size or is hidden by CSS/layout.
  try {
    const wrapper = canvas.parentElement;
    const wrect = wrapper ? wrapper.getBoundingClientRect() : { width: 0, height: 0 };
    let desired = Math.max(0, Math.round(wrect.width));
    // If wrapper width comes back as 0 (collapsed layout), pick a sensible fallback
    if (desired === 0) {
      const parentRect = wrapper && wrapper.parentElement ? wrapper.parentElement.getBoundingClientRect() : null;
      if (parentRect && parentRect.width > 0) {
        desired = Math.min(520, Math.round(parentRect.width));
      } else {
        desired = Math.min(520, Math.max(320, Math.round(window.innerWidth * 0.4)));
      }
      console.warn('renderSpentChart: wrapper width is 0, using fallback', desired);
    }
    console.log('renderSpentChart: wrapper size', wrect.width, 'x', wrect.height, '-> desired canvas', desired);
    // ensure the canvas element has explicit pixel dimensions matching the wrapper
    if (desired > 0) {
      canvas.width = desired;
      canvas.height = desired;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
    }
    // keep a subtle outline while debugging so the area is visible
    canvas.style.outline = '1px dashed rgba(15,23,42,0.06)';
    if (wrapper) wrapper.style.outline = '1px dashed rgba(99,102,241,0.04)';
    if (budgetMsgEl && !budgetMsgEl.textContent) {
      budgetMsgEl.textContent = `Debug: wrapper ${Math.round(wrect.width)}x${Math.round(wrect.height)}`;
      setTimeout(() => { if (budgetMsgEl && budgetMsgEl.textContent && budgetMsgEl.textContent.startsWith('Debug:')) budgetMsgEl.textContent = ''; }, 4000);
    }
  } catch (err) {
    console.warn('renderSpentChart debug helpers failed', err);
  }
  if (typeof Chart === 'undefined') {
    if (budgetMsgEl) budgetMsgEl.textContent = 'Chart.js not loaded. Check network connection or console for errors.';
    console.error('renderSpentChart: Chart is undefined (Chart.js not loaded)');
    return;
  }

  // compute spent per allocation category (case-insensitive matching), others -> Misc
  const spentMap = new Map(labels.map(l => [l.toLowerCase(), 0]));
  for (const e of expenses) {
    const cat = (e.category || 'Misc').toLowerCase();
    const match = labels.find(l => l.toLowerCase() === cat) || 'Misc';
    spentMap.set(match.toLowerCase(), (spentMap.get(match.toLowerCase()) || 0) + Number(e.amount));
  }
  let spentData = labels.map(l => +(spentMap.get(l.toLowerCase()) || 0).toFixed(2));

  const colors = ALLOCATIONS.map(a => a.color);

  // compute total spent and savings (salary - totalSpent)
  const totalSpent = spentData.reduce((s, v) => s + Number(v), 0);
  const savings = +(Number(salary) - totalSpent).toFixed(2);
  // If budget remains, append a Remaining slice; if overspent, show a message
  if (!isNaN(savings)) {
    if (savings >= 0) {
      labels.push('Remaining');
      spentData.push(savings);
      colors.push('#2ca02c'); // green for remaining/savings
      if (budgetMsgEl) budgetMsgEl.textContent = '';
    } else {
      // Do NOT add an Overspent slice to the chart. Instead display a clear message below the chart.
      if (budgetMsgEl) budgetMsgEl.textContent = `Over budget by ${formatCurrency(Math.abs(savings))} — reduce spending or increase income.`;
    }
  }

  const ctx = canvas.getContext('2d');
  const dataObj = {
    labels: labels,
    datasets: [ { data: spentData, backgroundColor: colors, borderColor: '#fff', borderWidth: 1 } ]
  };

  if (chart) {
    chart.data = dataObj;
    chart.update();
    renderLegendSpent(labels, spentData, colors);
    return;
  }

  try {
    chart = new Chart(ctx, {
      type: 'doughnut',
      data: dataObj,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '40%',
        plugins: { legend: { display: false } }
      }
    });
  } catch (err) {
    if (budgetMsgEl) budgetMsgEl.textContent = 'Unable to render chart — see console for details.';
    console.error('Chart initialization failed', err);
    return;
  }
  // remove temporary debug outlines once the chart is initialized
  try {
    canvas.style.outline = '';
    if (canvas.parentElement) canvas.parentElement.style.outline = '';
  } catch (e) { /* ignore */ }
  renderLegendSpent(labels, spentData, colors);
}

function renderLegendSpent(labels, spentData, colors) {
  const container = document.getElementById('alloc-legend');
  container.innerHTML = '';
  labels.forEach((lab, i) => {
    const row = document.createElement('div');
    row.className = 'alloc-row' + (lab === 'Remaining' ? ' remaining' : '');

    const left = document.createElement('div');
    left.className = 'alloc-left';

    const sw = document.createElement('span');
    sw.className = 'alloc-swatch';
    sw.style.background = colors[i];

    const txt = document.createElement('span');
    txt.className = 'alloc-label';
    txt.textContent = lab;

    left.appendChild(sw);
    left.appendChild(txt);

    const right = document.createElement('div');
    right.className = 'alloc-right';
    const spent = Number(spentData[i]).toFixed(2);
    let subtitle = 'spent';
    if (lab === 'Remaining') subtitle = 'remaining';
    if (lab === 'Overspent') subtitle = 'over budget';
    right.innerHTML = `<div class="alloc-amount">${formatCurrency(spent)}</div><div class="alloc-sub">${subtitle}</div>`;

    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });
}

function renderExpensesList(expenses) {
  const ul = document.getElementById('expenses-list');
  ul.innerHTML = '';
  for (const e of expenses) {
    const li = document.createElement('li');
    li.textContent = `${e.date} — ${e.category} — ${formatCurrency(e.amount)}`;
    const btn = document.createElement('button');
    btn.textContent = 'Delete';
    btn.addEventListener('click', async () => {
      await fetch(`/api/expenses/${e.id}`, { method: 'DELETE' });
      await refresh();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

async function refresh() {
  const expenses = await fetchExpenses();
  const salary = Number(document.getElementById('salary').value) || 0;
  renderSpentChart(salary, expenses);
  renderExpensesList(expenses);
}

// CSV export/import
function expensesToCSV(expenses) {
  const header = ['date', 'category', 'amount'];
  const rows = expenses.map(e => [e.date, e.category, e.amount]);
  const csv = [header.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
  return csv;
}

document.getElementById('export-csv').addEventListener('click', async () => {
  const expenses = await fetchExpenses();
  const csv = expensesToCSV(expenses);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expenses.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
// show chosen filename when selecting a file
const importFileEl = document.getElementById('import-file');
const importFilenameEl = document.getElementById('import-filename');
if (importFileEl && importFilenameEl) {
  // keep import button disabled until a file is chosen
  const importCsvBtn = document.getElementById('import-csv');
  const chooseTileLabel = document.querySelector('label[for="import-file"] .tile-label');
  if (importCsvBtn) importCsvBtn.disabled = true;

  function truncateName(n, len = 22) {
    if (!n) return '';
    return n.length > len ? n.slice(0, len-3) + '...' : n;
  }

  importFileEl.addEventListener('change', () => {
    const f = importFileEl.files && importFileEl.files[0];
    importFilenameEl.textContent = f ? f.name : '';
    if (chooseTileLabel) chooseTileLabel.textContent = f ? truncateName(f.name) : 'Choose';
    if (importCsvBtn) importCsvBtn.disabled = !f;
  });
}

document.getElementById('import-csv').addEventListener('click', async () => {
  const input = document.getElementById('import-file');
  if (!input || !input.files || input.files.length === 0) { alert('Please choose a CSV file first'); return; }
  const file = input.files[0];
  const txt = await file.text();
  // parse CSV: tolerate header
  const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) { alert('CSV empty'); return; }
  const rows = lines.map(l => {
    // simple CSV split by comma, handling quoted values
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i=0;i<l.length;i++){
      const ch = l[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cols.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur);
    return cols.map(c => c.replace(/^\s+|\s+$/g, ''));
  });
  // detect header
  const header = rows[0].map(c => c.toLowerCase());
  let dataRows = rows;
  if (header.includes('date') && header.includes('category') && header.includes('amount')) {
    dataRows = rows.slice(1);
  }
  // POST each row
  let imported = 0;
  const statusEl = document.getElementById('import-status');
  if (statusEl) statusEl.textContent = 'Importing...';
  for (const r of dataRows) {
    const [date, category, amount] = r;
    if (!amount || !category) continue;
    const payload = { amount: Number(amount), category: category, date: date || undefined };
    try {
      await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      imported += 1;
    } catch (err) {
      console.error('import row failed', r, err);
    }
  }
  await refresh();
  if (statusEl) statusEl.textContent = `Import complete — ${imported} rows added`;
  // clear status after short delay
  setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 4000);
});

document.getElementById('add-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const formData = new FormData(form);
  const payload = {
    amount: formData.get('amount'),
    category: formData.get('category'),
    date: formData.get('date') || undefined
  };
  const res = await fetch('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.ok) {
    form.reset();
    await refresh();
  } else {
    const txt = await res.text();
    alert('Error: ' + txt);
  }
});

// initial load
populateCategorySelect();
refresh();
// update chart when salary changes
const salaryInput = document.getElementById('salary');
if (salaryInput) {
  salaryInput.addEventListener('input', () => {
    refresh();
  });
}
