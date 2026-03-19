export function printCliBanner(): void {
  const reset = "\x1b[0m";
  const dim = "\x1b[2m";
  const purple = "\x1b[35m";
  const bold = "\x1b[1m";

  console.log(`${purple}${bold}opaque${reset} ${dim}secrets vault for AI agents${reset}`);
}
