function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : text.padEnd(width, " ");
}

function repeat(char, width) {
  return char.repeat(width);
}

export function formatCurrencyPerMillion(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  return `$${value.toFixed(2)}/1M`;
}

export function formatLatencySeconds(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  return `${value.toFixed(2)}s`;
}

export function formatPercent(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  return `${value.toFixed(1)}%`;
}

export function formatInteger(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  return new Intl.NumberFormat("en-US").format(value);
}

export function renderTable(rows, columns) {
  if (rows.length === 0) {
    return "No results.";
  }

  const widths = columns.map((column) => {
    const values = rows.map((row) => {
      const resolved = typeof column.value === "function" ? column.value(row) : row[column.key];
      return String(resolved ?? "");
    });
    return Math.max(column.label.length, ...values.map((value) => value.length));
  });

  const header = columns.map((column, index) => pad(column.label, widths[index])).join("  ");
  const divider = widths.map((width) => repeat("-", width)).join("  ");
  const body = rows.map((row) =>
    columns
      .map((column, index) => {
        const value = typeof column.value === "function" ? column.value(row) : row[column.key];
        return pad(value ?? "", widths[index]);
      })
      .join("  "),
  );

  return [header, divider, ...body].join("\n");
}

export function renderKeyValueBlock(entries) {
  const width = Math.max(...entries.map(([label]) => label.length));
  return entries.map(([label, value]) => `${pad(label, width)}  ${value}`).join("\n");
}
