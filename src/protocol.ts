export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export interface JSONObject {
  [key: string]: JSONValue;
}
export interface JSONArray extends Array<JSONValue> {}

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface FetchActionDescriptor {
  type: 'fetch';
  url: string;
  method?: HTTPMethod;
  payload?: Record<string, JSONValue>;
}

export interface EmitActionDescriptor {
  type: 'emit';
  event: string;
  detail?: Record<string, JSONValue>;
}

export interface NavigateActionDescriptor {
  type: 'navigate';
  url: string;
  replace?: boolean;
}

export type ActionDescriptor =
  | FetchActionDescriptor
  | EmitActionDescriptor
  | NavigateActionDescriptor;

export interface ViewMeta {
  version?: '1';
  lang?: string;
  generator?: string;
  title?: string;
  route?: string;
}

export interface ProtocolView {
  template: string;
  state: Record<string, JSONValue>;
  actions?: Record<string, ActionDescriptor>;
  meta?: ViewMeta;
}

export type PatchMode = 'merge' | 'replace';

export interface ProtocolPatch {
  kind: 'patch';
  mode?: PatchMode;
  template?: string;
  state?: Record<string, JSONValue>;
  actions?: Record<string, ActionDescriptor>;
  meta?: ViewMeta;
}

export type UIView = ProtocolView;
