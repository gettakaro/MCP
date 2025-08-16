import { Client } from '@takaro/apiclient'

let client: Client;

// Retry configuration
const MAX_RETRIES = 5;
const INITIAL_DELAY = 2000; // 2 seconds
const MAX_DELAY = 30000; // 30 seconds
const BACKOFF_MULTIPLIER = 2;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getClient() {
  if (client) return client;

  const username = process.env.TAKARO_USERNAME;
  const password = process.env.TAKARO_PASSWORD;
  const domainId = process.env.TAKARO_DOMAIN_ID;
  const takaroUrl = process.env.TAKARO_HOST || 'https://api.takaro.io';

  if (!username || !password) {
    throw new Error('TAKARO_USERNAME and TAKARO_PASSWORD environment variables must be set');
  }

  if (!domainId) {
    throw new Error('TAKARO_DOMAIN_ID environment variable must be set');
  }

  client = new Client({
    auth: { password, username },
    url: takaroUrl
  })

  let lastError: Error | unknown;
  let delay = INITIAL_DELAY;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Attempting to connect to Takaro at ${takaroUrl} (attempt ${attempt}/${MAX_RETRIES})`);
      
      await client.login();
      console.log('Successfully authenticated with Takaro');
      
      // Set the selected domain
      try {
        await client.user.userControllerSetSelectedDomain(domainId);
        console.log(`Selected domain: ${domainId}`);
      } catch (domainError) {
        console.error(`Failed to set domain ${domainId}:`, domainError);
        throw new Error(`Invalid domain ID or insufficient permissions for domain: ${domainId}`);
      }
      
      // Verify the domain was set correctly
      const session = await client.user.userControllerMe();
      console.log(`User: ${session.data.data.user.name}`);
      
      // The domain property is a string (domain ID), find the full domain object
      const activeDomainId = session.data.data.domain;
      const activeDomain = session.data.data.domains.find(d => d.id === activeDomainId);
      
      if (activeDomain) {
        console.log(`Active domain: ${activeDomain.name} (ID: ${activeDomain.id})`);
      } else {
        console.log(`Active domain ID: ${activeDomainId || 'Not set'}`);
      }
      
      if (activeDomainId !== domainId) {
        throw new Error(`Domain configuration error: Unable to set domain to ${domainId}. Server responded with domain ${activeDomainId}. This may indicate an invalid domain ID or insufficient permissions.`);
      }

      // Success! Return the client
      return client;
      
    } catch (error) {
      lastError = error;
      console.error(`Connection attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt < MAX_RETRIES) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await sleep(delay);
        
        // Exponential backoff with max delay
        delay = Math.min(delay * BACKOFF_MULTIPLIER, MAX_DELAY);
      }
    }
  }

  // All retries exhausted
  console.error(`Failed to connect to Takaro after ${MAX_RETRIES} attempts`);
  throw lastError;
}