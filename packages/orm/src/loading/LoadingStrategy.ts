export enum LoadingStrategy {
  Lazy = 'Lazy',
  Eager = 'Eager'
}

export interface LoadingOptions {
  strategy?: LoadingStrategy;
  includes?: string[];
  depth?: number;
}
