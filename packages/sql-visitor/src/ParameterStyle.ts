export enum ParameterStyle {
  Question   = 'question',    // MySQL / SQLite: ?
  Positional = 'positional',  // PostgreSQL:     $1, $2, ...
  Named      = 'named',       // MSSQL:          @p1, @p2, ...
}

export class ParameterState {
  private counter = 0;
  constructor(private readonly style: ParameterStyle) {}

  next(): string {
    this.counter++;
    switch (this.style) {
      case ParameterStyle.Question:   return '?';
      case ParameterStyle.Positional: return `$${this.counter}`;
      case ParameterStyle.Named:      return `@p${this.counter}`;
    }
  }
}
