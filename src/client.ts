import { Client } from '@takaro/apiclient'

let client: Client;

export async function getClient() {
  if (client) return client;

  const username = process.env.TAKARO_USERNAME;
  const password = process.env.TAKARO_PASSWORD;
  const takaroUrl = process.env.TAKARO_HOST || 'https://api.takaro.io';

  if (!username || !password) {
    throw new Error('TAKARO_USERNAME and TAKARO_PASSWORD environment variables must be set');
  }

  client = new Client({
    auth: { password, username },
    url: takaroUrl
  })

  try {
    await client.login();
    const session = await client.user.userControllerMe();
    console.log('Successfully authenticated with Takaro');
    console.log(`User: ${session.data.data.user.name}`);
    console.log(`Active domain: ${session.data.data.domain}`);
  } catch (error) {
    console.error('Failed to authenticate with Takaro:', error);
    throw error;
  }

  return client;
}