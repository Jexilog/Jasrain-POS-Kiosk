import React, { useState } from 'react';
import { ProductIcon } from '../../../components/Icon';

// Small picture (or a category icon) + name + barcode, used in every product table.
export function Thumb({ p }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="admProdThumb" aria-hidden="true">
      {p.image && !failed ? <img src={p.image} alt="" onError={() => setFailed(true)} /> : <ProductIcon product={p} size={20} />}
    </span>
  );
}

export default function ProdCell({ p, sub }) {
  return (
    <div className="admProdCell">
      <Thumb p={p} />
      <div>
        <div className="admProdName">{p.name}</div>
        <div className="admProdSub">{sub ?? p.barcode}</div>
      </div>
    </div>
  );
}
