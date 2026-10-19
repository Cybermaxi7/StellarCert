import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

function build(nodeEnv: string) {
  const config = {
    get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined),
  } as unknown as ConfigService;
  const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { create: () => new EmailService(config, logger as never), logger };
}

describe('EmailService template loading', () => {
  afterEach(() => jest.restoreAllMocks());

  it('loads all six templates from the source tree', () => {
    const { create } = build('test');
    const service = create();
    expect((service as unknown as { templates: Map<string, unknown> }).templates.size).toBe(6);
  });

  it('logs and carries on outside production when a template is missing', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const { create, logger } = build('development');

    expect(() => create()).not.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });

  it('fails startup in production when a template cannot be loaded', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const { create } = build('production');

    expect(() => create()).toThrow(/Email templates could not be loaded/);
  });
});
