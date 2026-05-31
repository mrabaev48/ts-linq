/** Thrown when a mutation (add/update/remove) is attempted on a keyless entity (P1-26). */
export class KeylessMutationError extends Error {
  constructor(entityName: string, operation: string) {
    super(
      `Cannot ${operation} keyless entity '${entityName}'. Keyless entities are read-only and cannot be tracked or mutated.`
    );
    this.name = 'KeylessMutationError';
  }
}
