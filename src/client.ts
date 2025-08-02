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

  try {
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
  } catch (error) {
    console.error('Failed to authenticate with Takaro:', error);
    throw error;
  }

  return client;
}