import {useEffect, useRef, useState, type ReactNode} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

// Shapes written by scripts/diagrams/chartkit.py
type TipRow = [value: string, label: string, color: string | null, dashed: boolean];
type Tip = {t: string; r: TipRow[]};
type Table = {columns: string[]; rows: (string | number)[][]};

type Props = {
  children: ReactNode;
  table?: Table;
};

// Wraps an inline chart SVG: hit targets carrying data-tip get a tooltip on hover
// and keyboard focus, and the chart's data is available as a table.
export default function ChartFigure({children, table}: Props): ReactNode {
  const plot = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{data: Tip; x: number; y: number; flip: boolean} | null>(null);

  useEffect(() => {
    const root = plot.current;
    if (!root) return undefined;
    root.querySelectorAll('[data-tip]').forEach((el) => el.setAttribute('tabindex', '0'));

    const show = (el: Element, x: number, y: number) => {
      try {
        const data = JSON.parse(el.getAttribute('data-tip') ?? '') as Tip;
        setTip({data, x, y, flip: x > root.clientWidth * 0.6});
      } catch {
        setTip(null);
      }
    };
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element).closest('[data-tip]');
      if (!el) {
        setTip(null);
        return;
      }
      const box = root.getBoundingClientRect();
      show(el, e.clientX - box.left + root.scrollLeft, e.clientY - box.top);
    };
    const onFocus = (e: FocusEvent) => {
      const el = (e.target as Element).closest?.('[data-tip]');
      if (!el) return;
      const box = root.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      show(el, r.left + r.width / 2 - box.left + root.scrollLeft, r.top + r.height / 3 - box.top);
    };
    const hide = () => setTip(null);

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', hide);
    root.addEventListener('focusin', onFocus);
    root.addEventListener('focusout', hide);
    return () => {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', hide);
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('focusout', hide);
    };
  }, []);

  return (
    <figure className={clsx('diagram', styles.chart)}>
      <div ref={plot} className={styles.plot}>
        {children}
        {tip && (
          <div
            className={clsx(styles.tooltip, tip.flip && styles.flip)}
            style={{left: tip.x, top: tip.y}}
            role="status">
            <div className={styles.tipTitle}>{tip.data.t}</div>
            {tip.data.r.map(([value, label, color, dashed]) => (
              <div className={styles.row} key={label}>
                <span
                  className={styles.key}
                  style={color ? {borderTopColor: color, borderTopStyle: dashed ? 'dashed' : 'solid'} : {borderTopColor: 'transparent'}}
                />
                <span className={styles.value}>{value}</span>
                <span className={styles.label}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {table && (
        <details className={styles.data}>
          <summary>Data table</summary>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  {table.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
