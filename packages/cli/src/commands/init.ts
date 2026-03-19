import { defineCommand } from "citty";
import * as readline from "node:readline";

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Interactive setup wizard for opaque vault",
  },
  async run() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\nopaque — interactive setup wizard\n");

    const vaultUrl = await prompt(rl, "Vault URL [http://localhost:4200]: ");
    const adminToken = await prompt(rl, "Admin token (OPAQUE_ADMIN_TOKEN): ");
    const projectName = await prompt(rl, "Project name: ");

    rl.close();

    const finalUrl = vaultUrl.trim() || "http://localhost:4200";

    if (!adminToken.trim()) {
      throw new Error("opaque: admin token is required");
    }
    if (!projectName.trim()) {
      throw new Error("opaque: project name is required");
    }

    console.log(
      `\nRun this to register your project:\n\n  opaque register --project ${projectName.trim()} --vault-url ${finalUrl} --token ${adminToken.trim()}\n`,
    );
  },
});
