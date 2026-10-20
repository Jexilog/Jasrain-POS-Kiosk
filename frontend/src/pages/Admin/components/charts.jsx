import React, { useEffect, useRef, useState } from 'react';
import Icon, { categoryIconName } from '../../../components/Icon';

// helpers
function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function niceMax(v) {
  if (!(v > 0)) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

// bar with rounded top corners only (square at the baseline)
function topRounded(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

// legend
export function Legend({ series }) {
  if (!series || series.length < 2) return null; // one series: the title already says it
  return (
    <ul className="admLegend">
      {series.map((s) => (
        <li key={s.key}>
          <span className="admLegendSwatch" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

// vertical bars (single or stacked)
// data: [{ key, axis, title, values: { seriesKey: number } }]
export function BarChart({
  data,
  series,
  height = 240,
  tickFormat,
  valueFormat,
  emphasisIndex = null,
  ariaLabel,
  tableTitle = 'Day',
  allowTable = true,
}) {
  const [wrapRef, w] = useWidth();
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);

  const width = Math.max(w, 260);
  const m = { l: 46, r: 8, t: 10, b: 26 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const n = data.length;

  const totals = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] || 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  const y = (v) => m.t + ih - (v / max) * ih;

  const slot = n ? iw / n : iw;
  const barW = Math.max(2, Math.min(24, slot * 0.7));
  const labelEvery = Math.max(1, Math.ceil(54 / Math.max(slot, 1)));

  const onKey = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setHover((h) => (h == null ? 0 : Math.min(n - 1, h + 1)));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setHover((h) => (h == null ? n - 1 : Math.max(0, h - 1)));
    } else if (e.key === 'Escape') setHover(null);
  };

  const tipLeft = hover == null ? 0 : Math.min(Math.max(m.l + slot * (hover + 0.5), 90), width - 90);

  return (
    <div className="admChart">
      <div className="admChartTop">
        <Legend series={series} />
        {allowTable && (
          <div className="admViewToggle" role="group" aria-label="Show as">
            <button type="button" className={!asTable ? 'active' : ''} aria-pressed={!asTable} onClick={() => setAsTable(false)}>
              <Icon name="chart" size={15} /> Chart
            </button>
            <button type="button" className={asTable ? 'active' : ''} aria-pressed={asTable} onClick={() => setAsTable(true)}>
              <Icon name="table" size={15} /> Table
            </button>
          </div>
        )}
      </div>

      {asTable ? (
        <div className="admTableWrap short">
          <table className="admTable compact">
            <thead>
              <tr>
                <th>{tableTitle}</th>
                {series.map((s) => <th key={s.key} className="num">{s.label}</th>)}
                {series.length > 1 && <th className="num">Total</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.key}>
                  <td>{d.title}</td>
                  {series.map((s) => <td key={s.key} className="num">{valueFormat(d.values[s.key] || 0)}</td>)}
                  {series.length > 1 && <td className="num"><b>{valueFormat(totals[i])}</b></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admChartBox" ref={wrapRef}>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={ariaLabel}
            tabIndex={0}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'admAxis' : 'admGrid'} />
                <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="admTickText">{tickFormat(t)}</text>
              </g>
            ))}

            {data.map((d, i) => {
              const cx = m.l + slot * (i + 0.5);
              const x = cx - barW / 2;
              let acc = 0;
              const parts = series
                .map((s) => ({ s, v: d.values[s.key] || 0 }))
                .filter((p) => p.v > 0);
              const dim = emphasisIndex != null && emphasisIndex !== i;

              return (
                <g key={d.key}>
                  {hover === i && (
                    <rect x={m.l + slot * i} y={m.t} width={slot} height={ih} className="admHoverBand" />
                  )}
                  {parts.map((p, idx) => {
                    const h = Math.max(1.5, (p.v / max) * ih);
                    const top = m.t + ih - acc - h;
                    const isTop = idx === parts.length - 1;
                    const gap = idx > 0 ? 2 : 0; // 2px of surface between stacked segments
                    const hh = Math.max(1, h - gap);
                    acc += h;
                    const common = { fill: p.s.color, opacity: dim ? 0.4 : 1 };
                    return isTop ? (
                      <path key={p.s.key} d={topRounded(x, top, barW, hh, 4)} {...common} />
                    ) : (
                      <rect key={p.s.key} x={x} y={top} width={barW} height={hh} {...common} />
                    );
                  })}
                  {i % labelEvery === 0 && (
                    <text x={cx} y={height - 8} textAnchor="middle" className="admTickText">{d.axis}</text>
                  )}
                  <rect
                    x={m.l + slot * i}
                    y={m.t}
                    width={slot}
                    height={ih}
                    fill="transparent"
                    onPointerEnter={() => setHover(i)}
                    onPointerMove={() => setHover(i)}
                  />
                </g>
              );
            })}
          </svg>

          {hover != null && data[hover] && (
            <div className="admTip" style={{ left: tipLeft, top: 4 }} role="status">
              <div className="admTipTitle">{data[hover].title}</div>
              {series.map((s) => (
                <div className="admTipRow" key={s.key}>
                  <span className="admTipKey" style={{ background: s.color }} />
                  <b>{valueFormat(data[hover].values[s.key] || 0)}</b>
                  <span>{s.label}</span>
                </div>
              ))}
              {series.length > 1 && (
                <div className="admTipRow total"><b>{valueFormat(totals[hover])}</b><span>Total</span></div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// horizontal bars (ranking / breakdown)
// rows: [{ key, label, value, note?, category? }]
export function HBars({ rows, format, color = 'var(--series-1)', max, emptyText = 'No data yet.' }) {
  if (!rows.length) return <p className="admMuted admPad">{emptyText}</p>;
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="admHBars">
      {rows.map((r) => (
        <li key={r.key ?? r.label} className="admHBar" title={`${r.label}: ${format(r.value)}${r.note ? ` · ${r.note}` : ''}`}>
          <span className="admHBarLabel">
            {r.category && <Icon name={categoryIconName(r.category)} size={15} className="admHbIcon" />}
            {r.label}
          </span>
          <span className="admHBarTrack">
            <span
              className="admHBarFill"
              style={{ width: `${Math.max(1.5, (r.value / top) * 100)}%`, background: r.color || color }}
            />
          </span>
          <span className="admHBarValue">
            <b>{format(r.value)}</b>
            {r.note && <span className="admHBarNote">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// stock meter
export function StockMeter({ stock, critical }) {
  const out = stock <= 0;
  const low = !out && stock <= critical;
  const full = Math.max(critical * 3, 1);
  const pct = Math.min(100, (stock / full) * 100);
  return (
    <span className={`admMeter ${out ? 'critical' : low ? 'warn' : 'good'}`} aria-hidden="true">
      <span className="admMeterFill" style={{ width: `${pct}%` }} />
    </span>
  );
}
