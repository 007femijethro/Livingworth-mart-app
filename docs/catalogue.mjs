const catalogue = [
  ['Drinks and water', [
    ['Coca-Cola 50cl', 'Bottle', 600, 36, ['Crate', 12, 6600]],
    ['Fanta Orange 50cl', 'Bottle', 600, 24, ['Crate', 12, 6600]],
    ['Sprite 50cl', 'Bottle', 600, 24, ['Crate', 12, 6600]],
    ['Pepsi 50cl', 'Bottle', 550, 24],
    ['Maltina 33cl', 'Tin', 800, 24],
    ['Bottled water 75cl', 'Bottle', 300, 36, ['Pack', 12, 3000]],
    ['Pure Water', 'Sachet', 50, 200, ['Bag', 20, 500]],
    ['Chivita Orange Juice 1L', 'Pack', 2500, 8],
  ]],
  ['Food staples', [
    ['Indomie Chicken Noodles 70g', 'Pack', 450, 40, ['Carton', 40, 16000]],
    ['Golden Penny Spaghetti 500g', 'Pack', 1250, 20],
    ['Semovita 1kg', 'Bag', 2000, 12],
    ['Long Grain Rice 1kg', 'Bag', 1900, 20],
    ['Brown Beans 1kg', 'Bag', 2200, 10],
    ['White Garri 1kg', 'Bag', 950, 16],
    ['Honeywell Flour 1kg', 'Bag', 1600, 12],
    ['Groundnut Oil 1L', 'Bottle', 3300, 10],
    ['Dangote Sugar 500g', 'Bag', 950, 15],
    ['Iodised Salt 500g', 'Bag', 450, 18],
    ['Maggi Chicken Seasoning', 'Sachet', 500, 24],
    ['Tomato Paste 70g', 'Sachet', 400, 30],
    ['Peak Evaporated Milk 160g', 'Tin', 950, 24],
    ['Milo Refill 400g', 'Pack', 3500, 10],
    ['Sardines in Oil 125g', 'Tin', 1250, 18],
    ['Medium Eggs', 'Piece', 250, 60, ['Tray', 30, 6800]],
    ['Sliced Bread', 'Pack', 1300, 8],
  ]],
  ['Snacks and biscuits', [
    ['Cabin Biscuits', 'Pack', 550, 20],
    ['Digestive Biscuits', 'Pack', 900, 16],
    ['Chin Chin', 'Pack', 500, 20],
    ['Plantain Chips', 'Pack', 500, 20],
    ['Roasted Groundnuts', 'Pack', 650, 14],
  ]],
  ['Toiletries', [
    ['Closeup Toothpaste 140g', 'Piece', 1700, 14],
    ['Bathing Soap 125g', 'Piece', 750, 18],
    ['Toilet Tissue Roll', 'Piece', 600, 24, ['Pack', 4, 2100]],
    ['Sanitary Pads', 'Pack', 1500, 12],
  ]],
  ['Household and cleaning', [
    ['Omo Detergent 170g', 'Sachet', 650, 20],
    ['Morning Fresh Dishwashing Liquid 450ml', 'Bottle', 1700, 10],
    ['Hypo Bleach 250ml', 'Bottle', 750, 12],
    ['Scouring Sponge', 'Piece', 350, 16],
    ['Refuse Bags', 'Pack', 1200, 8],
  ]],
  ['Baby products', [
    ['Baby Wipes 80 Sheets', 'Pack', 1600, 10],
    ['Baby Diapers Size 3', 'Pack', 5200, 8],
  ]],
];

const normalize = name => name.toLowerCase().replace(/coca[\s-]*cola|\bcoke\b/g, 'cocacola').replace(/[^a-z0-9]/g, '');

export function addStarterCatalogue(state, at = Date.now()) {
  if (state.starterCatalogueAdded) return state;
  const existing = new Set(state.products.map(product => normalize(product.name)));
  const products = [];
  for (const [category, items] of catalogue) {
    for (const [name, unit, naira, quantity, bulk] of items) {
      const id = normalize(name);
      if (existing.has(id) || (id === 'purewater' && existing.has('purewaterbag'))) continue;
      const [bulkLabel = '', pack = 1, bulkPrice] = bulk ?? [];
      const price = naira * 100;
      const sellingOptions = [{label:unit, units:1, price}];
      if (bulk) sellingOptions.push({label:bulkLabel, units:pack, price:bulkPrice * 100});
      products.push({id:'starter-' + id, name, unit, category, barcode:'', quantity, low:5, price, pack, bulkLabel, sellingOptions, sample:true});
    }
  }
  return {
    ...state,
    starterCatalogueAdded:true,
    products:[...state.products, ...products],
    stock:[...state.stock, ...products.map(({name,quantity}) => ({at,name,quantity,reason:'Sample opening stock'}))],
  };
}
