/** Describes a database view mapped via toView() / hasViewSql() (P1-26). */
export interface ViewMetadata {
  viewName: string;
  viewSql?: string;
}
