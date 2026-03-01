import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import { dbPool } from "./DbPool.js";

export type Layer = "domain" | "infrastructure" | "plumbing" | "ui";

export function getLayer(path: string): Layer {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.startsWith("src/domain/")) return "domain";
  if (normalized.startsWith("src/infrastructure/")) return "infrastructure";
  if (normalized.startsWith("src/plumbing/")) return "plumbing";
  if (normalized.startsWith("src/ui/")) return "ui";
  throw new Error(
    `Invalid layer path: ${path}. Every file must reside in a valid layer directory.`,
  );
}

// AST-based Detection
export class AstValidator {
  public static validate(filePath: string, content: string): void {
    const layer = getLayer(filePath);
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    this.visit(sourceFile, layer, filePath);
  }

  private static visit(node: ts.Node, layer: Layer, filePath: string) {
    // Forbidden calls detection
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const text = expression.getText();

      if (layer === "domain") {
        if (text.includes("fetch") || text.includes("fs.") || text.includes("child_process")) {
          throw new Error(`Architectural Violation in ${filePath}: Forbidden call '${text}' in Domain layer.`);
        }
      }

      if (layer === "infrastructure") {
        if (text.includes("document.") || text.includes("window.")) {
          throw new Error(`Architectural Violation in ${filePath}: Browser API call '${text}' in Infrastructure layer.`);
        }
      }
    }

    // Property access detection (e.g. process.env)
    if (ts.isPropertyAccessExpression(node)) {
      const text = node.getText();
      if ((layer === "domain" || layer === "ui") && text.startsWith("process.")) {
        throw new Error(`Architectural Violation in ${filePath}: Environment access '${text}' is forbidden in ${layer} layer.`);
      }
    }

    // Import dependency detection
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier.getText().replace(/['"]/g, "");
      if (moduleSpecifier.startsWith(".")) {
        const absoluteImportPath = path.normalize(path.join(path.dirname(filePath), moduleSpecifier));
        this.validateDependency(filePath, layer, absoluteImportPath);
      }
    }

    ts.forEachChild(node, (child) => this.visit(child, layer, filePath));
  }

  private static validateDependency(filePath: string, layer: Layer, importPath: string) {
    // Basic DAG Enforcement
    if (layer === "domain") {
      if (importPath.includes("/infrastructure/") || importPath.includes("/ui/")) {
        throw new Error(`Architectural Violation in ${filePath}: Domain cannot import from Infrastructure or UI.`);
      }
    }
    if (layer === "infrastructure") {
      if (importPath.includes("/ui/")) {
        throw new Error(`Architectural Violation in ${filePath}: Infrastructure cannot import from UI.`);
      }
    }
    if (layer === "ui") {
      if (importPath.includes("/infrastructure/")) {
        throw new Error(`Architectural Violation in ${filePath}: UI cannot directly import Infrastructure (use services).`);
      }
    }
  }
}

export async function validateHistoricalEntropy(filePath: string): Promise<void> {
  // Query DbPool for past tasks related to this file
  const tasks = await dbPool.selectAllFrom("agent_tasks");
  const regressionTasks = tasks.filter(t =>
    t.status === "failed" &&
    t.description.includes(path.basename(filePath))
  );

  if (regressionTasks.length > 5) {
    console.warn(`[Validator] File ${filePath} has a high historical failure rate (${regressionTasks.length} failed attempts). Proceed with caution.`);
  }
}

export function validateSmells(path: string, content: string): void {
  const classCount = (content.match(/class /g) || []).length;
  if (classCount > 1) {
    throw new Error(`Architectural Smell in ${path}: Multiple classes in a single file.`);
  }

  if (content.includes(": any") || content.includes("<any>")) {
    throw new Error(`Architectural Smell in ${path}: Forbidden 'any' type detected.`);
  }
}

export async function validateLayering(path: string, content: string): Promise<void> {
  // 1. Smell Check
  validateSmells(path, content);

  // 2. AST Validation
  AstValidator.validate(path, content);

  // 3. Historical Check
  await validateHistoricalEntropy(path);
}

export const DOMAIN_CONSTRAINTS = []; // Legacy - transitioned to AstValidator
export const INFRASTRUCTURE_CONSTRAINTS = [];
export const UI_CONSTRAINTS = [];
export const PLUMBING_CONSTRAINTS = [];
