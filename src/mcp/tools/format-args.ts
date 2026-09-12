/**
 * Output a pretty, stringified list of the parsed arguments.
 *
 * Each argument is printed on its own line, prefixed with an index
 * and wrapped in single quotes so the output is immediately readable.
 *
 * @param args The parsed argument list.
 * @returns A multi-line string suitable for display.
 */
export function formatArguments(args: string[]): string {
  if (args.length === 0) {
    return "No arguments provided.";
  }

  const lines: string[] = args.map(
    (arg, idx) => `  [${String(idx).padStart(2, " ")}] '${arg}'`
  );

  const header = `Arguments (${args.length}):`;
  return `${header}\n${lines.join("\n")}`;
}
