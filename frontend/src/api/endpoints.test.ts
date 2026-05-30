import * as endpoints from './endpoints';

describe('frontend api endpoints', () => {
  it('does not expose a runtime toggleDummyData helper', () => {
    expect((endpoints as Record<string, unknown>).toggleDummyData).toBeUndefined();
  });
});
