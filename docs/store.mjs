export const initial = () => ({ products: [], sales: [], shifts: [], stock: [] });
export const expected = (state, shift) => shift.opening
  + state.sales.filter(sale => sale.shift === shift.id && sale.method === 'Cash').reduce((sum, sale) => sum + sale.total, 0)
  + shift.moves.reduce((sum, move) => sum + move.amount, 0);
export function checkout(state, shift, cart, method, at) {
  if (!shift || shift.closed || !cart.size) throw Error('Open a shift and add products first.');
  const lines = [...cart].map(([id, quantity]) => {
    const product = state.products.find(p => p.id === id);
    if (!product || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > product.quantity) {
      throw Error('Check the available stock before saving.');
    }
    return { id, name: product.name, price: product.price, quantity };
  });
  const sale = { shift: shift.id, method, at, lines, total: lines.reduce((sum, line) => sum + line.price * line.quantity, 0) };
  for (const line of lines) {
    state.products.find(p => p.id === line.id).quantity -= line.quantity;
    state.stock.push({ at, name: line.name, quantity: -line.quantity, reason: 'Sale' });
  }
  state.sales.push(sale);
  return sale;
}
