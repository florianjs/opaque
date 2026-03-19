#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { initCommand } from "./commands/init";
import { registerCommand } from "./commands/register";
import { setCommand } from "./commands/set";
import { getCommand } from "./commands/get";
import { listCommand } from "./commands/list";
import { rotateCommand } from "./commands/rotate";
import { pullCommand } from "./commands/pull";
import { auditCommand } from "./commands/audit";

const main = defineCommand({
  meta: {
    name: "opaque",
    version: "0.1.0",
    description: "Self-hosted secrets vault for AI-agent workflows",
  },
  subCommands: {
    init: initCommand,
    register: registerCommand,
    set: setCommand,
    get: getCommand,
    list: listCommand,
    rotate: rotateCommand,
    pull: pullCommand,
    audit: auditCommand,
  },
});

runMain(main);
