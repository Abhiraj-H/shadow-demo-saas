// lib/parser/symbols.ts

import type { NodeType } from "/Users/ash8000/quantum1/shadow/lib/graph/types.ts";

export interface ParsedImport {
    source: string;
    importedNames: string[];
    defaultImport?: string;
    namespaceImport?: string;
    line?: number;
}

export interface ParsedCall {
    name: string;
    line?: number;
}

export interface ParsedReference {
    name: string;
    line?: number;
}

export interface ParsedSymbol {
    id: string;
    name: string;
    type: NodeType;

    filePath: string;

    startLine?: number;
    endLine?: number;

    exported: boolean;
    async?: boolean;

    signature?: string;

    code?: string;

    imports?: ParsedImport[];
    calls?: ParsedCall[];
    references?: ParsedReference[];

    metadata?: Record<string, unknown>;
}

export interface ParsedFile {
    filePath: string;

    language:
    | "typescript"
    | "javascript"
    | "tsx"
    | "jsx"
    | "prisma"
    | "unknown";

    symbols: ParsedSymbol[];

    imports: ParsedImport[];

    raw?: string;
}

export interface ParsedRepository {
    files: ParsedFile[];
    symbols: ParsedSymbol[];
}

export function createSymbolId(
    filePath: string,
    type: NodeType,
    name: string
): string {
    return `${filePath}:${type}:${name}`;
}

export function detectLanguage(
    filePath: string
): ParsedFile["language"] {
    const lower = filePath.toLowerCase();

    if (lower.endsWith(".tsx")) return "tsx";
    if (lower.endsWith(".ts")) return "typescript";
    if (lower.endsWith(".jsx")) return "jsx";
    if (lower.endsWith(".js")) return "javascript";
    if (lower.endsWith(".prisma")) return "prisma";

    return "unknown";
}

export function flattenSymbols(
    files: ParsedFile[]
): ParsedSymbol[] {
    return files.flatMap((file) => file.symbols);
}

export function findSymbolByName(
    repository: ParsedRepository,
    name: string
): ParsedSymbol | undefined {
    return repository.symbols.find(
        (symbol) => symbol.name === name
    );
}

export function findSymbolsByName(
    repository: ParsedRepository,
    name: string
): ParsedSymbol[] {
    return repository.symbols.filter(
        (symbol) => symbol.name === name
    );
}

export function findSymbolById(
    repository: ParsedRepository,
    id: string
): ParsedSymbol | undefined {
    return repository.symbols.find(
        (symbol) => symbol.id === id
    );
}

export function createParsedRepository(
    files: ParsedFile[]
): ParsedRepository {
    return {
        files,
        symbols: flattenSymbols(files),
    };
}