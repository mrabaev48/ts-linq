import type { SaveContext, SavePipelineDeps, SaveStep } from './SavePipeline.types';
import {
  BuildEventDataStep,
  DetectChangesStep,
  PrefillDefaultsStep,
  PrefillIdsStep,
  SavingInterceptorsStep,
  TransactionalExecutionStep,
  ValidateStep
} from './saveSteps';

/**
 * Orchestrates `DbContext.saveChanges` as an ordered sequence of {@link SaveStep}s
 * over a {@link SaveContext} (Pipeline / Chain of Responsibility).
 *
 * Step order: DetectChanges → PrefillIds → PrefillDefaults → Validate →
 * BuildEventData → SavingInterceptors → TransactionalExecution. A step may set
 * `ctx.done` to short-circuit (empty change set, or `savingChanges` suppression).
 *
 * @internal
 */
export class SaveChangesPipeline {
  private readonly steps: readonly SaveStep[] = [
    new DetectChangesStep(),
    new PrefillIdsStep(),
    new PrefillDefaultsStep(),
    new ValidateStep(),
    new BuildEventDataStep(),
    new SavingInterceptorsStep(),
    new TransactionalExecutionStep()
  ];

  constructor(private readonly deps: SavePipelineDeps) {}

  /** Execute the pipeline and return the affected-row count. */
  async run(): Promise<number> {
    const ctx: SaveContext = {
      changes: [],
      normalizedForInvalidation: [],
      eventData: { entityCount: 0, entries: [] },
      interceptors: [],
      result: 0,
      done: false
    };

    for (const step of this.steps) {
      if (ctx.done) break;
      await step.execute(ctx, this.deps);
    }

    return ctx.result;
  }
}
