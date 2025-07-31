export interface OpenAPISpec {
  openapi: string;
  info: any;
  paths: any;
  components: any;
  [key: string]: any;
}

export class SchemaResolver {
  constructor(private spec: OpenAPISpec) {}

  /**
   * Resolve all $ref references in a schema
   */
  async resolveSchema(schema: any, visited = new Set<string>()): Promise<any> {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    // Handle $ref
    if (schema.$ref) {
      const resolved = await this.resolveRef(schema.$ref, visited);
      // Merge any sibling properties (OpenAPI 3.1 allows this)
      const { $ref, ...siblings } = schema;
      return { ...resolved, ...siblings };
    }

    // Deep clone to avoid mutations
    const result = this.deepClone(schema);

    // Recursively resolve nested schemas
    for (const key of Object.keys(result)) {
      if (result[key] && typeof result[key] === 'object') {
        if (key === 'properties' && result[key]) {
          // Handle properties object - pass visited set to maintain circular reference tracking
          for (const propKey of Object.keys(result[key])) {
            result[key][propKey] = await this.resolveSchema(result[key][propKey], visited);
          }
        } else if (key === 'items') {
          // Handle array items - pass visited set
          result[key] = await this.resolveSchema(result[key], visited);
        } else if (key === 'allOf' || key === 'anyOf' || key === 'oneOf') {
          // Handle composition schemas - pass visited set
          result[key] = await Promise.all(
            result[key].map((s: any) => this.resolveSchema(s, visited))
          );
        } else if (key === 'additionalProperties' && typeof result[key] === 'object') {
          result[key] = await this.resolveSchema(result[key], visited);
        }
      }
    }

    return result;
  }

  /**
   * Convert OpenAPI schema to MCP-compatible JSON Schema
   */
  toMCPSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    const result = this.deepClone(schema);

    // Remove OpenAPI-specific fields
    const openAPIFields = [
      'discriminator',
      'xml',
      'externalDocs',
      'example',
      'deprecated',
      'readOnly',
      'writeOnly',
      'nullable' // In JSON Schema, use 'type': ['string', 'null'] instead
    ];

    for (const field of openAPIFields) {
      delete result[field];
    }

    // Convert nullable to JSON Schema format
    if (schema.nullable === true && result.type) {
      result.type = Array.isArray(result.type) 
        ? [...result.type, 'null'] 
        : [result.type, 'null'];
    }

    // Recursively clean nested schemas
    if (result.properties) {
      for (const key of Object.keys(result.properties)) {
        result.properties[key] = this.toMCPSchema(result.properties[key]);
      }
    }

    if (result.items) {
      result.items = this.toMCPSchema(result.items);
    }

    if (result.allOf || result.anyOf || result.oneOf) {
      for (const compositionKey of ['allOf', 'anyOf', 'oneOf']) {
        if (result[compositionKey]) {
          result[compositionKey] = result[compositionKey].map((s: any) => 
            this.toMCPSchema(s)
          );
        }
      }
    }

    if (result.additionalProperties && typeof result.additionalProperties === 'object') {
      result.additionalProperties = this.toMCPSchema(result.additionalProperties);
    }

    return result;
  }

  /**
   * Resolve a single $ref
   */
  private async resolveRef(ref: string, visited: Set<string>): Promise<any> {
    // Handle circular references by returning the ref itself
    if (visited.has(ref)) {
      console.warn(`Circular reference detected: ${ref}, preserving as $ref`);
      return { $ref: ref };
    }
    visited.add(ref);

    // Only handle local references for now
    if (!ref.startsWith('#/')) {
      throw new Error(`External references not supported: ${ref}`);
    }

    // Parse JSON Pointer
    const pointer = ref.substring(2); // Remove '#/'
    const parts = pointer.split('/');
    
    let current: any = this.spec;
    for (const part of parts) {
      // Decode JSON Pointer escapes
      const decodedPart = part.replace(/~1/g, '/').replace(/~0/g, '~');
      
      if (current && typeof current === 'object' && decodedPart in current) {
        current = current[decodedPart];
      } else {
        throw new Error(`Invalid reference: ${ref}`);
      }
    }

    // Recursively resolve if the result contains more $refs
    return await this.resolveSchema(current, visited);
  }

  /**
   * Deep clone helper
   */
  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item)) as any;
    }
    
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    
    return cloned;
  }
}