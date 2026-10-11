import fs from 'node:fs';
import path from 'node:path';
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config, Plugin} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// Brand and UI glyphs, also read by the (local) diagram generator
const ICONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/icons.json'), 'utf8'));
const TAG_ICONS: Record<string, string> = {
  aws: 'aws-cloud', eks: 'aws-eks', ec2: 'aws-ec2', s3: 'aws-s3', kubernetes: 'kubernetes', argocd: 'argo',
  helm: 'helm', prometheus: 'prometheus', grafana: 'grafana', python: 'python', go: 'go', flask: 'flask',
  react: 'react', firebase: 'firebase', stripe: 'stripe', claude: 'claude', postgresql: 'postgresql',
  redis: 'redis', istio: 'istio', keycloak: 'keycloak', mongodb: 'mongodb', neo4j: 'neo4j',
  'github actions': 'githubactions', celery: 'celery', nginx: 'nginx',
};
// highlights.json icon keys → glyphs
const EXPERTISE_ICONS: Record<string, string> = {cloud: 'cloud', automation: 'git-branch', backend: 'stack-2'};

function glyph(name: string, key: string) {
  const {box, paths, kind, evenodd, color} = ICONS[key];
  return {name, box, paths, kind, evenodd, color};
}

// Writes the project cards and glyphs the homepage needs to a generated JSON file
// (imported only by the homepage, unlike global data which ships with every page),
// so the "Selected work" grid always matches the project pages.
function homepageData(): Plugin {
  return {
    name: 'homepage-data',
    async allContentLoaded({allContent, actions}) {
      const docs = (allContent['docusaurus-plugin-content-docs'] as any).projects.loadedVersions[0].docs;
      const inSection = (prefix: string) => docs
        .filter((d: any) => d.id.startsWith(prefix))
        .sort((a: any, b: any) => (a.sidebarPosition ?? 99) - (b.sidebarPosition ?? 99));
      const expertiseIcons = Object.fromEntries(
        Object.entries(EXPERTISE_ICONS).map(([key, icon]) => [key, glyph(key, icon)]),
      );
      await actions.createData('homepage.json', JSON.stringify({
        work: inSection('work-projects/').map((d: any) => ({
          title: d.title,
          description: d.description,
          permalink: d.permalink,
          icons: (d.frontMatter.tags ?? [])
            .filter((t: string) => ICONS[TAG_ICONS[t.toLowerCase()]])
            .slice(0, 4)
            .map((t: string) => glyph(t, TAG_ICONS[t.toLowerCase()])),
        })),
        // The side projects card only lists names
        side: inSection('side-projects/').map((d: any) => ({title: d.title, permalink: d.permalink})),
        expertiseIcons,
      }));
    },
  };
}

const config: Config = {
  title: 'Rayen Dhmaied',
  tagline: 'Cloud & DevOps Engineer',
  favicon: 'img/logo-64.png',
  customFields: {
    github: 'rayen-dhmaied',
    linkedin: 'rayen-dhmaied',
    email: 'rayen.dhmaied@horizon-tech.tn',
    bio: 'I build and run cloud infrastructure, and write the backend that runs on it.',
  },

  future: {
    v4: true,
  },

  url: 'https://rayen-dhmaied.github.io',
  baseUrl: '/portfolio/',
  organizationName: 'rayen-dhmaied',
  projectName: 'portfolio',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        gtag: {
          trackingID: 'G-J1PJP1SJ02',
        },
        docs: false,
        blog: {
          path: './content/blog',
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: ['./src/css/fonts.css', './src/css/custom.css'],
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    homepageData,
    [
      '@docusaurus/plugin-content-docs',
      {
        path: './content/resume',
        routeBasePath: 'resume',
        sidebarPath: './sidebars/resume.ts',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'projects',
        path: './content/projects',
        routeBasePath: 'projects',
        sidebarPath: './sidebars/projects.ts',
      },
    ],
  ],
  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "Rayen's Portfolio",
      logo: {
        alt: 'Rayen Dhmaied',
        src: 'img/logo-64.png',
        width: 30,
        height: 30,
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'resumeSidebar',
          position: 'right',
          label: 'Resume',
        },
        {
          type: 'docSidebar',
          sidebarId: 'projectsSidebar',
          position: 'right',
          label: 'Projects',
          docsPluginId: 'projects',
        },
        {
          to: '/blog',
          label: 'Blog',
          position: 'right',
        },
      ],
    },
    footer: {
      copyright: `Copyright © ${new Date().getFullYear()} Built by Rayen Dhmaied.`,
    },
    prism: {
      theme: prismThemes.synthwave84,
      darkTheme: prismThemes.synthwave84,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
