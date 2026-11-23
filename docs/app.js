import { addStarterCatalogue } from './catalogue.mjs';
import { initial, expected, checkout, sellingOptions, cartLines } from './store.mjs';

const key = 'rehoboth-v1';
let state = JSON.parse(localStorage.getItem(key) || 'null') ?? initial();
const starter = addStarterCatalogue(state);
if (starter !== state) {
  localStorage.setItem(key, JSON.stringify(starter));
  state = starter;
}
const cart = new Map();
const adminKey = 'livingworth-admin-v1';
const staffKey = 'livingworth-staff-v1';
const staff = () => JSON.parse(localStorage.getItem(staffKey) || '[]');
let user = null;
const isAdmin = () => user?.role === 'admin';
const categories = ['Food staples', 'Drinks and water', 'Snacks and biscuits', 'Toiletries', 'Household and cleaning', 'Baby products', 'Other'];
const units = ['Piece', 'Bottle', 'Sachet', 'Tin', 'Pack', 'Bag', 'Paint bucket'];
const unitName = product => (product.unit || 'Unit').toLowerCase();
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
const activeProducts = () => state.products.filter(product => !product.archived);
const products = () => activeProducts().map(product => '<option value="' + product.id + '">' + escape(product.name) + '</option>').join('');
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
  const status = document.querySelector('dialog[open] .dialog-status');
  if (status) {
    status.textContent = value;
    return;
  }
  notice.textContent = value;
  clearTimeout(timer);
  timer = setTimeout(() => { notice.textContent = ''; }, 5000);
}

function home() {
  const today = state.sales.filter(sale => day.format(new Date(sale.at)) === day.format(new Date()));
  const low = activeProducts().filter(product => product.quantity <= product.low);
  return '<div class="cards">' + metric('Sales today', money(total(today))) + metric('Transactions', today.length) + metric('Low-stock products', low.length) + '</div>'
    + panel('Trading shift', '<div class="row"><span class="pill">' + (active() ? 'Shift open' : 'Drawer closed') + '</span><button data-page="' + (active() ? 'Sell">New Sale' : 'Cash Drawer">Open Shift') + '</button></div>')
    + panel('Low stock', list(low.map(product => row(escape(product.name), product.quantity + ' left')), 'No products are below their stock threshold.'))
    + panel('Today by payment method', list(methods.map(method => row(method, money(total(today.filter(sale => sale.method === method))))), ''));
}

const stockLabel = product => {
  const total = product.quantity + ' ' + unitName(product) + (product.quantity === 1 ? '' : 's');
  if (!product.bulkLabel || product.pack < 2) return total;
  const count = Math.floor(product.quantity / product.pack);
  const remainder = product.quantity % product.pack;
  return count + ' ' + product.bulkLabel.toLowerCase() + (count === 1 ? '' : 's')
    + (remainder ? ' + ' + remainder + ' ' + unitName(product) + (remainder === 1 ? '' : 's') : '') + ' · ' + total + ' total';
};
const waterEntries = () => {
  const products = activeProducts();
  const base = products.find(product => /^pure water$/i.test(product.name.trim()) && !product.bulkLabel);
  const bag = products.find(product => /^pure water\s*\(bag\)$/i.test(product.name.trim()));
  return base && bag ? {base, bag} : null;
};
const selectProduct = (name, label) => '<label>' + label + '<select name="' + name + '">' + products() + '</select></label>';
const unitField = '<label>Base stock unit<select name="unit">' + options(units) + '</select></label>';
const bulkFields = field('bulkLabel','Bulk name (e.g. Bag or Carton)',false)
  + '<label>Bulk price (₦)<input name="bulkPrice" type="number" min="0" max="1000000000" step="0.01"></label>'
  + counter('pack','Units per bulk package',1).replace('required','required value="1"');
const groupFields = '<label>Units per retail sale<input name="group" type="number" min="1" max="10000000" value="1" required></label>'
  + amount('Price per retail sale');
const movementKinds = ['Receive units','Receive bulk packages','Stock count','Damage','Expiry'];

function fillPricing() {
  const editor = document.querySelector('#pricing');
  if (!editor) return;
  const product = activeProducts().find(item => item.id === editor.elements.id.value);
  const retail = sellingOptions(product)[0];
  editor.elements.unit.value = units.includes(product.unit) ? product.unit : 'Piece';
  editor.elements.group.value = retail.units;
  editor.elements.amount.value = retail.price / 100;
  editor.elements.pack.value = product.pack || 1;
  editor.elements.bulkLabel.value = product.bulkLabel || '';
  editor.elements.bulkPrice.value = product.bulkLabel ? sellingOptions(product)[1].price / 100 : '';
}

const popup = (id,title,body) => '<dialog id="dialog-' + id + '" aria-labelledby="title-' + id + '"><header><h2 id="title-' + id + '">' + escape(title) + '</h2><button type="button" class="secondary" data-dismiss aria-label="Close dialog">Close</button></header><div class="dialog-body">' + body + '</div><p class="dialog-status" role="status"></p></dialog>';
const launch = (id,label) => '<button type="button" data-dialog="' + id + '">' + label + '</button>';
function openPopup(id) {
  const dialog = document.querySelector('#dialog-' + id);
  document.querySelector('dialog[open]')?.close();
  dialog?.showModal();
}

function stockRows(query = '') {
  const term = query.trim().toLowerCase();
  return list(activeProducts().filter(product => product.name.toLowerCase().includes(term) || (product.category || '').toLowerCase().includes(term)).map(product => '<div class="row"><span><strong>' + escape(product.name) + '</strong><br><small>' + escape(product.category || 'Other') + (product.sample ? ' · Starter item' : '') + '</small></span><span class="stock-actions"><strong>' + escape(stockLabel(product)) + '</strong><button class="secondary" data-stock-item="' + product.id + '">Details</button></span></div>'), 'No matching products.');
}

function stock() {
  const inventory = panel('Stock on hand', '<label>Search stock<input id="stock-search" type="search" placeholder="Product or category"></label><div id="stock-results">' + stockRows() + '</div>');
  const details = popup('stock-item','Product details','<div id="stock-details"></div>');
  const waterSetup = waterEntries();
  const waterNotice = waterSetup ? panel('Combine Pure Water stock', '<p>The two Pure Water entries need one shared balance. Combine them to make the sachets inside each bag available at checkout.</p>'
    + (isAdmin() ? '<button type="button" data-water-setup>Set up Pure Water</button>' : '<p>Ask an admin to combine the entries.</p>')) : '';
  if (!isAdmin()) return waterNotice + inventory + details;
  const adjust = activeProducts().length ? form('adjust', selectProduct('id','Product') + '<label>Movement<select name="kind">' + options(movementKinds) + '</select></label>' + counter('quantity','Quantity') + field('reason','Reason or delivery reference'), 'Save movement') : '<p>Add a product to record a movement.</p>';
  const setup = activeProducts().length ? popup('pricing','Set selling options', form('pricing', selectProduct('id','Product') + unitField + groupFields + bulkFields, 'Save selling options')) : '';
  const merge = activeProducts().length > 1 ? popup('merge','Combine existing products', form('merge', selectProduct('id','Keep this product (base units)') + selectProduct('source','Convert this product (bags or cartons)') + unitField + groupFields + bulkFields + '<output id="conversion"></output>', 'Combine products')) : '';
  return '<div class="toolbar">' + launch('product','Add product') + (activeProducts().length ? launch('adjust','Record movement') : '') + (merge ? launch('merge','Combine products') : '') + '</div>'
    + waterNotice + inventory + details + popup('product','Add product',form('product',field('name','Product name') + field('barcode','Barcode',false) + '<label>Category<select name="category">' + options(categories) + '</select></label>' + unitField + groupFields + bulkFields + counter('quantity','Opening base units') + counter('low','Low-stock threshold in base units'), 'Add product'))
    + popup('adjust','Record stock movement',adjust) + setup + merge;
}

function sell() {
  if (!active()) return panel('Open the drawer to start selling', '<button data-page="Cash Drawer">Open Shift</button>');
  const lines = cartLines(state, cart);
  const due = lines.reduce((sum,line) => sum + line.price * line.quantity, 0);
  const waterNotice = waterEntries() ? panel('Pure Water stock setup', '<p>Pure Water has two product entries. Combine them in Stock so the sachets inside the bags can be sold from the same balance.</p>' + (isAdmin() ? '<button data-page="Stock">Go to Stock</button>' : '')) : '';
  return waterNotice + '<div class="grid">' + panel('Find a product', '<label>Search by name, barcode or category<input id="search" type="search" autocomplete="off"></label><div id="matches" class="list"></div>')
    + panel('Cart', list(lines.map(line => '<div class="row"><strong>' + escape(line.name + ' · ' + line.label) + '</strong><span>' + line.quantity + ' × ' + money(line.price) + '</span><button class="secondary" data-remove="' + line.key + '">Remove one</button></div>'), 'Add products to start a sale.')
    + '<p><strong>Total ' + money(due) + '</strong></p>' + (lines.length ? launch('payment','Take payment') : '')) + '</div>'
    + popup('pick','Selling options','<div id="selling-details"></div>')
    + (lines.length ? popup('payment','Take payment · ' + money(due), form('sale', '<label>Payment method<select name="method">' + options(methods) + '</select></label><label id="tender">Cash received (₦)<input name="tender" type="number" min="0" step="0.01" required></label><output id="change"></output><label id="reference" hidden>Terminal or transfer reference<input name="reference" maxlength="150" placeholder="Optional"></label><label id="payment-confirm" class="checkbox" hidden><input type="checkbox" name="confirmed">I checked that payment was received</label>', 'Complete sale')) : '');
}

function matches(query = '') {
  const target = document.querySelector('#matches');
  if (!target) return;
  const search = query.trim().toLowerCase();
  const found = activeProducts().filter(product => product.name.toLowerCase().includes(search) || product.barcode.includes(search) || (product.barcodes || []).some(code => code.includes(search)) || (product.category || '').toLowerCase().includes(search));
  target.innerHTML = list(found.map(product => '<div class="row"><span><strong>' + escape(product.name) + '</strong><br><small>' + escape(stockLabel(product)) + '</small></span><button class="secondary" data-pick="' + product.id + '">Select</button></div>'), 'No products found.');
}

function showSellingOptions(product) {
  const used = cartLines(state,cart).filter(line => line.id === product.id).reduce((sum,line) => sum + line.units,0);
  document.querySelector('#title-pick').textContent = product.name;
  document.querySelector('#selling-details').innerHTML = list(sellingOptions(product).map((option,index) => {
    const available = Math.floor((product.quantity - used) / option.units);
    return '<div class="row"><span><strong>' + escape(option.label) + '</strong><br><small>' + money(option.price) + ' · ' + available + ' available</small></span><button data-add="' + product.id + ':' + index + '" ' + (available < 1 ? 'disabled' : '') + '>Add to cart</button></div>';
  }), 'No selling options.');
  openPopup('pick');
}

function drawer() {
  const shift = active();
  if (!shift) return panel('Drawer closed', launch('open','Open shift')) + popup('open','Open shift',form('open', amount('Opening cash'), 'Open shift'));
  return '<div class="cards">' + metric('Opening cash', money(shift.opening)) + metric('Opened by', escape(shift.operator)) + '</div>'
    + '<div class="toolbar">' + launch('move','Cash in or out') + launch('close','Close shift') + '</div>' + popup('move','Cash in or out', form('move', '<label>Direction<select name="direction">' + options(['Cash in','Cash out']) + '</select></label>' + amount('Amount') + field('reason','Reason'), 'Record movement'))
    + popup('close','Close shift', form('close', amount('Actual cash counted') + field('reason','Note (required if there is a difference)',false), 'Submit closing count'))
    + panel('Cash movements', list(shift.moves.map(move => row(escape(move.reason), money(move.amount))), 'No cash movements yet.'));
}

function reports() {
  const onDay = value => day.format(new Date(value)) === reportDay;
  const sales = state.sales.filter(sale => onDay(sale.at));
  const shifts = state.shifts.filter(shift => shift.closed && onDay(shift.closed.at));
  return panel('Reporting date', '<label>Date<input id="report-day" type="date" value="' + reportDay + '"></label>')
    + '<div class="cards">' + metric('Total sales', money(total(sales))) + methods.map(method => metric(method, money(total(sales.filter(sale => sale.method === method))))).join('') + '</div>'
    + panel('Sales', list(sales.map(sale => row(escape(sale.lines.map(line => line.quantity + ' × ' + line.name + (line.label ? ' (' + line.label + ')' : '')).join(', ')) + '<br><small>' + time(sale.at) + ' · ' + (sale.operator ? escape(sale.operator) + ' · ' : '') + sale.method + (sale.reference ? ' · Ref ' + escape(sale.reference) : '') + '</small>', money(sale.total))), 'No sales for this date.'))
    + panel('Closed shifts', list(shifts.map(shift => row(escape(shift.operator) + ' · ' + time(shift.closed.at) + '<br><small>Expected ' + money(shift.closed.expected) + ' · Counted ' + money(shift.closed.actual) + ' · ' + escape(shift.closed.reason) + '</small>', discrepancy(shift.closed.actual - shift.closed.expected))), 'No closed shifts for this date.'))
    + panel('Stock movements', list(state.stock.filter(move => onDay(move.at)).map(move => row(escape(move.name) + ' · ' + escape(move.reason), (move.quantity > 0 ? '+' : '') + move.quantity)), 'No stock movements for this date.'));
}

const passwordField = (name, label, minimum = 1) => '<label>' + label + '<input name="' + name + '" type="password" minlength="' + minimum + '" maxlength="128" required></label>';
const usernameField = () => '<label>Username<input name="username" autocomplete="username" minlength="3" maxlength="32" pattern="[a-zA-Z0-9._\\-]{3,32}" required></label>';

function staffPage() {
  const sellers = staff().filter(account => account.role === 'seller');
  return '<div class="toolbar">' + launch('new-seller','Create seller') + (sellers.length ? launch('reset-seller','Reset password') : '') + '</div>' + popup('new-seller','Create seller account', form('new-seller', field('name','Full name') + usernameField() + passwordField('password','Initial password',10), 'Create seller'))
    + panel('Seller accounts', list(sellers.map(account => '<div class="row"><span><strong>' + escape(account.name) + '</strong><br><small>' + escape(account.username) + ' · ' + (account.disabled ? 'Disabled' : 'Active') + '</small></span><button class="secondary" data-toggle="' + account.id + '">' + (account.disabled ? 'Enable' : 'Disable') + '</button></div>'), 'No seller accounts yet.'))
    + (sellers.length ? popup('reset-seller','Reset seller password', form('reset-seller', '<label>Seller<select name="id">' + sellers.map(account => '<option value="' + account.id + '">' + escape(account.username) + '</option>').join('') + '</select></label>' + passwordField('password','New password',10), 'Reset password')) : '');
}

function render() {
  if (!user) {
    nav.innerHTML = '';
    const setup = staff().length === 0;
    app.innerHTML = '<h1>' + (setup ? 'Set up Livingworth Mart' : 'Staff sign-in') + '</h1>' + panel(setup ? 'Create the store admin' : 'Rehoboth Supermarket',
      form(setup ? 'setup' : 'login', (setup ? field('name','Admin name') : '') + usernameField()
        + (setup && localStorage.getItem(adminKey) ? passwordField('pin','Existing admin PIN') : '')
        + passwordField('password',setup ? 'Choose a password' : 'Password',setup ? 10 : 1), setup ? 'Create admin account' : 'Sign in'));
    return;
  }
  const allowed = isAdmin() ? [...pages, 'Staff'] : pages.filter(name => name !== 'Reports');
  if (!allowed.includes(page)) page = 'Home';
  nav.innerHTML = allowed.map(name => '<button data-page="' + name + '"' + (page === name ? ' aria-current="page"' : '') + '>' + name + '</button>').join('') + '<button data-signout>Sign out</button>';
  app.innerHTML = '<div class="eyebrow">' + escape(user.name) + ' · ' + (isAdmin() ? 'Admin' : 'Seller') + ' · ' + time(Date.now()).split(' at ')[0] + '</div><h1>' + (page === 'Home' ? 'Store overview' : page) + '</h1>'
    + ({Home:home, Sell:sell, Stock:stock, 'Cash Drawer':drawer, Reports:reports, Staff:staffPage}[page])();
  matches();
  fillPricing();
}

function previewMerge(merge) {
  const target = activeProducts().find(product => product.id === merge.elements.id.value);
  const source = activeProducts().find(product => product.id === merge.elements.source.value);
  const pack = Number(merge.elements.pack.value);
  document.querySelector('#conversion').textContent = target && source && target !== source && pack > 1
    ? target.quantity + ' + ' + source.quantity + ' × ' + pack + ' = ' + (target.quantity + source.quantity * pack) + ' base units after combining.'
    : 'Choose two different entries and enter the units per bag or carton.';
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-dismiss')) {
    button.closest('dialog').close();
    return;
  }
  if (button.dataset.dialog) {
    const id = button.dataset.dialog;
    const editor = document.querySelector('#' + id);
    if (button.dataset.product && editor) editor.elements.id.value = button.dataset.product;
    if (id === 'pricing') fillPricing();
    if (id === 'merge') previewMerge(editor);
    openPopup(id);
    return;
  }
  if (button.dataset.pick) {
    const product = activeProducts().find(item => item.id === button.dataset.pick);
    if (product) showSellingOptions(product);
    return;
  }
  if (button.dataset.stockItem) {
    const product = activeProducts().find(item => item.id === button.dataset.stockItem);
    if (!product) return;
    document.querySelector('#title-stock-item').textContent = product.name;
    const actions = isAdmin() ? '<div class="toolbar"><button data-dialog="pricing" data-product="' + product.id + '">Edit selling options</button><button class="secondary" data-dialog="adjust" data-product="' + product.id + '">Record movement</button></div>' : '';
    document.querySelector('#stock-details').innerHTML = '<p>' + escape(stockLabel(product)) + '</p>' + list(sellingOptions(product).map(option => row(escape(option.label),money(option.price))), '') + actions;
    openPopup('stock-item');
    return;
  }
  if (button.hasAttribute('data-water-setup') && isAdmin()) {
    const entries = waterEntries();
    const merge = document.querySelector('#merge');
    if (!entries || !merge) return;
    const fields = merge.elements;
    fields.id.value = entries.base.id;
    fields.source.value = entries.bag.id;
    fields.unit.value = 'Sachet';
    fields.group.value = 1;
    fields.amount.value = entries.base.price / 100;
    fields.bulkLabel.value = 'Bag';
    fields.bulkPrice.value = entries.bag.price / 100;
    fields.pack.value = 20;
    previewMerge(merge);
    openPopup('merge');
    fields.amount.focus();
    return;
  }
  if (button.dataset.page) {
    page = button.dataset.page;
    render();
    window.scrollTo(0,0);
  }
  if (button.hasAttribute('data-signout')) {
    user = null;
    cart.clear();
    page = 'Home';
    render();
    return;
  }
  if (button.dataset.toggle && isAdmin()) {
    const accounts = staff();
    const seller = accounts.find(account => account.id === button.dataset.toggle && account.role === 'seller');
    if (seller) {
      seller.disabled = !seller.disabled;
      localStorage.setItem(staffKey, JSON.stringify(accounts));
      render();
    }
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
  if (event.target.id === 'stock-search') document.querySelector('#stock-results').innerHTML = stockRows(event.target.value);
  if (event.target.form?.id === 'merge') previewMerge(event.target.form);
  const sale = document.querySelector('#sale');
  if (!sale || !sale.contains(event.target)) return;
  const cash = sale.elements.method.value === 'Cash';
  document.querySelector('#tender').hidden = !cash;
  sale.elements.tender.required = cash;
  document.querySelector('#reference').hidden = cash;
  document.querySelector('#payment-confirm').hidden = cash;
  sale.elements.confirmed.required = !cash;
  const due = cartLines(state, cart).reduce((sum,line) => sum + line.price * line.quantity, 0);
  const tender = Math.round(Number(sale.elements.tender.value) * 100);
  document.querySelector('#change').textContent = cash && sale.elements.tender.value && tender >= due ? 'Change ' + money(tender - due) : '';
});
document.addEventListener('change', event => {
  if (event.target.form?.id === 'pricing' && event.target.name === 'id') fillPricing();
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
  const action = event.target.id;
  if (['setup','login','new-seller','reset-seller'].includes(action)) {
    const button = event.target.querySelector('button');
    button.disabled = true;
    try {
      const password = String(data.get('password') ?? '');
      const username = value('username').toLowerCase();
      const accounts = staff();
      const snapshot = JSON.stringify(accounts);
      if (action === 'login') {
        const account = accounts.find(item => item.username === username);
        if (!account || account.disabled || await pinHash(password, account.salt) !== account.hash || JSON.stringify(staff()) !== snapshot) throw Error('Invalid username or password.');
        user = {id:account.id, name:account.name, role:account.role};
      } else {
        if (action === 'setup') {
          if (accounts.length) throw Error('The admin account already exists.');
          const legacy = JSON.parse(localStorage.getItem(adminKey) || 'null');
          if (legacy && await pinHash(value('pin'), legacy.salt) !== legacy.hash) throw Error('Incorrect existing admin PIN.');
        } else if (!isAdmin()) throw Error('Admin access is required.');
        if (password.length < 10 || password.length > 128) throw Error('Choose a password with 10–128 characters.');
        const salt = crypto.randomUUID();
        const hash = await pinHash(password, salt);
        if (JSON.stringify(staff()) !== snapshot || (action !== 'setup' && !isAdmin())) throw Error('Staff accounts changed. Try again.');
        if (action === 'reset-seller') {
          const seller = accounts.find(item => item.id === value('id') && item.role === 'seller');
          if (!seller) throw Error('Choose a seller.');
          Object.assign(seller, {salt,hash});
        } else {
          if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw Error('Enter a valid username.');
          if (accounts.some(item => item.username === username)) throw Error('That username already exists.');
          accounts.push({id:crypto.randomUUID(), name:required('name'), role:action === 'setup' ? 'admin' : 'seller', username, salt, hash});
        }
        localStorage.setItem(staffKey, JSON.stringify(accounts));

      }
      render();
      if (action !== 'login') message(action === 'setup' ? 'Admin account created. Sign in to continue.' : 'Seller account saved.');
    } catch (error) {
      message(error.message);
      button.disabled = false;
    }
    return;
  }
  if (!user) {
    message('Sign in to continue.');
    return;
  }
  const previous = structuredClone(state);
  const at = Date.now();
  const shift = active();
  const record = (product, quantity, reason) => state.stock.push({ at, name: product.name, quantity, reason });
  const configure = product => {
    const group = Number(value('group'));
    const pack = Number(value('pack'));
    const unit = value('unit');
    const bulkLabel = value('bulkLabel');
    if (!units.includes(unit) || !Number.isSafeInteger(group) || group < 1 || !Number.isSafeInteger(pack) || pack < 1) throw Error('Check the selling units.');
    if (bulkLabel && (pack < 2 || !value('bulkPrice'))) throw Error('Enter at least two units per bulk package and its price.');
    if (!bulkLabel && value('bulkPrice')) throw Error('Enter a name for the bulk option.');
    const retail = { label: group === 1 ? unit : group + ' ' + unit.toLowerCase() + 's', units: group, price: cents('amount') };
    Object.assign(product,{unit,pack,bulkLabel,price:retail.price,sellingOptions:[retail]});
    if (bulkLabel) product.sellingOptions.push({label:bulkLabel,units:pack,price:cents('bulkPrice')});
  };
  try {
    switch (event.target.id) {
      case 'product': {
        if (!isAdmin()) throw Error('Admin access is required to add products.');
        const barcode = value('barcode');
        if (barcode && state.products.some(product => (product.barcode === barcode || product.barcodes?.includes(barcode)))) throw Error('That barcode is already assigned.');
        const product = { id: crypto.randomUUID(), name: required('name'), barcode, category: value('category'), unit: value('unit'), price: cents('amount'), quantity: Number(value('quantity')), pack: Number(value('pack')), low: Number(value('low')) };
        configure(product);
        state.products.push(product);
        record(product, product.quantity, 'Opening stock');
        break;
      }
      case 'pricing':
      case 'merge': {
        if (!isAdmin()) throw Error('Admin access is required to change products.');
        const product = activeProducts().find(item => item.id === value('id'));
        if (!product) throw Error('Choose a product.');
        configure(product);
        if (action === 'merge') {
          const source = activeProducts().find(item => item.id === value('source'));
          if (!source || source === product || !product.bulkLabel) throw Error('Choose two different products and configure the bulk option.');
          const added = source.quantity * product.pack;
          if (!Number.isSafeInteger(product.quantity + added)) throw Error('The converted stock count is too large.');
          product.quantity += added;
          product.barcodes = [...new Set([...(product.barcodes || []),source.barcode,...(source.barcodes || [])].filter(Boolean))];
          record(product, added, 'Converted ' + source.quantity + ' × ' + source.name + ' at ' + product.pack + ' base units each');
          record(source, -source.quantity, 'Combined into ' + product.name);
          source.quantity = 0;
          source.archived = true;
        }
        break;
      }
      case 'adjust': {
        if (!isAdmin()) throw Error('Admin access is required to change stock.');
        const product = state.products.find(item => item.id === value('id'));
        const quantity = Number(value('quantity'));
        const kind = value('kind');
        const delta = {'Receive units': quantity, 'Receive bulk packages': quantity * product.pack, 'Stock count': quantity - product.quantity, Damage: -quantity, Expiry: -quantity}[kind];
        if (product.quantity + delta < 0) throw Error('Movement would leave negative stock.');
        product.quantity += delta;
        record(product, delta, kind + (kind === 'Receive bulk packages' ? ' · ' + quantity + ' × ' + (product.bulkLabel || 'package') + ' (' + product.pack + ' base units each)' : '') + ' · ' + required('reason'));
        break;
      }
      case 'open':
        if (shift) throw Error('Close the active shift first.');
        state.shifts.push({ id: crypto.randomUUID(), at, operator: user.name, operatorId: user.id, opening: cents('amount'), moves: [] });
        break;
      case 'move': {
        const amount = cents('amount') * (value('direction') === 'Cash in' ? 1 : -1);
        if (!shift || !amount) throw Error('Enter a cash movement greater than zero.');
        if (expected(state, shift) + amount < 0) throw Error('Cash out exceeds expected drawer cash.');
        shift.moves.push({ at, amount, reason: required('reason'), operator: user.name, operatorId: user.id });
        break;
      }
      case 'close': {
        if (!shift) throw Error('Open a shift first.');
        const actual = cents('amount');
        const balance = expected(state, shift);
        if (actual !== balance && !value('reason')) throw Error('Enter a note for the cash difference.');
        shift.closed = { at, actual, expected: balance, reason: value('reason'), operator: user.name, operatorId: user.id };
        break;
      }
      case 'sale': {
        const method = value('method');
        if (method !== 'Cash' && !data.has('confirmed')) throw Error('Confirm payment before completing this sale.');
        const sale = checkout(state, shift, cart, method, at);
        sale.operator = user.name;
        sale.operatorId = user.id;
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
  if (['sale','close','adjust','pricing','merge'].includes(action)) cart.clear();
  render();
  message(event.target.id === 'close' ? discrepancy(shift.closed.actual - shift.closed.expected) : 'Saved.');
});
window.addEventListener('storage', event => {
  if (event.key === staffKey) {
    user = null;
    cart.clear();
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
