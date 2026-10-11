// Written at build time by the homepage-data plugin in docusaurus.config.ts
declare module '@generated/homepage-data/default/homepage.json' {
  export type IconData = {
    name: string;
    box: number;
    paths: string[];
    kind: 'fill' | 'stroke';
    evenodd?: boolean;
    color?: string;
  };
  export type ProjectCard = {title: string; description: string; permalink: string; icons: IconData[]};
  const data: {
    work: ProjectCard[];
    side: {title: string; permalink: string}[];
    expertiseIcons: Record<string, IconData>;
  };
  export default data;
}
