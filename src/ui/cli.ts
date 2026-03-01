#!/usr/bin/env node
import * as readline from "readline";
import * as process from "process";
import { Adapter } from "./Adapter.js";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

class Terminal {
  private adapter: Adapter;
  private rl: readline.Interface;

  constructor() {
    this.adapter = new Adapter(process.cwd());
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      prompt: `${ANSI.cyan}›${ANSI.reset} `,
    });
  }

  async start() {
    console.log(
      `\n${ANSI.bold}${ANSI.cyan}Layered Architecture Engine CLI${ANSI.reset}\n`,
    );

    this.rl.on("line", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        this.rl.prompt();
        return;
      }
      if (trimmed.startsWith("/")) {
        await this.handleCommand(trimmed);
      } else {
        await this.sendMessage(trimmed);
      }
    });

    this.rl.on("close", () => {
      process.exit(0);
    });
    this.rl.prompt();
  }

  private async handleCommand(command: string) {
    const [cmd] = command.slice(1).split(" ");
    switch (cmd) {
      case "new":
        await this.adapter.createSession();
        console.log(`${ANSI.green}✓ New session started${ANSI.reset}`);
        break;
      case "exit":
        process.exit(0);
        break;
      default:
        console.log(`${ANSI.yellow}Unknown command: ${cmd}${ANSI.reset}`);
    }
    this.rl.prompt();
  }

  private async sendMessage(message: string) {
    process.stdout.write(`${ANSI.cyan}Response:${ANSI.reset} `);
    try {
      const _response = await this.adapter.handleMessage(message, {
        onStream: (chunk) => process.stdout.write(chunk),
      });
      console.log("\n");
      this.rl.prompt();
    } catch (e) {
      console.log(`\n${ANSI.red}Error: ${e}${ANSI.reset}\n`);
      this.rl.prompt();
    }
  }
}

new Terminal().start();
