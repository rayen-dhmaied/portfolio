import {useEffect, useRef, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useLayoutDocsSidebar} from '@docusaurus/plugin-content-docs/client';
import Layout from '@theme/Layout';
import homepage, {type IconData} from '@generated/homepage-data/default/homepage.json';
import highlights from '../../content/highlights.json';
import {
  SocialLinks,
  LinkedInIcon,
  GitHubIcon,
  EmailIcon,
  type SocialLink,
} from '@site/src/components/SocialLinks';
import styles from './index.module.css';

// Synthwave floor, drawn as plain SVG stretched to the hero width (viewBox 0 0 1440 320).
// The horizon stays at a fixed height; mountains are repeating tiles on top of it.
const HORIZON_Y = 70;
const FLOOR_VERTICALS = Array.from({length: 31}, (_, i) => i - 15).map((i) => ({x1: 720 + i * 26, x2: 720 + i * 190}));
const FLOOR_ROWS = 9;
const floorRow = (t: number) => ({y: HORIZON_Y + (320 - HORIZON_Y) * t ** 1.7, opacity: 0.3 + 0.55 * t});
// One extra row so a new line enters at the horizon as the last one leaves the bottom
const FLOOR_HORIZONTALS = Array.from({length: FLOOR_ROWS + 1}, (_, k) => floorRow(k / FLOOR_ROWS));

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Rolls the floor toward the viewer, one row every 2.4 s, only while the hero is on screen
function useRollingFloor(ref: React.RefObject<SVGGElement | null>) {
  useEffect(() => {
    const group = ref.current;
    if (!group || reducedMotion()) return undefined;
    const lines = Array.from(group.querySelectorAll('line'));
    let frame = 0;
    let visible = true;
    const start = performance.now();
    const tick = (now: number) => {
      const phase = ((now - start) / 2400) % 1;
      lines.forEach((line, k) => {
        const {y, opacity} = floorRow((k + phase) / FLOOR_ROWS);
        line.setAttribute('y1', String(y));
        line.setAttribute('y2', String(y));
        line.style.strokeOpacity = String(Math.min(opacity, 0.85));
      });
      if (visible) frame = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) frame = requestAnimationFrame(tick);
    });
    io.observe(group);
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
    };
  }, [ref]);
}

// Fades sections up as they scroll in; only for those below the fold at load, so nothing flashes
function useReveal() {
  useEffect(() => {
    if (reducedMotion()) return undefined;
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
      .filter((el) => el.getBoundingClientRect().top > window.innerHeight);
    targets.forEach((el) => el.classList.add(styles.hidden));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove(styles.hidden);
          io.unobserve(entry.target);
        }
      });
    }, {rootMargin: '0px 0px -10% 0px'});
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// 11x8 space invaders, drawn as pixels around the contact screen
const INVADERS = [
  ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'],
  ['....XXX....', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXX..X..XXX', 'XXXXXXXXXXX', '..XX...XX..', '.XX.XXX.XX.', 'XX.......XX'],
  ['...XXXXX...', '..XXXXXXX..', '.XX.XXX.XX.', '.XXXXXXXXX.', '...X...X...', '..X.XXX.X..', '.X.X...X.X.', '...........'],
];

// Decorative: the card text already names the project. Brand colors in icons.json are
// already adjusted for the dark background; icons without one use the ink color.
function Glyph({icon, size = 42, color}: {icon: IconData; size?: number; color?: string}) {
  const ink = color ?? icon.color ?? 'var(--c-ink)';
  const paint = icon.kind === 'stroke'
    ? {style: {stroke: ink}, fill: 'none', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const}
    : {style: {fill: ink}, fillRule: icon.evenodd ? ('evenodd' as const) : undefined};
  return (
    <svg viewBox={`0 0 ${icon.box} ${icon.box}`} width={size} height={size} aria-hidden="true">
      <g {...paint}>{icon.paths.map((d) => <path key={d} d={d} />)}</g>
    </svg>
  );
}

function Invader({rows, className}: {rows: string[]; className: string}) {
  return (
    <svg viewBox="0 0 11 8" className={className} aria-hidden="true" shapeRendering="crispEdges">
      {rows.flatMap((row, y) => [...row].map((c, x) => c === 'X' && <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />))}
    </svg>
  );
}

function SectionTitle({id, children}: {id?: string; children: ReactNode}) {
  return (
    <div className={styles.sectionTitleWrap} id={id} data-reveal>
      <h2 className={styles.sectionTitle}>{children}</h2>
      <svg className={styles.pacman} viewBox="0 0 64 16" aria-hidden="true">
        <path className={styles.pacOpen} d="M8 8 L15 3.5 A8 8 0 1 0 15 12.5 Z" />
        <path className={styles.pacShut} d="M8 8 L16 7.6 A8 8 0 1 0 16 8.4 Z" />
        <circle cx="28" cy="8" r="2" />
        <circle cx="40" cy="8" r="2" />
        <circle cx="52" cy="8" r="2" />
      </svg>
    </div>
  );
}

function splitTitle(title: string): [string, string] {
  const [name, ...rest] = title.split(' - ');
  return [name, rest.join(' - ')];
}

function useProfile() {
  const {siteConfig} = useDocusaurusContext();
  const fields = siteConfig.customFields as {email: string; linkedin: string; github: string; bio: string};
  return {
    ...siteConfig,
    bio: fields.bio,
    email: fields.email,
    emailUrl: `mailto:${fields.email}`,
    linkedinUrl: `https://linkedin.com/in/${fields.linkedin}`,
    githubUrl: `https://github.com/${fields.github}`,
  };
}

function Hero() {
  const profile = useProfile();
  // "Rayen Dhmaied": first name in neon script over the chrome surname; a one-word title is all chrome
  const [first, ...rest] = profile.title.split(' ');
  const script = rest.length > 0 ? first : '';
  const chrome = rest.length > 0 ? rest.join(' ') : first;
  const socialLinks: SocialLink[] = [
    {icon: <EmailIcon />, url: profile.emailUrl, label: 'Email'},
    {icon: <LinkedInIcon />, url: profile.linkedinUrl, label: 'LinkedIn'},
    {icon: <GitHubIcon />, url: profile.githubUrl, label: 'GitHub'},
  ];
  const rows = useRef<SVGGElement>(null);
  useRollingFloor(rows);
  // Same target as the navbar's Resume link
  const resumeHome = useLayoutDocsSidebar('resumeSidebar').link?.path ?? '/';

  return (
    <section className={styles.hero}>
      <div className={styles.sky} aria-hidden="true" />
      <div className={styles.heroInner}>
        <div className={styles.titleBlock}>
          <p className={styles.role} data-text={profile.tagline}>{profile.tagline}</p>
          <h1 className={styles.name}>
            {script && <span className={styles.script}>{script} </span>}
            <span className={styles.chrome} data-text={chrome}>{chrome}</span>
          </h1>
        </div>
        <p className={styles.bio}>{profile.bio}<span className={styles.cursor} aria-hidden="true">_</span></p>
        <div className={styles.actions}>
          <Link className={styles.btnPink} to="#selected-work">View projects</Link>
          <Link className={styles.btnCyan} to={resumeHome}>Resume</Link>
          <SocialLinks links={socialLinks} />
        </div>
      </div>

      <div className={styles.horizon} aria-hidden="true">
        <svg className={styles.floor} viewBox="0 0 1440 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hz-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2a0b3d" />
              <stop offset="1" style={{stopColor: 'var(--c-bg)'}} />
            </linearGradient>
            <radialGradient id="hz-glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" style={{stopColor: 'var(--c-pink)'}} stopOpacity="0.5" />
              <stop offset="1" style={{stopColor: 'var(--c-pink)'}} stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="720" cy={HORIZON_Y} rx="760" ry="70" fill="url(#hz-glow)" />
          <rect x="0" y={HORIZON_Y} width="1440" height={320 - HORIZON_Y} fill="url(#hz-floor)" />
          <g className={`${styles.gridLines} ${styles.verticals}`}>
            {FLOOR_VERTICALS.map(({x1, x2}) => <line key={x1} x1={x1} y1={HORIZON_Y} x2={x2} y2="320" />)}
          </g>
          <g className={styles.gridLines} ref={rows}>
            {FLOOR_HORIZONTALS.map(({y, opacity}, k) => <line key={k} x1="0" y1={y} x2="1440" y2={y} style={{strokeOpacity: opacity}} />)}
          </g>
          <line className={styles.horizonLine} x1="0" y1={HORIZON_Y} x2="1440" y2={HORIZON_Y} />
        </svg>
        <div className={styles.ridgeBack} />
        <div className={styles.ridgeFront} />
      </div>
    </section>
  );
}

function SelectedWork() {
  const {work, side} = homepage;
  useBrokenLinks().collectAnchor('selected-work');
  // Same target as the navbar's Projects link
  const projectsHome = useLayoutDocsSidebar('projectsSidebar', 'projects').link?.path ?? '/';
  return (
    <section className={styles.section}>
      <SectionTitle id="selected-work">Selected work</SectionTitle>
      <div className={styles.workGrid}>
        {work.map(({title, description, permalink, icons}) => {
          const [name, kind] = splitTitle(title);
          return (
            <Link key={permalink} to={permalink} className={styles.work} data-reveal>
              <div className={styles.screen}>
                {icons.map((icon) => <Glyph key={icon.name} icon={icon} />)}
              </div>
              <h3 className={styles.workName}>{name}</h3>
              {kind && <p className={styles.workKind}>{kind}</p>}
              <p className={styles.workDesc}>{description}</p>
              <span className={styles.workButton}>View project</span>
            </Link>
          );
        })}
        {side.length > 0 && (
          <div className={styles.work} data-reveal>
            <h3 className={`${styles.screen} ${styles.screenText}`}>Side projects</h3>
            <ul className={styles.sideList}>
              {side.map(({title, permalink}) => {
                const [name, kind] = splitTitle(title);
                return (
                  <li key={permalink}>
                    <Link to={permalink} className={styles.sideLink}>
                      <span className={styles.sideName}>{name}</span>
                      {kind && <span className={styles.sideKind}>{kind}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link className={styles.workButton} to={projectsHome}>All projects</Link>
          </div>
        )}
      </div>
    </section>
  );
}

function Numbers() {
  return (
    <section className={styles.section}>
      <SectionTitle>By the numbers</SectionTitle>
      <dl className={styles.numbers} data-reveal>
        {highlights.keyNumbers.map(({label, value}) => (
          <div key={label} className={styles.number}>
            <dt className={styles.numberLabel}>{label}</dt>
            <dd className={styles.numberValue} data-text={value}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Expertise() {
  return (
    <section className={styles.section}>
      <SectionTitle>Areas of expertise</SectionTitle>
      <div className={styles.expertiseGrid}>
        {highlights.expertises.map(({title, description, icon}) => (
          <div key={title} className={styles.expertise} data-reveal>
            <span className={styles.expertiseIcon}>
              <Glyph icon={homepage.expertiseIcons[icon] ?? homepage.expertiseIcons.backend} size={26} color="currentColor" />
            </span>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Contact() {
  const profile = useProfile();
  const spots = ['tl1', 'tl2', 'l1', 'l2', 'bl', 'tr1', 'tr2', 'r1', 'r2', 'br'];
  return (
    <section className={`${styles.section} ${styles.contact}`}>
      {spots.map((spot, i) => (
        <Invader key={spot} rows={INVADERS[i % INVADERS.length]} className={`${styles.invader} ${styles[spot]}`} />
      ))}
      <div className={styles.cabinet} data-reveal>
        <h2 className={styles.marquee}>Get in touch</h2>
        <div className={styles.crt}>
          <a href={profile.emailUrl}>{profile.email}</a>
          <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const profile = useProfile();
  useReveal();
  return (
    <Layout title={profile.tagline} description={profile.bio}>
      <main>
        <Hero />
        <SelectedWork />
        <Numbers />
        <Expertise />
        <Contact />
      </main>
    </Layout>
  );
}
