import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Cloud Architecture',
    description: (
      <>
        Design and maintain cloud infrastructure that reliably supports applications
        at scale. Ensure high availability, fast recovery from failures, and clear
        visibility into system performance, while optimizing resource usage and costs.
      </>
    ),
  },
  {
    title: 'DevOps & Automation',
    description: (
      <>
        Automate deployments, infrastructure provisioning, and operational tasks
        to reduce manual work and errors. Enable teams to release features faster
        and with confidence by providing consistent, repeatable workflows.
      </>
    ),
  },
  {
    title: 'Backend & Platform Engineering',
    description: (
      <>
        Develop backend services and internal platforms that are reliable, maintainable,
        and efficient. Focus on building systems that help teams deliver products
        safely, handle growing traffic, and are easy to operate in production.
      </>
    ),
  },
];


function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
