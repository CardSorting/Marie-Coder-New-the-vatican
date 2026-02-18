import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

const execAsync = promisify(exec);

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  isUpdateAvailable: boolean;
}

export class UpdateService {
  private static readonly NPM_REGISTRY = "https://registry.npmjs.org/@noorm/marie-cli/latest";

  public static async checkUpdate(currentVersion: string): Promise<UpdateInfo | null> {
    try {
      // Use fetch to get latest version from NPM
      const response = await fetch(this.NPM_REGISTRY, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'marie-cli-update-check'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch latest version: ${response.statusText}`);
      }

      const data = await response.json();
      const latestVersion = data.version;

      if (!latestVersion) {
        throw new Error("Invalid response from NPM registry: missing version");
      }

      const isUpdateAvailable = this.isNewer(latestVersion, currentVersion);

      return {
        currentVersion,
        latestVersion,
        isUpdateAvailable,
      };
    } catch (error) {
      console.error("[UpdateService] Update check failed:", error);
      return null;
    }
  }

  private static isNewer(latest: string, current: string): boolean {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }
    return false;
  }

  public static async performUpdate(): Promise<boolean> {
    try {
      // For CLI, we recommend running npm install -g @noorm/marie-cli
      // We can attempt to run it, but it might require sudo
      console.log("[UpdateService] Attempting to update...");
      await execAsync("npm install -g @noorm/marie-cli");
      return true;
    } catch (error) {
      console.error("[UpdateService] Update failed:", error);
      return false;
    }
  }
}
