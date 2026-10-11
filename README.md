# Docs Portfolio

This project is a **documentation-first personal portfolio built with Docusaurus**, created to reflect how I work as a Cloud and DevOps Engineer. It's a well-organized documentation to showcase projects, experience, and writing in a structured, maintainable way.


## Content Structure

All portfolio content lives in these files:

```text
.
├── docusaurus.config.ts      # name, tagline, bio, social links
└── content
    ├── highlights.json       # homepage stats and expertise cards
    ├── blog
    │   ├── authors.yml
    │   └── <date>-<slug>.md  # or <date>-<slug>/index.md with its images
    ├── projects
    │   ├── work-projects
    │   └── side-projects
    └── resume
        ├── skills.md
        ├── experience.md
        ├── education.md
        └── certifications    # index.md and badge images
```

A page with images lives in its own folder as `index.md`, with the images next to it.

The homepage project cards are built from the project pages: their title, description and `sidebar_position` (the order), and the logos of their first four tags that have one (`TAG_ICONS` in `docusaurus.config.ts`).

### Modifying Content

To update portfolio content and personal information, you only need to edit `docusaurus.config.ts` and the files inside the `content` directory.

## Installation

```bash
npm install
```

Install project dependencies.


## Local Development

```bash
npm run start
```

Starts a local development server with live reload.


## Build

```bash
npm run build
```

Generates static files in the `build` directory for static hosting.


## Type Check

```bash
npm run typecheck
```

Runs the TypeScript compiler over the site code without emitting files.


## Diagrams

The architecture diagrams on the project pages and the figures in the k6 blog post are generated SVGs, committed next to the pages that use them (the generator itself is kept outside the repo).

Pages import them as inline SVG, so their colors and fonts come from the `--dg-*` variables in `src/css/custom.css`: change those to restyle every diagram. Brand logos use the colors in `src/data/icons.json`, adjusted where the official color is too dark for the site's dark cards.

Charts are wrapped in `<ChartFigure>` (`src/components/ChartFigure`), which adds hover and keyboard tooltips. The chart series colors (`--dg-series-*`) were checked for color-blind safety as a set; check them again if you change them.


## Deployment

Every push to `main` builds the site and publishes it to the `gh-pages` branch through GitHub Actions (`.github/workflows/publish-gh-pages.yml`).
