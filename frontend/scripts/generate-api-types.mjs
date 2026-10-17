import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedDirectory = resolve(frontendRoot, 'src', 'api', 'generated');
const configuredOpenApiUrl = process.env.OPENAPI_URL;
const openApiUrl =
  configuredOpenApiUrl ?? 'http://localhost:3000/api/docs-json';
const methods = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

function quote(value) {
  return JSON.stringify(value);
}

function schemaType(schema = {}) {
  if (schema.$ref) {
    const reference = schema.$ref.split('/').at(-1);
    return `components["schemas"][${quote(reference)}]`;
  }

  if (schema.enum) {
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  }

  if (schema.oneOf || schema.anyOf) {
    return (schema.oneOf ?? schema.anyOf).map(schemaType).join(' | ');
  }

  if (schema.allOf) {
    return schema.allOf.map((part) => `(${schemaType(part)})`).join(' & ');
  }

  if (schema.type === 'array') {
    return `Array<${schemaType(schema.items)}>`;
  }

  if (schema.type === 'object' || schema.properties || schema.additionalProperties) {
    const required = new Set(schema.required ?? []);
    const fields = Object.entries(schema.properties ?? {}).map(
      ([name, property]) =>
        `    ${quote(name)}${required.has(name) ? '' : '?'}: ${schemaType(property)};`,
    );
    if (schema.additionalProperties) {
      const value =
        typeof schema.additionalProperties === 'object'
          ? schemaType(schema.additionalProperties)
          : 'unknown';
      fields.push(`    [key: string]: ${value};`);
    }
    return `{\n${fields.join('\n')}\n  }`;
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const primitives = types
    .filter(Boolean)
    .map((type) => {
      if (type === 'integer' || type === 'number') return 'number';
      if (type === 'string') return 'string';
      if (type === 'boolean') return 'boolean';
      if (type === 'null') return 'null';
      return 'unknown';
    });
  if (schema.nullable && !primitives.includes('null')) primitives.push('null');
  return primitives.length ? primitives.join(' | ') : 'unknown';
}

function responseContent(response = {}) {
  const content = Object.entries(response.content ?? {}).map(([mediaType, value]) => {
    const bodyType =
      mediaType === 'text/plain' || mediaType === 'text/csv'
        ? 'string'
        : schemaType(value.schema);
    return `        ${quote(mediaType)}: ${bodyType};`;
  });
  return `{\n      content?: {\n${content.join('\n')}\n      };\n    }`;
}

function operationName(method, path, operation, usedNames) {
  const candidate =
    operation.operationId ??
    `${method}_${path.replace(/[{}]/g, '').replace(/[^a-zA-Z0-9]+/g, '_')}`;
  let name = candidate;
  let suffix = 2;
  while (usedNames.has(name)) name = `${candidate}_${suffix++}`;
  usedNames.add(name);
  return name;
}

function generateOperation(name, operation, pathParameters) {
  const parameters = [...pathParameters, ...(operation.parameters ?? [])];
  const parameterGroups = ['query', 'path', 'header', 'cookie']
    .map((location) => {
      const isRequired = parameters.some(
        (parameter) => parameter.in === location && parameter.required,
      );
      const entries = parameters
        .filter((parameter) => parameter.in === location)
        .map(
          (parameter) =>
            `      ${quote(parameter.name)}${parameter.required ? '' : '?'}: ${schemaType(parameter.schema)};`,
        );
      return entries.length
        ? `    ${location}${isRequired ? '' : '?'}: {\n${entries.join('\n')}\n    };`
        : '';
    })
    .filter(Boolean);
  const hasRequiredParameters = parameters.some((parameter) => parameter.required);

  const requestBody = operation.requestBody?.content
    ? Object.entries(operation.requestBody.content).map(
        ([mediaType, content]) =>
          `      ${quote(mediaType)}: ${schemaType(content.schema)};`,
      )
    : [];
  const responses = Object.entries(operation.responses ?? {}).map(
    ([status, response]) =>
      `    ${quote(status)}: ${responseContent(response)};`,
  );

  return `  ${quote(name)}: {\n    parameters${hasRequiredParameters ? '' : '?'}: {\n${parameterGroups.join('\n')}\n    };\n    requestBody${operation.requestBody?.required ? '' : '?'}: {\n      content?: {\n${requestBody.join('\n')}\n      };\n    };\n    responses: {\n${responses.join('\n')}\n    };\n  };`;
}

function generateDeclarations(document) {
  const schemas = Object.entries(document.components?.schemas ?? {}).map(
    ([name, schema]) => `    ${quote(name)}: ${schemaType(schema)};`,
  );
  const usedNames = new Set();
  const operations = [];
  const pathEntries = [];

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    const pathParameters = pathItem.parameters ?? [];
    const routeMethods = [];
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!methods.has(method) || !operation || typeof operation !== 'object') continue;
      const name = operationName(method, path, operation, usedNames);
      operations.push(generateOperation(name, operation, pathParameters));
      routeMethods.push(
        `    ${method}: operations[${quote(name)}] & { operationId: ${quote(name)} };`,
      );
    }
    if (routeMethods.length) {
      pathEntries.push(`  ${quote(path)}: {\n${routeMethods.join('\n')}\n  };`);
    }
  }

  return `/* Generated from ${openApiUrl}; do not edit by hand. */
export interface components {
  schemas: {
${schemas.join('\n')}
  };
}

export interface operations {
${operations.join('\n')}
}

export interface paths {
${pathEntries.join('\n')}
}
`;
}

function findEnum(schema, schemas) {
  if (schema?.$ref) {
    return findEnum(schemas[schema.$ref.split('/').at(-1)], schemas);
  }
  if (Array.isArray(schema?.enum)) return schema.enum;
  return undefined;
}

function generateRoleConstants(document) {
  const schemas = document.components?.schemas ?? {};
  const userSchema = schemas.UserResponseDto;
  const roleValues = findEnum(userSchema?.properties?.role, schemas);
  if (!roleValues?.length || roleValues.some((value) => typeof value !== 'string')) {
    throw new Error(
      'OpenAPI document must define UserResponseDto.role as a string enum.',
    );
  }

  const constants = roleValues
    .map((value) => `  ${value.toUpperCase()}: ${quote(value)},`)
    .join('\n');
  return `/* Generated from ${openApiUrl}; do not edit by hand. */
export const UserRole = {
${constants}
} as const;
`;
}

let response;
try {
  response = await fetch(openApiUrl);
} catch (error) {
  if (configuredOpenApiUrl) throw error;
  console.warn(
    `Could not refresh OpenAPI types from ${openApiUrl}; retaining the checked-in bootstrap schema. Set OPENAPI_URL to require a live schema.`,
  );
}

if (response && !response.ok) {
  const message = `Failed to fetch OpenAPI document from ${openApiUrl}: ${response.status} ${response.statusText}`;
  if (configuredOpenApiUrl) throw new Error(message);
  console.warn(`${message}; retaining the checked-in bootstrap schema.`);
}

if (response?.ok) {
  const document = await response.json();
  if (
    typeof document.openapi !== 'string' ||
    !document.openapi.startsWith('3.') ||
    !document.components?.schemas?.UserResponseDto
  ) {
    throw new Error(`Invalid StellarCert OpenAPI document at ${openApiUrl}`);
  }

  await mkdir(generatedDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      resolve(generatedDirectory, 'openapi.d.ts'),
      generateDeclarations(document),
    ),
    writeFile(
      resolve(generatedDirectory, 'openapi-enums.ts'),
      generateRoleConstants(document),
    ),
  ]);
}
