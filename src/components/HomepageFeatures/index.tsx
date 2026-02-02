import type { ReactNode } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type ExpertiseItem = {
  title: string;
  description: string;
};

type KeyNumberItem = {
  label: string;
  value: string;
};

type ExpertisesProps = {
  expertises: ExpertiseItem[];
};

type KeyNumbersProps = {
  keyNumbers: KeyNumberItem[];
};

function Expertise({ title, description }: ExpertiseItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

function KeyNumber({ label, value }: KeyNumberItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={clsx('text--center padding-horiz--md', styles.keyNumber)}>
        <div className={styles.numberValue}>{value}</div>
        <div className={styles.numberLabel}>{label}</div>
      </div>
    </div>
  );
}

export function Expertises( { expertises }  : ExpertisesProps): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {expertises.map((props, idx) => (
            <Expertise key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function KeyNumbers( { keyNumbers } :  KeyNumbersProps): ReactNode {
  return (
    <section className={styles.keyNumbers}>
      <div className="container">
        <div className="row">
          {keyNumbers.map((props, idx) => (
            <KeyNumber key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}