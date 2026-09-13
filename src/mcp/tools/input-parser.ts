/**
 * Parse a single-string CLI input into an array of arguments.
 *
 * - Splits on whitespace, except when characters are wrapped in matching
 *   single (`'`) or double (`"`) quotes.
 * - Quote characters are preserved in the output (they are part of the arg).
 * - Handles escaped quotes inside quoted strings (`\"` and `\'`).
 *
 * @param input The raw command string supplied by the user.
 * @returns An array of parsed argument strings.
 */
export function parseArguments(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuote: string | null = null;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }

    if (inQuote !== null && ch === inQuote) {
      inQuote = null;
      continue;
    }

    if ((ch === '"' || ch === "'") && inQuote === null) {
      inQuote = ch;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      if (inQuote !== null) {
        current += ch;
      } else if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}
