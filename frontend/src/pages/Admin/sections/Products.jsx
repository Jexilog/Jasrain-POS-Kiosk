import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useProducts } from '../../../context/ProductContext';
import { useSettings } from '../../../context/SettingsContext';
import { generateBarcode } from '../../../utils/barcode';
import { toCSV, downloadText, parseCSV } from '../../../utils/csv';
import { peso, int } from '../../../utils/format';
import { PageHeader, Card, Badge, Segmented, EmptyState, Modal, Field } from '../components/ui';
import ProdCell from '../components/ProdCell';
import Icon from '../../../components/Icon';

const TEMPLATE = 'barcode,name,price,cost,category,stock,critical\r\n4800000000017,Sample Item,25,18,Snacks,20,5\r\n';

const blank = (critical) => ({
  name: '', barcode: '', category: '', price: '', cost: '', stock: '', critical: String(critical), image: '',
});

const marginOf = (price, cost) => (price > 0 ? ((price - cost) / price) * 100 : null);

// add / edit form
function ProductForm({ product, categories, barcodes, defaultCritical, onSubmit, onClose }) {
  const editing = Boolean(product);
  const [f, setF] = useState(
    editing
      ? { ...product, price: String(product.price), cost: String(product.cost), critical: String(product.critical), stock: '' }
      : blank(defaultCritical)
  );
  const [error, setError] = useState('');
  const priceRef = useRef(null);
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));

  const price = Number(f.price);
  const cost = Number(f.cost);
  const margin = marginOf(price, cost);

  const submit = async (e) => {
    e.preventDefault();
    const result = await onSubmit({
      name: f.name,
      barcode: f.barcode,
      category: f.category,
      price: f.price,
      cost: f.cost,
      stock: f.stock,
      critical: f.critical,
      image: f.image,
    });
    if (!result.ok) setError(result.error);
  };

  return (
    <Modal
      title={editing ? 'Edit product' : 'Add product'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button className="admBtn" type="button" onClick={onClose}>Cancel</button>
          <button className="admBtn primary" type="submit" form="productForm">
            {editing ? 'Save changes' : 'Add product'}
          </button>
        </>
      }
    >
      <form id="productForm" onSubmit={submit} className="admFormGrid">
        <div className="full">
          <Field label="Name">
            <input value={f.name} onChange={set('name')} autoFocus={editing} placeholder="e.g. Coke Zero 330ml" />
          </Field>
        </div>

        <div className="full">
          <Field
            label="Barcode"
            hint={editing ? "The barcode can't be changed. To use a new one, archive this product and add a new product." : 'Scan the item with your barcode scanner, type it, or generate a store barcode.'}
          >
            <div className="admRow">
              <input
                value={f.barcode}
                onChange={set('barcode')}
                disabled={editing}
                inputMode="numeric"
                autoFocus={!editing}
                placeholder="Scan or type"
                onKeyDown={(e) => {
                  // a scanner ends with Enter: move on instead of submitting the form
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    priceRef.current?.focus();
                  }
                }}
              />
              {!editing && (
                <button type="button" className="admBtn" onClick={() => setF((c) => ({ ...c, barcode: generateBarcode(barcodes) }))}>
                  Generate
                </button>
              )}
            </div>
          </Field>
        </div>

        <Field label="Category" hint="Pick one or type a new one.">
          <input value={f.category} onChange={set('category')} list="catList" placeholder="e.g. Drinks" />
          <datalist id="catList">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>

        <Field label="Critical level" hint="Alert when stock drops to this number or less.">
          <input type="number" min="0" step="1" value={f.critical} onChange={set('critical')} />
        </Field>

        <Field label="Selling price (₱)">
          <input ref={priceRef} type="number" min="0" step="0.01" value={f.price} onChange={set('price')} />
        </Field>

        <Field label="Cost price (₱)" hint="What you pay your supplier.">
          <input type="number" min="0" step="0.01" value={f.cost} onChange={set('cost')} />
        </Field>

        {margin != null && (
          <div className="full admCallout">
            Profit per item: <strong>{peso(price - cost)}</strong> · margin <strong>{margin.toFixed(0)}%</strong>
            {price < cost && <span className="admBad"> <Icon name="alert" size={13} /> You would sell below cost.</span>}
          </div>
        )}

        {!editing && (
          <div className="full">
            <Field label="Starting stock" hint="How many you have right now. You can change it later in Inventory.">
              <input type="number" min="0" step="1" value={f.stock} onChange={set('stock')} placeholder="0" />
            </Field>
          </div>
        )}

        <div className="full">
          <Field label="Photo link (optional)" hint="A picture file in your public/products folder, like /products/coke.png. Without a photo, an icon for the category is shown.">
            <input value={f.image} onChange={set('image')} placeholder="/products/coke.png" />
          </Field>
        </div>

        {error && <div className="full admFormError" role="alert">{error}</div>}
      </form>
    </Modal>
  );
}

// page
export default function Products() {
  const { products, addProduct, updateProduct, setActive, deleteProduct, importProducts } = useProducts();
  const { settings } = useSettings();

  const [view, setView] = useState('active');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [form, setForm] = useState(null); // { product } | { } for new
  const [deleting, setDeleting] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);
  const activeCount = products.filter((p) => p.active).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => view === 'all' || (view === 'active' ? p.active : !p.active))
      .filter((p) => category === 'All' || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, view, query, category]);

  const handleSubmit = async (data) => {
    const result = await (form.product ? updateProduct(form.product.barcode, data) : addProduct(data));
    if (result.ok) {
      toast.success(form.product ? 'Product saved.' : 'Product added.');
      setForm(null);
    }
    return result;
  };

  const toggleArchive = async (p) => {
    const result = await setActive(p.barcode, !p.active);
    if (!result.ok) return toast.error(result.error);
    toast.info(p.active ? `${p.name} is hidden from the kiosk.` : `${p.name} is back on the kiosk.`);
  };

  const confirmDelete = async () => {
    const result = await deleteProduct(deleting.barcode);
    if (result.ok) toast.success(`${deleting.name} deleted.`);
    else toast.error(result.error);
    setDeleting(null);
  };

  const exportProducts = () => {
    downloadText(
      `products-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(products, [
        { key: 'barcode', label: 'barcode' }, { key: 'name', label: 'name' }, { key: 'price', label: 'price' },
        { key: 'cost', label: 'cost' }, { key: 'category', label: 'category' }, { key: 'stock', label: 'stock' },
        { key: 'critical', label: 'critical' },
      ])
    );
  };

  const onImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const rows2 = parseCSV(await file.text());
    if (!rows2.length) {
      toast.error('That file has no product rows. Download the template to see the format.');
      return;
    }
    setImportResult(await importProducts(rows2));
  };

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${activeCount} on the kiosk · set prices, costs and critical levels here.`}
        actions={
          <>
            <button className="admBtn" onClick={() => downloadText('products-template.csv', TEMPLATE)}>Template</button>
            <button className="admBtn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} /> Import CSV</button>
            <button className="admBtn" onClick={exportProducts}><Icon name="download" size={16} /> Export CSV</button>
            <button className="admBtn primary" onClick={() => setForm({})}>＋ Add product</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onImportFile} />
          </>
        }
      />

      <Card>
        <div className="admToolbar" style={{ marginBottom: 12 }}>
          <input className="grow" placeholder="Search name or barcode" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search products" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="All">All categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <Segmented
            label="Show"
            value={view}
            onChange={setView}
            options={[
              { value: 'active', label: 'Active', count: activeCount },
              { value: 'archived', label: 'Archived', count: products.length - activeCount },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon="tag"
            title={products.length ? 'No products match' : 'No products yet'}
            hint={products.length ? 'Try another search or filter.' : 'Add your first product to start selling.'}
            action={!products.length && <button className="admBtn primary" onClick={() => setForm({})}>＋ Add product</button>}
          />
        ) : (
          <div className="admTableWrap">
            <table className="admTable">
              <thead>
                <tr>
                  <th>Product</th><th>Category</th>
                  <th className="num">Price</th><th className="num">Cost</th><th className="num">Margin</th>
                  <th className="num">In stock</th><th className="num">Critical level</th>
                  <th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const m = marginOf(p.price, p.cost);
                  return (
                    <tr key={p.barcode}>
                      <td><ProdCell p={p} /></td>
                      <td>{p.category}</td>
                      <td className="num">{peso(p.price)}</td>
                      <td className="num">{peso(p.cost)}</td>
                      <td className="num">
                        {m == null ? '—' : (
                          <>
                            {m.toFixed(0)}%{m < 0 && <span className="admBad"> <Icon name="arrow-down" size={13} /></span>}
                          </>
                        )}
                      </td>
                      <td className="num">{int(p.stock)}</td>
                      <td className="num">{int(p.critical)}</td>
                      <td>{p.active ? <Badge tone="good">Active</Badge> : <Badge tone="neutral">Archived</Badge>}</td>
                      <td>
                        <div className="admRowActions">
                          <button className="admBtn sm" onClick={() => setForm({ product: p })}>Edit</button>
                          <button className="admBtn sm" onClick={() => toggleArchive(p)}>{p.active ? 'Archive' : 'Restore'}</button>
                          <button className="admBtn sm danger" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="admHint">Archived products are hidden from the kiosk but keep their sales history. Their stock is still counted here.</p>
      </Card>

      {form && (
        <ProductForm
          product={form.product}
          categories={categories}
          barcodes={products.map((p) => p.barcode)}
          defaultCritical={settings.defaultCritical}
          onSubmit={handleSubmit}
          onClose={() => setForm(null)}
        />
      )}

      {deleting && (
        <Modal
          title="Delete this product?"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button className="admBtn" onClick={() => setDeleting(null)}>Cancel</button>
              {deleting.active && (
                <button className="admBtn" onClick={() => { toggleArchive(deleting); setDeleting(null); }}>Archive instead</button>
              )}
              <button className="admBtn danger" onClick={confirmDelete}>Delete</button>
            </>
          }
        >
          <ProdCell p={deleting} />
          <p>
            This removes the product for good. Past orders keep its name and prices, but you will lose its stock count.
            If you might sell it again, <b>archive</b> it instead.
          </p>
        </Modal>
      )}

      {importResult && (
        <Modal
          title="Import finished"
          onClose={() => setImportResult(null)}
          footer={<button className="admBtn primary" onClick={() => setImportResult(null)}>Done</button>}
        >
          <p>
            <b>{importResult.added}</b> added · <b>{importResult.updated}</b> updated
            {importResult.errors.length > 0 && <> · <b>{importResult.errors.length}</b> skipped</>}
          </p>
          {importResult.errors.length > 0 && (
            <ul className="admInsights">
              {importResult.errors.slice(0, 8).map((er) => <li key={er}>{er}</li>)}
              {importResult.errors.length > 8 && <li>…and {importResult.errors.length - 8} more.</li>}
            </ul>
          )}
          <p className="admHint">Existing products are matched by barcode. Their stock is only changed if the file has a stock column.</p>
        </Modal>
      )}
    </>
  );
}
