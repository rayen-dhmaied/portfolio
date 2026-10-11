import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Rayen Dhmaied',
  tagline: 'Cloud & DevOps Engineer',
  favicon: 'img/logo.png',
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
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
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
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Rayen's Portfolio",
      logo: {
        alt: 'Logo',
        src: 'img/logo.png',
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
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
