import type { EntityLoader } from '../loading/EntityLoader';
export declare class IncludePlanner<T> {
  private readonly entityLoader;
  private readonly entityClass;
  constructor(entityLoader: EntityLoader | undefined, entityClass: new () => T);
  populateIncludes(entities: T[], includes: string[], limit?: number): Promise<void>;
}
//# sourceMappingURL=IncludePlanner.d.ts.map
