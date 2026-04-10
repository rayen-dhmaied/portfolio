import type { ReactNode } from 'react';
import styles from './styles.module.css';

type ExpertiseItem = {
  title: string;
  description: string;
  icon?: string;
};

type KeyNumberItem = {
  label: string;
  value: string;
};

type ExpertisesProps = { expertises: ExpertiseItem[] };
type KeyNumbersProps = { keyNumbers: KeyNumberItem[] };

const expertiseIcons: Record<string, ReactNode> = {
  cloud: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
    </svg>
  ),
  automation: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
  backend: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M20 6h-2.18c.07-.44.18-.88.18-1.33C18 2.54 15.96.5 13.5.5c-1.37 0-2.61.59-3.5 1.53C9.11 1.09 7.87.5 6.5.5 4.04.5 2 2.54 2 4.67c0 .46.11.89.18 1.33H0v14h20V6zm-7.5-4c1.38 0 2.5 1.12 2.5 2.5S13.88 7 12.5 7H11V5.5c0-1.38 1.12-2.5 2.5-2.5zM6.5 2C7.88 2 9 3.12 9 4.5V6H7.5C6.12 6 5 4.88 5 3.5S5.12 2 6.5 2zM2 8h7v10H2V8zm9 10V8h7v10h-7z"/>
    </svg>
  ),
};

function ExpertiseCard({ title, description, icon }: ExpertiseItem) {
  return (
    <div className={styles.expertiseCard}>
      <div className={styles.expertiseIconWrap}>
        {icon && expertiseIcons[icon] ? expertiseIcons[icon] : expertiseIcons.backend}
      </div>
      <div>
        <h3 className={styles.expertiseTitle}>{title}</h3>
        <p className={styles.expertiseDesc}>{description}</p>
      </div>
    </div>
  );
}

function StatRow({ label, value }: KeyNumberItem) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

export function Expertises({ expertises }: ExpertisesProps): ReactNode {
  return (
    <section className={styles.expertisesSection}>
      <div className={styles.sectionLabel}>Areas of expertise</div>
      <div className={styles.expertiseList}>
        {expertises.map((item, idx) => (
          <ExpertiseCard key={idx} {...item} />
        ))}
      </div>
    </section>
  );
}

export function KeyNumbers({ keyNumbers }: KeyNumbersProps): ReactNode {
  return (
    <section className={styles.statsSection}>
      <div className={styles.sectionLabel}>By the numbers</div>
      <div className={styles.statsList}>
        {keyNumbers.map((item, idx) => (
          <StatRow key={idx} {...item} />
        ))}
      </div>
    </section>
  );
}