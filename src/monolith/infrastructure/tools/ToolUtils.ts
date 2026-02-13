/**
 * Utility functions for validating and extracting typed arguments from tool inputs.
 */

/**
 * Extracts a string argument from the tool args.
 * Throws an error if the argument is missing or not a string.
 */
export function getStringArg(args: Record<string, unknown>, key: string): string {
    const value = args[key];
    if (value === undefined || value === null) {
        throw new Error(`Missing required argument: ${key}`);
    }
    if (typeof value !== 'string') {
        throw new Error(`Argument ${key} must be a string, but got ${typeof value}`);
    }
    return value;
}

/**
 * Extracts an optional string argument from the tool args.
 * Returns undefined if the argument is missing.
 * Throws an error if the argument exists but is not a string.
 */
export function getOptionalStringArg(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new Error(`Argument ${key} must be a string, but got ${typeof value}`);
    }
    return value;
}

/**
 * Extracts a number argument from the tool args.
 */
export function getNumberArg(args: Record<string, unknown>, key: string): number {
    const value = args[key];
    if (value === undefined || value === null) {
        throw new Error(`Missing required argument: ${key}`);
    }
    if (typeof value !== 'number') {
        throw new Error(`Argument ${key} must be a number, but got ${typeof value}`);
    }
    return value;
}

/**
 * Extracts an array argument from the tool args.
 */
export function getArrayArg<T>(args: Record<string, unknown>, key: string): T[] {
    const value = args[key];
    if (value === undefined || value === null) {
        throw new Error(`Missing required argument: ${key}`);
    }
    if (!Array.isArray(value)) {
        throw new Error(`Argument ${key} must be an array, but got ${typeof value}`);
    }
    return value as T[];
}
