import { Client } from '@takaro/apiclient'

let client: Client;

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

  // Wait for the API to be healthy before attempting authentication
  const healthTimeout = parseInt(process.env.TAKARO_HEALTH_TIMEOUT || '60000', 10);
  console.log(`Waiting for Takaro API at ${takaroUrl} to be healthy (timeout: ${healthTimeout / 1000}s)...`);
  
  await client.waitUntilHealthy(healthTimeout);
  console.log('Takaro API is healthy, proceeding with authentication');
  
  await client.login();
  console.log('Successfully authenticated with Takaro');
  
  // Set the selected domain
  await client.user.userControllerSetSelectedDomain(domainId);
  console.log(`Selected domain: ${domainId}`);
  
  // Verify the domain was set correctly
  const session = await client.user.userControllerMe();
  const activeDomainId = session.data.data.domain;
  const activeDomain = session.data.data.domains.find(d => d.id === activeDomainId);
  
  console.log(`User: ${session.data.data.user.name}`);
  console.log(`Active domain: ${activeDomain?.name || activeDomainId} (ID: ${activeDomainId})`);
  
  if (activeDomainId !== domainId) {
    throw new Error(`Domain configuration error: Unable to set domain to ${domainId}. Server responded with domain ${activeDomainId}`);
  }

  return client;
}