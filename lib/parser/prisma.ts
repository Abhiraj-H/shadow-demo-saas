// lib/parser/prisma.ts

import {
  createParsedRepository,
  createSymbolId,
  type ParsedFile,
  type ParsedRepository,
  type ParsedSymbol,
} from "./symbols";

export interface PrismaInput {
  filePath: string;
  content: string;
}

function lineNumber(
  content: string,
  index: number
): number {
  return (
    content.slice(0, index).split("\n").length
  );
}

export function parsePrismaFile(
  input: PrismaInput
): ParsedFile {
  const symbols: ParsedSymbol[] = [];

  const modelRegex =
    /model\s+(\w+)\s*\{([\s\S]*?)\}/g;

  let modelMatch: RegExpExecArray | null;

  while (
    (modelMatch = modelRegex.exec(input.content))
  ) {
    const modelName = modelMatch[1];
    const modelBody = modelMatch[2];

    const modelStart =
      lineNumber(
        input.content,
        modelMatch.index
      );

    const modelLines =
      modelMatch[0].split("\n");

    const modelId = createSymbolId(
      input.filePath,
      "database_model",
      modelName
    );

    symbols.push({
      id: modelId,
      name: modelName,
      type: "database_model",

      filePath: input.filePath,

      startLine: modelStart,
      endLine:
        modelStart + modelLines.length - 1,

      exported: true,

      signature: `model ${modelName}`,

      code: modelMatch[0],
    });

    const fields = modelBody.split("\n");

    for (
      let index = 0;
      index < fields.length;
      index++
    ) {
      const raw = fields[index].trim();

      if (
        !raw ||
        raw.startsWith("//") ||
        raw.startsWith("@@")
      ) {
        continue;
      }

      const match = raw.match(
        /^(\w+)\s+([^\s]+)(.*)$/
      );

      if (!match) continue;

      const [, fieldName, fieldType, metadata] =
        match;

      const fullName =
        `${modelName}.${fieldName}`;

      symbols.push({
        id: createSymbolId(
          input.filePath,
          "database_field",
          fullName
        ),

        name: fullName,

        type: "database_field",

        filePath: input.filePath,

        startLine:
          modelStart + index + 1,

        endLine:
          modelStart + index + 1,

        exported: true,

        signature: `${fieldName} ${fieldType}`,

        code: raw,

        metadata: {
          model: modelName,
          field: fieldName,
          fieldType,
          nullable:
            fieldType.endsWith("?"),
          attributes: metadata.trim(),
        },

        references: [
          {
            name: modelName,
            line:
              modelStart + index + 1,
          },
        ],
      });
    }
  }

  return {
    filePath: input.filePath,
    language: "prisma",
    symbols,
    imports: [],
    raw: input.content,
  };
}

export function parsePrismaFiles(
  inputs: PrismaInput[]
): ParsedRepository {
  return createParsedRepository(
    inputs.map(parsePrismaFile)
  );
}