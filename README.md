# Synthwave Docs Portfolio

This project is a **documentation-first personal portfolio built with Docusaurus**, created to reflect how I work as a Cloud and DevOps Engineer. It combines synthwave-inspired aesthetics with clean, well-organized documentation to showcase projects, experience, and writing in a structured, maintainable way.


## Content Structure

All portfolio content lives in the `content` directory:

```text    
.
├── docusaurus.config.ts
└── content
    ├── blog
    │   ├── authors.yml
    │   ├── tags.yml
    │   └── welcome.md
    ├── highlights.json
    ├── projects
    │   └── intro.md
    └── resume
        ├── certifications.md
        ├── education.md
        ├── experience.md
        ├── images
        ├── profile.md
        └── skills.md
```

### Modifying Content

To update portfolio content and personal information, you only need to edit `docusauurs.config.ts` and the files inside the `content` directory.

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