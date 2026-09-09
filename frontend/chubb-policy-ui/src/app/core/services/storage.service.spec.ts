import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  it('round-trips a JSON value', () => {
    service.set('key', { a: 1 });
    expect(service.get<{ a: number }>('key')).toEqual({ a: 1 });
  });

  it('returns null for a missing key', () => {
    expect(service.get('missing')).toBeNull();
  });

  it('removes a key', () => {
    service.set('key', 'value');
    service.remove('key');
    expect(service.get('key')).toBeNull();
  });

  it('does not throw when localStorage.getItem throws', () => {
    // Jasmine restores spies automatically after each spec, so no manual teardown.
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');

    expect(service.get('key')).toBeNull();
  });
});
