import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_IMAGE_MODELS,
  generateMascotImage,
  imageModelCandidates,
  isMissingModelError,
  stableIndexFromId,
} from '../../server/mascotImage';

/**
 * The mascot stopped working because the account lost `dall-e-3` ("The model 'dall-e-3' does
 * not exist") and the gpt-image family answers with base64 instead of a URL. Both halves are
 * pinned here: a retired name is skipped, and the picture is read from either shape.
 */

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

function clientThat(answers: Array<{ response?: any; error?: any }>) {
  const calls: any[] = [];
  return {
    calls,
    getClient: async () => ({
      images: {
        generate: async (params: any) => {
          calls.push(params);
          const answer = answers[calls.length - 1];
          if (answer?.error) throw answer.error;
          return answer?.response ?? { data: [] };
        },
      },
    }),
  };
}

function missingModel(model: string) {
  return Object.assign(new Error(`400 The model '${model}' does not exist.`), { status: 400 });
}

const base64Answer = { response: { data: [{ b64_json: PNG.toString('base64') }] } };

afterEach(() => {
  delete process.env.AI_IMAGE_MODEL;
  vi.restoreAllMocks();
});

describe('which image model is tried', () => {
  it('starts on a model the account actually has', () => {
    expect(imageModelCandidates(undefined)).toEqual([...DEFAULT_IMAGE_MODELS]);
    expect(DEFAULT_IMAGE_MODELS[0]).toBe('gpt-image-1.5');
    // `gpt-image-1` answers "does not exist" on this account too, so it is not in the list.
    expect(DEFAULT_IMAGE_MODELS).not.toContain('gpt-image-1');
  });

  it('puts the configured model first without repeating it', () => {
    expect(imageModelCandidates('gpt-image-2')).toEqual(['gpt-image-2', 'gpt-image-1.5', 'dall-e-3']);
    expect(imageModelCandidates('  dall-e-3 ')).toEqual(['dall-e-3', 'gpt-image-1.5', 'gpt-image-2']);
    expect(imageModelCandidates('')).toEqual([...DEFAULT_IMAGE_MODELS]);
  });

  it('treats a missing model as the one failure worth another name', () => {
    expect(isMissingModelError(missingModel('dall-e-3'))).toBe(true);
    expect(isMissingModelError(Object.assign(new Error('404 not found'), { status: 404 }))).toBe(true);
    expect(isMissingModelError(Object.assign(new Error('400 prompt rejected'), { status: 400 }))).toBe(false);
    expect(isMissingModelError(Object.assign(new Error('429 slow down'), { status: 429 }))).toBe(false);
  });
});

describe('generating the mascot picture', () => {
  it('takes the bytes from base64, which is what gpt-image answers with', async () => {
    const fake = clientThat([base64Answer]);

    const image = await generateMascotImage('a friendly mascot', { getClient: fake.getClient });

    expect(image.model).toBe('gpt-image-1.5');
    expect(image.bytes.equals(PNG)).toBe(true);
    expect(image.temporaryUrl).toBeUndefined();
    expect(fake.calls[0]).toMatchObject({ model: 'gpt-image-1.5', n: 1, size: '1024x1024' });
  });

  it('skips a model the account does not have and uses the next one', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = clientThat([{ error: missingModel('gpt-image-1.5') }, base64Answer]);

    const image = await generateMascotImage('a mascot', { getClient: fake.getClient });

    expect(image.model).toBe('gpt-image-2');
    expect(fake.calls.map((call) => call.model)).toEqual(['gpt-image-1.5', 'gpt-image-2']);
    expect(warn).toHaveBeenCalled();
  });

  it('does not spend a call per model on a prompt the provider rejected', async () => {
    const fake = clientThat([{ error: Object.assign(new Error('400 rejected by the safety system'), { status: 400 }) }]);

    await expect(generateMascotImage('a mascot', { getClient: fake.getClient })).rejects.toThrow(/safety/);
    expect(fake.calls).toHaveLength(1);
  });

  it('downloads the picture when the answer is a URL, and asks dall-e for base64', async () => {
    process.env.AI_IMAGE_MODEL = 'dall-e-3';
    const downloadImage = vi.fn().mockResolvedValue(PNG);
    const fake = clientThat([{ response: { data: [{ url: 'https://example.test/mascot.png' }] } }]);

    const image = await generateMascotImage('a mascot', { getClient: fake.getClient, downloadImage });

    expect(image.bytes.equals(PNG)).toBe(true);
    expect(image.temporaryUrl).toBe('https://example.test/mascot.png');
    expect(downloadImage).toHaveBeenCalledWith('https://example.test/mascot.png');
    expect(fake.calls[0]).toMatchObject({
      model: 'dall-e-3',
      quality: 'standard',
      response_format: 'b64_json',
    });
  });

  it('fails honestly when the answer carries no picture at all', async () => {
    const fake = clientThat([{ response: { data: [] } }]);

    await expect(generateMascotImage('a mascot', { getClient: fake.getClient })).rejects.toThrow(
      /neither image data nor a URL/,
    );
    expect(fake.calls).toHaveLength(1);
  });
});

describe('the personalisation slot taken from the account id', () => {
  it('picks a real slot for a Clerk id instead of the NaN that went into the prompt', () => {
    const index = stableIndexFromId('user_3L0xu7vQTz0qhTapoWH8k7abc', 12);

    expect(Number.isInteger(index)).toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(12);
  });

  it('is stable for the same account and spreads different accounts around', () => {
    const id = 'user_3L0xu7vQTz0qhTapoWH8k7abc';
    expect(stableIndexFromId(id, 12)).toBe(stableIndexFromId(id, 12));

    const seen = new Set<number>();
    for (let n = 0; n < 200; n += 1) seen.add(stableIndexFromId(`user_${n}`, 12));
    expect(seen.size).toBeGreaterThan(6);
  });

  it('survives an empty id or an empty list', () => {
    expect(stableIndexFromId('', 12)).toBe(0);
    expect(stableIndexFromId('user_1', 0)).toBe(0);
  });
});
