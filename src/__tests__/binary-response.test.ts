import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@takaro/apiclient';
import { DynamicTool } from '../tools/dynamic.js';

const context = { client: {} as Client, sessionId: 'test' };
const metadata = { name: 'tile', description: 'Get map tile' };

test('binary API response becomes an MCP image', async () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const tool = new DynamicTool(metadata, {}, async () => ({
    data: png,
    headers: { 'content-type': 'image/png' },
  }));
  const result = await tool.execute({}, context);
  assert.deepEqual(result.content, [{
    type: 'image', data: png.toString('base64'), mimeType: 'image/png',
  }]);
});

test('JSON API response returns its body without Axios wrapper', async () => {
  const body = { meta: {}, data: { enabled: true } };
  const tool = new DynamicTool(metadata, {}, async () => ({ data: body, headers: {} }));
  const result = await tool.execute({}, context);
  assert.deepEqual(JSON.parse(result.content[0].text || ''), body);
});

test('binary error response decodes Takaro JSON', async () => {
  const tool = new DynamicTool(metadata, {}, async () => {
    throw {
      message: 'Bad Request',
      response: {
        status: 400,
        statusText: 'Bad Request',
        data: Buffer.from(JSON.stringify({ meta: { error: { message: 'tile_out_of_range' } } })),
      },
    };
  });
  const oldError = console.error;
  console.error = () => {};
  try {
    const result = await tool.execute({}, context);
    const error = JSON.parse(result.content[0].text || '');
    assert.equal(error.status, 400);
    assert.equal(error.details.meta.error.message, 'tile_out_of_range');
  } finally {
    console.error = oldError;
  }
});
