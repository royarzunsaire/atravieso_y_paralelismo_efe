const cache = new Map();

export async function cachedGet(key, fetcher, { ttlMs = 15000, forceRefresh = false } = {}) {
    const now = Date.now();
    const cached = cache.get(key);

    if (!forceRefresh && cached?.data !== undefined && now < cached.expiresAt) {
        return cached.data;
    }

    if (!forceRefresh && cached?.promise) {
        return cached.promise;
    }

    const promise = Promise.resolve()
        .then(fetcher)
        .then((data) => {
            cache.set(key, {
                data,
                expiresAt: Date.now() + ttlMs,
                promise: null,
            });
            return data;
        })
        .catch((error) => {
            const current = cache.get(key);
            if (current?.promise) {
                cache.delete(key);
            }
            throw error;
        });

    cache.set(key, {
        data: cached?.data,
        expiresAt: cached?.expiresAt || 0,
        promise,
    });

    return promise;
}

export function invalidateCache(keyPrefix) {
    for (const key of cache.keys()) {
        if (key.startsWith(keyPrefix)) {
            cache.delete(key);
        }
    }
}