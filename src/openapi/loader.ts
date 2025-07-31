import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

interface OpenAPISpec {
  openapi: string;
  info: any;
  paths: any;
  components: any;
  [key: string]: any;
}

export class OpenAPILoader {
  private spec: OpenAPISpec | null = null;
  private lastFetch: number = 0;
  private readonly cacheFile = path.join(process.cwd(), '.cache', 'openapi.json');
  private readonly cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  async getSpec(): Promise<OpenAPISpec> {
    // Check in-memory cache
    if (this.spec && this.isCacheValid()) {
      return this.spec;
    }

    // Try to load from file cache
    const cached = await this.loadFromCache();
    if (cached) {
      this.spec = cached.spec;
      this.lastFetch = cached.lastFetch;
      return this.spec;
    }

    // Fetch from API
    return await this.fetchSpec();
  }

  private async fetchSpec(): Promise<OpenAPISpec> {
    const url = `${process.env.TAKARO_HOST || 'https://api.takaro.io'}/openapi.json`;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Fetching OpenAPI spec from ${url} (attempt ${attempt}/${this.maxRetries})`);
        const response = await axios.get<OpenAPISpec>(url);
        
        this.spec = response.data;
        this.lastFetch = Date.now();
        
        // Save to cache
        await this.saveToCache();
        
        console.log('Successfully fetched OpenAPI spec');
        return this.spec;
      } catch (error) {
        console.error(`Failed to fetch OpenAPI spec (attempt ${attempt}):`, error);
        
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        } else {
          throw new Error(`Failed to fetch OpenAPI spec after ${this.maxRetries} attempts`);
        }
      }
    }
    
    throw new Error('Unexpected error in fetchSpec');
  }

  private async loadFromCache(): Promise<{ spec: OpenAPISpec; lastFetch: number } | null> {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf-8');
      const cached = JSON.parse(data);
      
      if (Date.now() - cached.lastFetch < this.cacheDuration) {
        console.log('Loaded OpenAPI spec from cache');
        return cached;
      }
    } catch (error) {
      // Cache doesn't exist or is invalid
    }
    
    return null;
  }

  private async saveToCache(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });
      await fs.writeFile(
        this.cacheFile,
        JSON.stringify({ spec: this.spec, lastFetch: this.lastFetch }, null, 2)
      );
    } catch (error) {
      console.error('Failed to save OpenAPI spec to cache:', error);
    }
  }

  private isCacheValid(): boolean {
    return Date.now() - this.lastFetch < this.cacheDuration;
  }

  clearCache(): void {
    this.spec = null;
    this.lastFetch = 0;
  }
}