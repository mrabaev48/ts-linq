import type { SqlParameter } from '@ts-linq/types';

export interface ConditionFragment {
  condition: string;
  parameters: SqlParameter[];
}

export interface SqlFragment {
  fragment: string;
  params: SqlParameter[];
}
