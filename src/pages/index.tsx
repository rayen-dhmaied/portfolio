import type {ReactNode} from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import {Expertises, KeyNumbers} from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';
import highlights from '../../content/highlights.json';
import { SocialLinks, LinkedInIcon, GitHubIcon, EmailIcon, type SocialLink } from '@site/src/components/SocialLinks';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();

  // Configure your social links here
  const socialLinks: SocialLink[] = [
      {
        icon: <EmailIcon />,
        url: `mailto:${siteConfig.customFields?.email}`,
        label: 'Email'
      },
      {
        icon: <LinkedInIcon />,
        url: `https://linkedin.com/in/${siteConfig.customFields?.linkedin}`,
        label: 'LinkedIn'
      },
      {
        icon: <GitHubIcon />,
        url: `https://github.com/${siteConfig.customFields?.github}`,
        label: 'GitHub'
      }
  ];
  
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <SocialLinks links={socialLinks} />
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.tagline}`}
      description={`${siteConfig.title}'s Blog and Portfolio`}>
      <HomepageHeader />
      <main>
        <section className={styles.contentSection}>
          <KeyNumbers keyNumbers={highlights.keyNumbers} />
        </section>
        
        <div className={styles.sectionSeparator} />
        
        <section className={styles.contentSection}>
          <Expertises expertises={highlights.expertises} />
        </section>
      </main>
    </Layout>
  );
}