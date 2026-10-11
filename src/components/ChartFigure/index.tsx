import {useEffect, useRef, useState, type ReactNode} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

// Shapes written by the chart generator
type TipRow = [value: string, label: string, color: string | null, dashed: boolean];
type Tip = {t: string; r: TipRow[]};
type Table = {columns: string[]; rows: (string | number)[][]};

type Props = {
  children: ReactNode;
  table?: Table;
};

const parseTip = (el: Element): Tip | null => {
  try {
    return JSON.parse(el.getAttribute('data-tip') ?? '') as Tip;
  } catch {
    return null;
  }
};

const NEXT: Record<string, number> = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1};

// Wraps an inline chart SVG: hit targets carrying data-tip get a tooltip on hover,
// tap and keyboard focus, and the chart's data is available as a table. The chart
// is one tab stop; arrow keys, Home and End move between its points, Escape hides
// the tooltip. Screen readers get each point's values from its aria-label.
export default function ChartFigure({children, table}: Props): ReactNode {
  const figure = useRef<HTMLElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{data: Tip; x: number; y: number; flip: boolean} | null>(null);

  useEffect(() => {
    const root = plot.current;
    const frame = figure.current;
    if (!root || !frame) return undefined;
    const targets = Array.from(root.querySelectorAll<SVGElement>('[data-tip]'));
    const tips = new Map<Element, Tip>();
    targets.forEach((el, i) => {
      const data = parseTip(el);
      el.setAttribute('tabindex', i === 0 ? '0' : '-1');
      el.setAttribute('role', 'img');
      if (!data) return;
      tips.set(el, data);
      el.setAttribute('aria-label', `${data.t}: ${data.r.map(([v, l]) => `${l} ${v}`).join(', ')}`);
    });

    // The tooltip sits in the figure, outside the plot, so a plot that scrolls
    // sideways on phones can't clip it; x and y are relative to the figure
    const show = (el: Element, clientX: number, clientY: number) => {
      const data = tips.get(el);
      const box = frame.getBoundingClientRect();
      const x = clientX - box.left;
      setTip(data ? {data, x, y: clientY - box.top, flip: x > box.width * 0.6} : null);
    };
    const onPointer = (e: PointerEvent) => {
      const el = (e.target as Element).closest('[data-tip]');
      if (el) show(el, e.clientX, e.clientY);
      else setTip(null);
    };
    const onFocus = (e: FocusEvent) => {
      const el = (e.target as Element).closest?.('[data-tip]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      show(el, r.left + r.width / 2, r.top + r.height / 3);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTip(null);
        return;
      }
      const i = targets.indexOf(e.target as SVGElement);
      if (i < 0) return;
      const j = e.key === 'Home' ? 0 : e.key === 'End' ? targets.length - 1 : i + (NEXT[e.key] ?? 0);
      if (j === i || j < 0 || j >= targets.length) return;
      e.preventDefault();
      targets[i].setAttribute('tabindex', '-1');
      targets[j].setAttribute('tabindex', '0');
      targets[j].focus();
    };
    const hide = () => setTip(null);

    root.addEventListener('pointermove', onPointer);
    root.addEventListener('pointerdown', onPointer);
    root.addEventListener('pointerleave', hide);
    root.addEventListener('focusin', onFocus);
    root.addEventListener('focusout', hide);
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('pointermove', onPointer);
      root.removeEventListener('pointerdown', onPointer);
      root.removeEventListener('pointerleave', hide);
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('focusout', hide);
      root.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <figure ref={figure} className={clsx('diagram', styles.chart)}>
      <div ref={plot} className={styles.plot}>
        {children}
      </div>
      {tip && (
        <div
          className={clsx(styles.tooltip, tip.flip && styles.flip)}
          style={{left: tip.x, top: tip.y}}
          aria-hidden="true">
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
