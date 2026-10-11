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


## Deployment

Every push to `main` builds the site and publishes it to the `gh-pages` branch through GitHub Actions (`.github/workflows/publish-gh-pages.yml`).
