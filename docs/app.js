import { initial, expected, checkout } from './store.mjs';

const key = 'rehoboth-v1';
let state = JSON.parse(localStorage.getItem(key) || 'null') ?? initial();
const cart = new Map();
const adminKey = 'livingworth-admin-v1';
let admin = false;
const categories = ['Food staples', 'Drinks and water', 'Snacks and biscuits', 'Toiletries', 'Household and cleaning', 'Baby products', 'Other'];
const units = ['Piece', 'Bottle', 'Sachet', 'Tin', 'Pack', 'Bag', 'Paint bucket'];
const unitName = product => (product.unit || 'Unit').toLowerCase();
const adminForm = () => form('admin', '<label>Admin PIN<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6,12}" required></label>', localStorage.getItem(adminKey) ? 'Unlock stock controls' : 'Set admin PIN');
async function pinHash(pin, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt:encoder.encode(salt), iterations:600000, hash:'SHA-256'}, key, 256);
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2,'0')).join('');
}
const app = document.querySelector('#app');
const nav = document.querySelector('nav');
const notice = document.querySelector('#notice');
const pages = ['Home', 'Sell', 'Stock', 'Cash Drawer', 'Reports'];
const methods = ['Cash', 'POS Card', 'Bank Transfer'];
const clock = new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' });
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' });
const currency = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', currencyDisplay: 'narrowSymbol' });
const money = value => currency.format(value / 100);
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const options = values => values.map(value => '<option>' + escape(value) + '</option>').join('');
const products = () => state.products.map(product => '<option value="' + product.id + '">' + escape(product.name) + '</option>').join('');
const time = value => clock.format(new Date(value));
const amount = label => '<label>' + label + ' (₦)<input name="amount" type="number" min="0" max="1000000000" step="0.01" required></label>';
const counter = (name, label, min = 0) => '<label>' + label + '<input name="' + name + '" type="number" min="' + min + '" max="10000000" step="1" required></label>';
const field = (name, label, required = true) => '<label>' + label + '<input name="' + name + '" maxlength="150" ' + (required ? 'required' : '') + '></label>';
const form = (id, fields, button) => '<form id="' + id + '">' + fields + '<button>' + button + '</button></form>';
const panel = (title, body) => '<section class="panel"><h2>' + title + '</h2>' + body + '</section>';
const row = (left, right) => '<div class="row"><span>' + left + '</span><strong>' + right + '</strong></div>';
const list = (rows, empty) => '<div class="list">' + (rows.join('') || '<p class="muted">' + empty + '</p>') + '</div>';
const metric = (label, value) => '<div class="metric"><span class="muted">' + label + '</span><b>' + value + '</b></div>';
const active = () => state.shifts.find(shift => !shift.closed);
const total = sales => sales.reduce((sum, sale) => sum + sale.total, 0);
const discrepancy = value => value === 0 ? 'Balanced' : money(Math.abs(value)) + (value < 0 ? ' shortage' : ' surplus');
let page = 'Home';
let reportDay = day.format(new Date());
let timer;

function message(value) {
  notice.textContent = value;
  clearTimeout(timer);
  timer = setTimeout(() => { notice.textContent = ''; }, 5000);
}

function home() {
  const today = state.sales.filter(sale => day.format(new Date(sale.at)) === day.format(new Date()));
  const low = state.products.filter(product => product.quantity <= product.low);
  return '<div class="cards">' + metric('Sales today', money(total(today))) + metric('Transactions', today.length) + metric('Low-stock products', low.length) + '</div>'
    + panel('Trading shift', '<div class="row"><span class="pill">' + (active() ? 'Shift open' : 'Drawer closed') + '</span><button data-page="' + (active() ? 'Sell">New Sale' : 'Cash Drawer">Open Shift') + '</button></div>')
    + panel('Low stock', list(low.map(product => row(escape(product.name), product.quantity + ' left')), 'No products are below their stock threshold.'))
    + panel('Today by payment method', list(methods.map(method => row(method, money(total(today.filter(sale => sale.method === method))))), ''));
}

function stock() {
  const inventory = panel('Stock on hand', list(state.products.map(product => row(escape(product.name) + ' · ' + money(product.price) + '<br><small>' + escape(product.category || 'Other') + ' · per ' + escape(unitName(product)) + '</small>', product.quantity + ' in stock')), 'No products have been added.'));
  if (!admin) return inventory + panel('Admin access', '<p class="muted">' + (localStorage.getItem(adminKey) ? 'Stock changes require the admin PIN.' : 'Initial setup: the store owner should set the admin PIN before handing this device to a cashier.') + '</p>' + adminForm());
  const adjust = state.products.length ? form('adjust', '<label>Product<select name="id">' + products() + '</select></label><label>Movement<select name="kind">' + options(['Receive units', 'Receive cartons or cases', 'Stock count', 'Damage', 'Expiry']) + '</select></label>' + counter('quantity', 'Quantity') + field('reason', 'Reason or delivery reference'), 'Save movement') : '<p>Add a product to record a movement.</p>';
  return inventory + panel('Admin session', '<button class="secondary" data-lock>Lock stock controls</button>')
    + '<div class="grid">' + panel('Add product', form('product', field('name','Product name') + field('barcode','Barcode',false) + '<label>Category<select name="category">' + options(categories) + '</select></label><label>Selling unit<select name="unit">' + options(units) + '</select></label>' + amount('Selling price') + counter('quantity','Opening units') + counter('pack','Selling units per carton or case',1) + counter('low','Low-stock threshold'), 'Add product')) + panel('Record stock movement', adjust) + '</div>';
}

function sell() {
  if (!active()) return panel('Open the drawer to start selling', '<button data-page="Cash Drawer">Open Shift</button>');
  const lines = state.products.filter(product => cart.has(product.id));
  const due = lines.reduce((sum, product) => sum + product.price * cart.get(product.id), 0);
  return '<div class="grid">' + panel('Find a product', '<label>Search by name, barcode or category<input id="search" type="search" autocomplete="off"></label><div id="matches" class="list"></div>')
    + panel('Cart', list(lines.map(product => '<div class="row"><strong>' + escape(product.name) + '</strong><span>' + cart.get(product.id) + ' × ' + money(product.price) + '</span><button class="secondary" data-remove="' + product.id + '">Remove one</button></div>'), 'Add products to start a sale.')
    + '<p><strong>Total ' + money(due) + '</strong></p>' + (lines.length ? form('sale', '<label>Payment method<select name="method">' + options(methods) + '</select></label><label id="tender">Cash received (₦)<input name="tender" type="number" min="0" step="0.01" required></label><output id="change"></output><label id="reference" hidden>Terminal or transfer reference<input name="reference" maxlength="150" placeholder="Optional"></label><label id="payment-confirm" class="checkbox" hidden><input type="checkbox" name="confirmed">I checked that payment was received</label>', 'Complete sale') : '')) + '</div>';
}

function matches(query = '') {
  const target = document.querySelector('#matches');
  if (!target) return;
  const search = query.trim().toLowerCase();
  const found = state.products.filter(product => product.name.toLowerCase().includes(search) || product.barcode.includes(search) || (product.category || '').toLowerCase().includes(search));
  target.innerHTML = found.map(product => '<div class="row"><span><strong>' + escape(product.name) + '</strong><br>' + money(product.price) + ' · ' + product.quantity + ' left</span><button data-add="' + product.id + '" ' + (product.quantity <= (cart.get(product.id) || 0) ? 'disabled' : '') + '>Add</button></div>').join('') || '<p>No products found.</p>';
}

function drawer() {
  const shift = active();
  if (!shift) return panel('Open shift', form('open', field('operator','Staff name') + amount('Opening cash'), 'Open shift'));
  return '<div class="cards">' + metric('Opening cash', money(shift.opening)) + metric('Opened by', escape(shift.operator)) + '</div>'
    + '<div class="grid">' + panel('Cash in or out', form('move', '<label>Direction<select name="direction">' + options(['Cash in','Cash out']) + '</select></label>' + amount('Amount') + field('reason','Reason'), 'Record movement'))
    + panel('Close shift', form('close', amount('Actual cash counted') + field('reason','Note (required if there is a difference)',false), 'Submit closing count')) + '</div>'
    + panel('Cash movements', list(shift.moves.map(move => row(escape(move.reason), money(move.amount))), 'No cash movements yet.'));
}

function reports() {
  const onDay = value => day.format(new Date(value)) === reportDay;
  const sales = state.sales.filter(sale => onDay(sale.at));
  const shifts = state.shifts.filter(shift => shift.closed && onDay(shift.closed.at));
  return panel('Reporting date', '<label>Date<input id="report-day" type="date" value="' + reportDay + '"></label>')
    + '<div class="cards">' + metric('Total sales', money(total(sales))) + methods.map(method => metric(method, money(total(sales.filter(sale => sale.method === method))))).join('') + '</div>'
    + panel('Sales', list(sales.map(sale => row(escape(sale.lines.map(line => line.quantity + ' × ' + line.name).join(', ')) + '<br><small>' + time(sale.at) + ' · ' + sale.method + (sale.reference ? ' · Ref ' + escape(sale.reference) : '') + '</small>', money(sale.total))), 'No sales for this date.'))
    + panel('Closed shifts', list(shifts.map(shift => row(escape(shift.operator) + ' · ' + time(shift.closed.at) + '<br><small>Expected ' + money(shift.closed.expected) + ' · Counted ' + money(shift.closed.actual) + ' · ' + escape(shift.closed.reason) + '</small>', discrepancy(shift.closed.actual - shift.closed.expected))), 'No closed shifts for this date.'))
    + panel('Stock movements', list(state.stock.filter(move => onDay(move.at)).map(move => row(escape(move.name) + ' · ' + escape(move.reason), (move.quantity > 0 ? '+' : '') + move.quantity)), 'No stock movements for this date.'));
}

function render() {
  nav.innerHTML = pages.map(name => '<button data-page="' + name + '"' + (page === name ? ' aria-current="page"' : '') + '>' + name + '</button>').join('');
  app.innerHTML = '<div class="eyebrow">' + time(Date.now()).split(' at ')[0] + '</div><h1>' + (page === 'Home' ? 'Store overview' : page) + '</h1>'
    + ({Home:home, Sell:sell, Stock:stock, 'Cash Drawer':drawer, Reports:reports}[page])();
  matches();
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.page) {
    if (button.dataset.page !== "Stock") admin = false;
    page = button.dataset.page;
    render();
    window.scrollTo(0,0);
  }
  if (button.hasAttribute('data-lock')) {
    admin = false;
    render();
    return;
  }
  const id = button.dataset.add || button.dataset.remove;
  if (!id) return;
  const query = document.querySelector('#search').value;
  const quantity = (cart.get(id) || 0) + (button.dataset.add ? 1 : -1);
  if (quantity > 0) cart.set(id, quantity);
  else cart.delete(id);
  render();
  document.querySelector('#search').value = query;
  matches(query);
});

document.addEventListener('input', event => {
  if (event.target.id === 'search') matches(event.target.value);
  const sale = document.querySelector('#sale');
  if (!sale || !sale.contains(event.target)) return;
  const cash = sale.elements.method.value === 'Cash';
  document.querySelector('#tender').hidden = !cash;
  sale.elements.tender.required = cash;
  document.querySelector('#reference').hidden = cash;
  document.querySelector('#payment-confirm').hidden = cash;
  sale.elements.confirmed.required = !cash;
  const due = [...cart].reduce((sum, [id, quantity]) => sum + state.products.find(product => product.id === id).price * quantity, 0);
  const tender = Math.round(Number(sale.elements.tender.value) * 100);
  document.querySelector('#change').textContent = cash && sale.elements.tender.value && tender >= due ? 'Change ' + money(tender - due) : '';
});
document.addEventListener('change', event => {
  if (event.target.id === 'report-day' && event.target.value) {
    reportDay = event.target.value;
    render();
  }
});

document.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const value = name => String(data.get(name) ?? '').trim();
  const required = name => {
    if (!value(name)) throw Error('Fill in the required fields.');
    return value(name);
  };
  const cents = name => Math.round(Number(value(name)) * 100);
  if (event.target.id === 'admin') {
    const button = event.target.querySelector('button');
    button.disabled = true;
    try {
      const pin = value('pin');
      const saved = JSON.parse(localStorage.getItem(adminKey) || 'null');
      const salt = saved?.salt ?? crypto.randomUUID();
      const hash = await pinHash(pin, salt);
      if (saved && saved.hash !== hash) throw Error('Incorrect admin PIN.');
      if (!saved) {
        if (localStorage.getItem(adminKey)) throw Error('The admin PIN was set in another tab. Try again.');
        localStorage.setItem(adminKey, JSON.stringify({salt,hash}));
      }
      admin = true;
      render();
    } catch (error) {
      message(error.message);
      button.disabled = false;
    }
    return;
  }
  const previous = structuredClone(state);
  const at = Date.now();
  const shift = active();
  const record = (product, quantity, reason) => state.stock.push({ at, name: product.name, quantity, reason });
  try {
    switch (event.target.id) {
      case 'product': {
        if (!admin) throw Error('Admin access is required to add products.');
        const barcode = value('barcode');
        if (barcode && state.products.some(product => product.barcode === barcode)) throw Error('That barcode is already assigned.');
        const product = { id: crypto.randomUUID(), name: required('name'), barcode, category: value('category'), unit: value('unit'), price: cents('amount'), quantity: Number(value('quantity')), pack: Number(value('pack')), low: Number(value('low')) };
        state.products.push(product);
        record(product, product.quantity, 'Opening stock');
        break;
      }
      case 'adjust': {
        if (!admin) throw Error('Admin access is required to change stock.');
        const product = state.products.find(item => item.id === value('id'));
        const quantity = Number(value('quantity'));
        const kind = value('kind');
        const delta = {'Receive units': quantity, 'Receive cartons or cases': quantity * product.pack, 'Stock count': quantity - product.quantity, Damage: -quantity, Expiry: -quantity}[kind];
        if (product.quantity + delta < 0) throw Error('Movement would leave negative stock.');
        product.quantity += delta;
        record(product, delta, kind + ' · ' + required('reason'));
        break;
      }
      case 'open':
        if (shift) throw Error('Close the active shift first.');
        state.shifts.push({ id: crypto.randomUUID(), at, operator: required('operator'), opening: cents('amount'), moves: [] });
        break;
      case 'move': {
        const amount = cents('amount') * (value('direction') === 'Cash in' ? 1 : -1);
        if (!shift || !amount) throw Error('Enter a cash movement greater than zero.');
        if (expected(state, shift) + amount < 0) throw Error('Cash out exceeds expected drawer cash.');
        shift.moves.push({ at, amount, reason: required('reason') });
        break;
      }
      case 'close': {
        if (!shift) throw Error('Open a shift first.');
        const actual = cents('amount');
        const balance = expected(state, shift);
        if (actual !== balance && !value('reason')) throw Error('Enter a note for the cash difference.');
        shift.closed = { at, actual, expected: balance, reason: value('reason') };
        break;
      }
      case 'sale': {
        const method = value('method');
        if (method !== 'Cash' && !data.has('confirmed')) throw Error('Confirm payment before completing this sale.');
        const sale = checkout(state, shift, cart, method, at);
        if (method !== 'Cash') sale.reference = value('reference');
        if (method === 'Cash' && cents('tender') < sale.total) throw Error('Cash received is below the sale total.');
        break;
      }
      default: return;
    }
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    state = previous;
    message(error.message);
    return;
  }
  if (event.target.id === 'sale' || event.target.id === 'close') cart.clear();
  message(event.target.id === 'close' ? discrepancy(shift.closed.actual - shift.closed.expected) : 'Saved.');
  render();
});
window.addEventListener('storage', event => {
  if (event.key === adminKey) {
    admin = false;
    render();
    return;
  }
  if (event.key !== key) return;
  state = JSON.parse(event.newValue || 'null') ?? initial();
  cart.clear();
  render();
  message('Records updated from another tab.');
});
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.warn);
