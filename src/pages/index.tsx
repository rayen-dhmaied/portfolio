import type { ReactNode } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { Expertises, KeyNumbers } from '@site/src/components/HomepageFeatures';
import highlights from '../../content/highlights.json';
import {
  SocialLinks,
  LinkedInIcon,
  GitHubIcon,
  EmailIcon,
  type SocialLink,
} from '@site/src/components/SocialLinks';
import styles from './index.module.css';

function AvailableBadge() {
  return (
    <div className={styles.availableBadge}>
      <span className={styles.availableDot} />
      <span className={styles.availableText}>Available for work</span>
    </div>
  );
}

function HomepageLeft() {
  const { siteConfig } = useDocusaurusContext();

  const socialLinks: SocialLink[] = [
    { icon: <EmailIcon />, url: `mailto:${siteConfig.customFields?.email}`, label: 'Email' },
    { icon: <LinkedInIcon />, url: `https://linkedin.com/in/${siteConfig.customFields?.linkedin}`, label: 'LinkedIn' },
    { icon: <GitHubIcon />, url: `https://github.com/${siteConfig.customFields?.github}`, label: 'GitHub' },
  ];

  return (
    <div className={styles.heroLeft}>
      <AvailableBadge />
      <h1 className={styles.heroName}>
        {siteConfig.title}
      </h1>
      <p className={styles.heroRole}>{siteConfig.tagline}</p>
      <p className={styles.heroBio}>
        {String(siteConfig.customFields?.bio ?? '')}
      </p>

      <SocialLinks links={socialLinks} />
    </div>
  );
}

function HomepageRight() {
  return (
    <div className={styles.heroRight}>
      <KeyNumbers keyNumbers={highlights.keyNumbers} />
      <Expertises expertises={highlights.expertises} />
    </div>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.tagline}
      description={`${siteConfig.title}'s Portfolio`}
    >
      <main className={styles.main}>
        <div className={styles.splitLayout}>
          <HomepageLeft />
          <HomepageRight />
        </div>
      </main>
    </Layout>
  );
}