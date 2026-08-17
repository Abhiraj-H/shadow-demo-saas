// lib/parser/typescript.ts

import {
  Project,
  ScriptKind,
  SyntaxKind,
  Node,
} from "ts-morph";

import {
  createParsedRepository,
  createSymbolId,
  detectLanguage,
  type ParsedCall,
  type ParsedFile,
  type ParsedImport,
  type ParsedReference,
  type ParsedRepository,
  type ParsedSymbol,
} from "./symbols";

export interface SourceInput {
  filePath: string;
  content: string;
}

function getLine(node: Node): number {
  return node
    .getSourceFile()
    .getLineAndColumnAtPos(node.getStart()).line;
}

function getEndLine(node: Node): number {
  return node
    .getSourceFile()
    .getLineAndColumnAtPos(node.getEnd()).line;
}

function parseImports(sourceFile: any): ParsedImport[] {
  return sourceFile.getImportDeclarations().map((decl: any) => {
    const importedNames = decl
      .getNamedImports()
      .map((item: any) => item.getName());

    return {
      source: decl.getModuleSpecifierValue(),
      importedNames,
      defaultImport: decl.getDefaultImport()?.getText(),
      namespaceImport:
        decl.getNamespaceImport()?.getText(),
      line: getLine(decl),
    };
  });
}

function getCalls(node: Node): ParsedCall[] {
  return node
    .getDescendantsOfKind(
      SyntaxKind.CallExpression
    )
    .map((call: any) => {
      const expression = call.getExpression();

      return {
        name: expression.getText(),
        line: getLine(call),
      };
    });
}

function getReferences(
  node: Node
): ParsedReference[] {
  const references: ParsedReference[] = [];

  for (const property of node.getDescendantsOfKind(
    SyntaxKind.PropertyAccessExpression
  )) {
    const propertyName = property.getName();
    const expression = property.getExpression();

    let typeName: string | undefined;

    try {
      const type = expression.getType();
      const symbol = type.getSymbol();

      typeName = symbol?.getName();

      if (
        !typeName ||
        typeName === "__type" ||
        typeName === "Object"
      ) {
        typeName = undefined;
      }
    } catch {
      typeName = undefined;
    }

    references.push({
      name: typeName
        ? `${typeName}.${propertyName}`
        : propertyName,
      line: getLine(property),
    });
  }

  return references;
}

function symbolFromNode(
  node: Node,
  filePath: string,
  name: string,
  type: ParsedSymbol["type"],
  exported: boolean,
  signature?: string
): ParsedSymbol {
  return {
    id: createSymbolId(
      filePath,
      type,
      name
    ),

    name,
    type,
    filePath,

    startLine: getLine(node),
    endLine: getEndLine(node),

    exported,

    signature,
    code: node.getText(),

    calls: getCalls(node),
    references: getReferences(node),
  };
}

function parseSourceFile(
  sourceFile: any,
  filePath: string,
  raw: string
): ParsedFile {
  const symbols: ParsedSymbol[] = [];

  const imports = parseImports(sourceFile);

  for (const declaration of sourceFile.getFunctions()) {
    const name =
      declaration.getName() ?? "anonymous";

    symbols.push(
      symbolFromNode(
        declaration,
        filePath,
        name,
        "function",
        declaration.isExported(),
        declaration.getText().split("{")[0]?.trim()
      )
    );
  }

  for (const declaration of sourceFile.getClasses()) {
    const name =
      declaration.getName() ?? "AnonymousClass";

    symbols.push(
      symbolFromNode(
        declaration,
        filePath,
        name,
        "class",
        declaration.isExported(),
        declaration.getText().split("{")[0]?.trim()
      )
    );
  }

  for (const declaration of sourceFile.getInterfaces()) {
    symbols.push(
      symbolFromNode(
        declaration,
        filePath,
        declaration.getName(),
        "interface",
        declaration.isExported(),
        declaration.getText().split("{")[0]?.trim()
      )
    );
  }

  for (const declaration of sourceFile.getTypeAliases()) {
    symbols.push(
      symbolFromNode(
        declaration,
        filePath,
        declaration.getName(),
        "type",
        declaration.isExported(),
        declaration.getText().split("=")[0]?.trim()
      )
    );
  }

  for (const statement of sourceFile.getVariableStatements()) {
    for (const declaration of statement.getDeclarations()) {
      const initializer =
        declaration.getInitializer();

      const isFunction =
        initializer &&
        (
          Node.isArrowFunction(initializer) ||
          Node.isFunctionExpression(initializer)
        );

      const name = declaration.getName();

      symbols.push(
        symbolFromNode(
          declaration,
          filePath,
          name,
          isFunction
            ? "function"
            : "variable",
          statement.isExported(),
          declaration
            .getText()
            .split("=>")[0]
            ?.trim()
        )
      );
    }
  }

  const apiMethods = new Set([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ]);

  if (
    filePath.includes("/api/") ||
    filePath.startsWith("app/api/")
  ) {
    for (const symbol of symbols) {
      if (
        symbol.exported &&
        apiMethods.has(symbol.name)
      ) {
        symbol.type = "api_route";
        symbol.id = createSymbolId(
          filePath,
          "api_route",
          symbol.name
        );
      }
    }
  }

  return {
    filePath,
    language: detectLanguage(filePath),
    symbols,
    imports,
    raw,
  };
}

export function parseTypeScriptFiles(
  inputs: SourceInput[]
): ParsedRepository {
  const project = new Project({
    useInMemoryFileSystem: true,

    compilerOptions: {
      allowJs: true,
      checkJs: false,
      jsx: 4,
      target: 99,
      module: 99,
      moduleResolution: 2,
      esModuleInterop: true,
      skipLibCheck: true,
    },
  });

  for (const input of inputs) {
    const kind =
      input.filePath.endsWith(".tsx")
        ? ScriptKind.TSX
        : input.filePath.endsWith(".jsx")
          ? ScriptKind.JSX
          : input.filePath.endsWith(".js")
            ? ScriptKind.JS
            : ScriptKind.TS;

    project.createSourceFile(
      input.filePath,
      input.content,
      {
        overwrite: true,
        scriptKind: kind,
      }
    );
  }

  const files: ParsedFile[] = [];

  for (const input of inputs) {
    const sourceFile =
      project.getSourceFile(input.filePath);

    if (!sourceFile) continue;

    files.push(
      parseSourceFile(
        sourceFile,
        input.filePath,
        input.content
      )
    );
  }

  return createParsedRepository(files);
}