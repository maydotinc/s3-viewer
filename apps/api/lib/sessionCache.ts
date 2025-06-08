interface CachedBucket {
    name: string;
    creationDate?: Date;
    region?: string;
    objectCount?: number;
    totalSize?: number;
    lastUpdated: Date;
}

interface CachedObject {
    key: string;
    size?: number;
    lastModified?: Date;
    etag?: string;
    storageClass?: string;
    contentType?: string;
    bucket: string;
}

interface SessionCacheData {
    buckets: CachedBucket[];
    objects: Map<string, CachedObject[]>; // bucket -> objects mapping
    lastUpdated: Date;
    expiresAt: Date;
}

class SessionCache {
    private cache = new Map<string, SessionCacheData>();
    private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes cleanup interval

    constructor() {
        // Setup periodic cleanup of expired cache entries
        setInterval(() => {
            this.cleanup();
        }, this.CLEANUP_INTERVAL);
    }

    private generateCacheKey(sessionId: string): string {
        return `session_${sessionId}`;
    }

    private isExpired(cacheData: SessionCacheData): boolean {
        return new Date() > cacheData.expiresAt;
    }

    private cleanup(): void {
        const now = new Date();
        for (const [key, data] of this.cache.entries()) {
            if (now > data.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    // Get cached data for a session
    getCache(sessionId: string): SessionCacheData | null {
        const cacheKey = this.generateCacheKey(sessionId);
        const cached = this.cache.get(cacheKey);
        
        if (!cached || this.isExpired(cached)) {
            if (cached) {
                this.cache.delete(cacheKey);
            }
            return null;
        }
        
        return cached;
    }

    // Initialize cache for a session
    initializeCache(sessionId: string): SessionCacheData {
        const cacheKey = this.generateCacheKey(sessionId);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.CACHE_TTL);
        
        const cacheData: SessionCacheData = {
            buckets: [],
            objects: new Map(),
            lastUpdated: now,
            expiresAt
        };
        
        this.cache.set(cacheKey, cacheData);
        return cacheData;
    }

    // Update buckets in cache
    setBuckets(sessionId: string, buckets: CachedBucket[]): void {
        let cacheData = this.getCache(sessionId);
        if (!cacheData) {
            cacheData = this.initializeCache(sessionId);
        }
        
        cacheData.buckets = buckets;
        cacheData.lastUpdated = new Date();
        cacheData.expiresAt = new Date(Date.now() + this.CACHE_TTL);
    }

    // Get buckets from cache
    getBuckets(sessionId: string): CachedBucket[] | null {
        const cacheData = this.getCache(sessionId);
        return cacheData ? cacheData.buckets : null;
    }

    // Update objects for a specific bucket in cache
    setBucketObjects(sessionId: string, bucketName: string, objects: CachedObject[]): void {
        let cacheData = this.getCache(sessionId);
        if (!cacheData) {
            cacheData = this.initializeCache(sessionId);
        }
        
        cacheData.objects.set(bucketName, objects);
        cacheData.lastUpdated = new Date();
        cacheData.expiresAt = new Date(Date.now() + this.CACHE_TTL);
    }

    // Get objects for a specific bucket from cache
    getBucketObjects(sessionId: string, bucketName: string): CachedObject[] | null {
        const cacheData = this.getCache(sessionId);
        if (!cacheData) {
            return null;
        }
        
        return cacheData.objects.get(bucketName) || null;
    }

    // Get paginated and filtered objects
    getPaginatedObjects(
        sessionId: string, 
        bucketName: string, 
        page: number = 1, 
        pageSize: number = 100,
        searchTerm?: string,
        sortField?: keyof CachedObject,
        sortDirection: 'asc' | 'desc' = 'asc'
    ): { objects: CachedObject[], totalCount: number, hasMore: boolean } | null {
        const allObjects = this.getBucketObjects(sessionId, bucketName);
        if (!allObjects) {
            return null;
        }

        let filteredObjects = allObjects;
        
        // Apply search filter
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            filteredObjects = allObjects.filter(obj => 
                obj.key.toLowerCase().includes(lowerSearchTerm) ||
                (obj.contentType && obj.contentType.toLowerCase().includes(lowerSearchTerm))
            );
        }

        // Apply sorting
        if (sortField) {
            filteredObjects.sort((a, b) => {
                const aVal = a[sortField];
                const bVal = b[sortField];
                
                if (aVal === undefined && bVal === undefined) return 0;
                if (aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
                if (bVal === undefined) return sortDirection === 'asc' ? -1 : 1;
                
                let comparison = 0;
                if (aVal < bVal) comparison = -1;
                else if (aVal > bVal) comparison = 1;
                
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        const totalCount = filteredObjects.length;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedObjects = filteredObjects.slice(startIndex, endIndex);
        const hasMore = endIndex < totalCount;

        return {
            objects: paginatedObjects,
            totalCount,
            hasMore
        };
    }

    // Invalidate cache for a session
    invalidateCache(sessionId: string): void {
        const cacheKey = this.generateCacheKey(sessionId);
        this.cache.delete(cacheKey);
    }

    // Invalidate specific bucket cache
    invalidateBucketCache(sessionId: string, bucketName: string): void {
        const cacheData = this.getCache(sessionId);
        if (cacheData) {
            cacheData.objects.delete(bucketName);
        }
    }

    // Get cache statistics
    getCacheStats(): { totalSessions: number, totalBuckets: number, totalObjects: number } {
        let totalBuckets = 0;
        let totalObjects = 0;

        for (const cacheData of this.cache.values()) {
            if (!this.isExpired(cacheData)) {
                totalBuckets += cacheData.buckets.length;
                for (const objects of cacheData.objects.values()) {
                    totalObjects += objects.length;
                }
            }
        }

        return {
            totalSessions: this.cache.size,
            totalBuckets,
            totalObjects
        };
    }
}

// Singleton instance
export const sessionCache = new SessionCache();

// Export types for use in other files
export type { CachedBucket, CachedObject, SessionCacheData };

