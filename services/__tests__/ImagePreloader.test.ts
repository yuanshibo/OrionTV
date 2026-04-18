import { ImagePreloader } from '../ImagePreloader';
import { Image } from 'expo-image';

jest.mock('expo-image', () => ({
  Image: {
    prefetch: jest.fn(),
  },
}));

describe('ImagePreloader', () => {
  beforeEach(() => {
    // Reset internal state of ImagePreloader
    ImagePreloader.clear();
    (ImagePreloader as any).activeLoads = 0; // Force reset for tests
    jest.clearAllMocks();
  });

  it('should not have negative activeLoads after clear() and request completion', async () => {
    let resolvePrefetch: (value: boolean) => void = () => {};
    const prefetchPromise = new Promise<boolean>((resolve) => {
      resolvePrefetch = resolve;
    });

    (Image.prefetch as jest.Mock).mockReturnValue(prefetchPromise);

    // Start a preload
    const preloadPromise = ImagePreloader.preload(['http://example.com/image.jpg']);

    // Wait for the async loop to reach the prefetch call
    await new Promise(resolve => setTimeout(resolve, 10));

    // Check if activeLoads is 1
    expect((ImagePreloader as any).activeLoads).toBe(1);

    // Call clear()
    ImagePreloader.clear();
    // activeLoads should NOT be 0 yet, as the request is still in flight
    expect((ImagePreloader as any).activeLoads).toBe(1);

    // Resolve the prefetch
    resolvePrefetch(true);
    await preloadPromise;

    // Check activeLoads - now it should be 0
    expect((ImagePreloader as any).activeLoads).toBe(0);
  });

  it('should respect maxConcurrent across multiple preload calls', async () => {
    const prefetchPromises: Array<(value: boolean) => void> = [];
    (Image.prefetch as jest.Mock).mockImplementation(() => {
        return new Promise((resolve) => {
            prefetchPromises.push(resolve);
        });
    });

    // Start 5 concurrent preload calls (each with one URL)
    const urls = ['url1', 'url2', 'url3', 'url4', 'url5'];
    const preloadPromises = urls.map(url => ImagePreloader.preload([url]));

    // Wait long enough for the async loops to attempt starting
    for(let i=0; i<10; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Should have maxConcurrent (3) active loads
    expect((ImagePreloader as any).activeLoads).toBe(3);
    expect(prefetchPromises.length).toBe(3);

    // Resolve ALL current ones to let others proceed
    while (prefetchPromises.length > 0) {
        const resolve = prefetchPromises.shift()!;
        resolve(true);
    }

    // Wait for remaining ones to start
    for(let i=0; i<10; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Now all 5 should have been processed or are active
    // Since we resolved 3, the remaining 2 should have started.
    expect(Image.prefetch).toHaveBeenCalledTimes(5);

    // Clean up remaining
    while (prefetchPromises.length > 0) {
        const resolve = prefetchPromises.shift()!;
        resolve(true);
    }

    await Promise.all(preloadPromises);
    expect((ImagePreloader as any).activeLoads).toBe(0);
  }, 10000);

  it('should stop preloading remaining URLs in a batch after clear()', async () => {
    (Image.prefetch as jest.Mock).mockImplementation(() => Promise.resolve(true));

    // We want to hook into Image.prefetch to call clear()
    (Image.prefetch as jest.Mock).mockImplementationOnce(async () => {
        ImagePreloader.clear();
        return true;
    });

    await ImagePreloader.preload(['url1', 'url2', 'url3']);

    // url1 should have been called, but url2 and url3 should NOT
    expect(Image.prefetch).toHaveBeenCalledTimes(1);
    expect(Image.prefetch).toHaveBeenCalledWith('url1');
    expect((ImagePreloader as any).activeLoads).toBe(0);
  });
});
