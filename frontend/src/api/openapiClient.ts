import type { operations, paths } from './generated/openapi';
import { API_URL } from './endpoints';
import { tokenStorage } from './tokens';

type HttpMethod =
  | 'get'
  | 'put'
  | 'post'
  | 'delete'
  | 'options'
  | 'head'
  | 'patch'
  | 'trace';

type MethodAt<Path extends keyof paths> = Extract<
  keyof paths[Path],
  HttpMethod
>;
type OperationAt<
  Path extends keyof paths,
  Method extends MethodAt<Path>,
> = paths[Path][Method] extends { operationId: infer Name }
  ? Name extends keyof operations
    ? operations[Name]
    : never
  : never;
type RequestBodyOf<Operation> = Operation extends {
  requestBody?: { content?: infer Content };
}
  ? Content extends Record<string, infer Body>
    ? Body
    : never
  : never;
type ParameterOptions<Operation> = Operation extends {
  parameters: infer Parameters;
}
  ? { params: Parameters }
  : Operation extends { parameters?: infer Parameters }
    ? { params?: Parameters }
    : {};
type RequestBodyOptions<Operation> = Operation extends {
  requestBody: unknown;
}
  ? { body: RequestBodyOf<Operation> }
  : Operation extends { requestBody?: unknown }
    ? { body?: RequestBodyOf<Operation> }
    : {};
type ResponseContent<Operation> = Operation extends {
  responses: infer Responses;
}
  ? {
      [Status in keyof Responses]: Status extends `2${string}`
        ? Responses[Status] extends {
            content?: infer Content;
          }
          ? Content extends Record<string, infer Body>
            ? Body
            : undefined
          : undefined
        : never;
    }[keyof Responses]
  : never;

type RequestOptions<
  Path extends keyof paths,
  Method extends MethodAt<Path>,
> = ParameterOptions<OperationAt<Path, Method>> &
  RequestBodyOptions<OperationAt<Path, Method>> & {
    headers?: HeadersInit;
  };

function appendQuery(url: URL, query: unknown) {
  if (!query || typeof query !== 'object') return;
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
}

function resolvePath(path: string, pathParameters: unknown) {
  const values =
    pathParameters && typeof pathParameters === 'object'
      ? (pathParameters as Record<string, unknown>)
      : {};
  return path.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing required OpenAPI path parameter: ${key}`);
    }
    return encodeURIComponent(String(value));
  });
}

export async function openApiRequest<
  Path extends keyof paths,
  Method extends MethodAt<Path>,
>(
  path: Path,
  method: Method,
  options: RequestOptions<Path, Method>,
): Promise<ResponseContent<OperationAt<Path, Method>>> {
  const params = options.params as
    | { query?: unknown; path?: unknown }
    | undefined;
  const resolvedPath = resolvePath(String(path), params?.path);
  const baseUrl = API_URL.endsWith('/') ? API_URL : `${API_URL}/`;
  const url = new URL(resolvedPath.replace(/^\//, ''), baseUrl);
  appendQuery(url, params?.query);

  const headers = new Headers(options.headers);
  const token = tokenStorage.getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    method: String(method).toUpperCase(),
    headers,
    credentials: 'include',
    body:
      options.body === undefined
        ? undefined
        : isFormData
          ? (options.body as BodyInit)
          : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `OpenAPI request ${String(method).toUpperCase()} ${String(path)} failed (${response.status}): ${message}`,
    );
  }

  if (response.status === 204) return undefined as ResponseContent<
    OperationAt<Path, Method>
  >;
  const contentType = response.headers.get('content-type') ?? '';
  const body: unknown = contentType.includes('json')
    ? await response.json()
    : await response.text();
  return body as ResponseContent<OperationAt<Path, Method>>;
}
