/**
 * Areas of work shown in the horizontal card strip.
 * The images are abstract placeholders — swap them for real artwork/screenshots in public/works/.
 */
export interface Project {
  client: string;
  year: string;
  color: string;
  image: string;
  url: string;
}

const base = import.meta.env.BASE_URL;

export const projects: Project[] = [
  { client: 'Data annotation & QA', year: 'Present', color: '#c9b8ff', image: `${base}works/work-1.svg`, url: '#contact' },
  { client: 'Digital illustration', year: 'NC III', color: '#ffb4a2', image: `${base}works/work-2.svg`, url: '#contact' },
  { client: 'Visual asset creation', year: 'Design', color: '#9ad1c4', image: `${base}works/work-3.svg`, url: '#contact' },
  { client: 'Site mapping & documentation', year: 'OJT', color: '#f4d35e', image: `${base}works/work-4.svg`, url: '#contact' },
  { client: 'Bookkeeping & records', year: 'OJT', color: '#8fb8ff', image: `${base}works/work-5.svg`, url: '#contact' },
];
