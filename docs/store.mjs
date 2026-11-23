export const initial = () => ({ products: [], sales: [], shifts: [], stock: [] });
export const expected = (state, shift) => shift.opening
  + state.sales.filter(sale => sale.shift === shift.id && sale.method === 'Cash').reduce((sum, sale) => sum + sale.total, 0)
  + shift.moves.reduce((sum, move) => sum + move.amount, 0);
export const sellingOptions = product => product.sellingOptions ?? [
  { label: product.unit || 'Unit', units: 1, price: product.price },
];
export function cartLines(state, cart) {
  const remaining = new Map();
  return [...cart].map(([key, quantity]) => {
    const [id, index = 0] = key.split(':');
    const product = state.products.find(item => item.id === id && !item.archived);
    const option = product && sellingOptions(product)[index];
    const units = quantity * option?.units;
    const available = remaining.get(id) ?? product?.quantity;
    if (!option || !Number.isSafeInteger(units) || !Number.isSafeInteger(quantity) || quantity < 1 || units > available) {
      throw Error('Check the available stock before saving.');
    }
    remaining.set(id, available - units);
    return { key, id, name: product.name, label: option.label, price: option.price, quantity, units };
  });
}
export function checkout(state, shift, cart, method, at) {
  if (!shift || shift.closed || !cart.size) throw Error('Open a shift and add products first.');
  const lines = cartLines(state, cart);
  const sale = { shift: shift.id, method, at, lines, total: lines.reduce((sum, line) => sum + line.price * line.quantity, 0) };
  for (const line of lines) {
    state.products.find(p => p.id === line.id).quantity -= line.units;
    state.stock.push({ at, name: line.name, quantity: -line.units, reason: 'Sale · ' + line.quantity + ' × ' + line.label });
  }
  state.sales.push(sale);
  return sale;
}
