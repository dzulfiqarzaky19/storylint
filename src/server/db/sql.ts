// Timestamps are timestamptz in the database and epoch milliseconds in the app.
export const epochMs = (column: string): string =>
  `(extract(epoch FROM ${column}) * 1000)::double precision`;

export const fromEpochMs = (param: string): string =>
  `to_timestamp(${param}::double precision / 1000)`;
