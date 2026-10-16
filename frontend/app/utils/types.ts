// Shapes returned by the Deno API.

export interface Language {
  code: string;
  nativeName: string;
  englishName: string;
}

export interface Category {
  id: string;
  label: string;
}

export interface Bootstrap {
  lang: string;
  languages: Language[];
  ui: Record<string, string>;
  categories: Category[];
}

export interface DocumentSummary {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  categoryLabel: string;
  icon: string;
  fee: string;
  time: string;
  popular: boolean;
  stepCount: number;
}

export interface Step {
  title: string;
  body: string;
  linkLabel: string | null;
  linkUrl: string | null;
}

export interface DocumentDetail extends DocumentSummary {
  issuer: string;
  mode: string;
  eligibility: string;
  requiredDocs: string[];
  tips: string[];
  steps: Step[];
  videos: { title: string; url: string }[];
  portalUrl: string;
  portalLabel: string;
  helpline: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface UserState {
  saved: string[];
  progress: Record<string, number[]>;
}
