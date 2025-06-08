import { HeadBucketCommand, ListBucketsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client } from "./s3.js";
import { CachedBucket, CachedObject, sessionCache } from "./sessionCache.js";

export const fetchAndCacheBuckets = async (sessionId: string): Promise<CachedBucket[]> => {
    try {
        const command = new ListBucketsCommand({});
        const response = await s3Client.send(command);
        
        const buckets: CachedBucket[] = [];
        
        if (response.Buckets) {
            // Fetch additional metadata for each bucket in parallel
            const bucketPromises = response.Buckets.map(async (bucket) => {
                if (!bucket.Name) return null;
                
                try {
                    // Get bucket region and other metadata
                    const headCommand = new HeadBucketCommand({ Bucket: bucket.Name });
                    await s3Client.send(headCommand);
                    
                    const cachedBucket: CachedBucket = {
                        name: bucket.Name,
                        creationDate: bucket.CreationDate,
                        lastUpdated: new Date(),
                        // These will be populated when listing objects
                        objectCount: 0,
                        totalSize: 0
                    };
                    
                    return cachedBucket;
                } catch (error) {
                    console.warn(`Failed to get metadata for bucket ${bucket.Name}:`, error);
                    return {
                        name: bucket.Name,
                        creationDate: bucket.CreationDate,
                        lastUpdated: new Date(),
                        objectCount: 0,
                        totalSize: 0
                    } as CachedBucket;
                }
            });
            
            const resolvedBuckets = await Promise.all(bucketPromises);
            buckets.push(...resolvedBuckets.filter(Boolean) as CachedBucket[]);
        }
        
        // Cache the buckets
        sessionCache.setBuckets(sessionId, buckets);
        return buckets;
    } catch (error) {
        console.error("Error fetching buckets:", error);
        throw error;
    }
};

export const fetchAndCacheBucketObjects = async (
    sessionId: string, 
    bucketName: string,
    maxObjects: number = 10000 // Limit to prevent memory issues
): Promise<CachedObject[]> => {
    try {
        const objects: CachedObject[] = [];
        let continuationToken: string | undefined;
        let objectCount = 0;
        
        do {
            const command = new ListObjectsV2Command({
                Bucket: bucketName,
                MaxKeys: Math.min(1000, maxObjects - objectCount), // AWS limit is 1000 per request
                ContinuationToken: continuationToken
            });
            
            const response = await s3Client.send(command);
            
            if (response.Contents) {
                const batchObjects: CachedObject[] = response.Contents.map(obj => ({
                    key: obj.Key || '',
                    size: obj.Size,
                    lastModified: obj.LastModified,
                    etag: obj.ETag,
                    storageClass: obj.StorageClass,
                    bucket: bucketName
                }));
                
                objects.push(...batchObjects);
                objectCount += batchObjects.length;
            }
            
            continuationToken = response.NextContinuationToken;
            
            // Break if we've reached our object limit
            if (objectCount >= maxObjects) {
                console.warn(`Reached object limit of ${maxObjects} for bucket ${bucketName}`);
                break;
            }
            
        } while (continuationToken);
        
        // Update bucket metadata with object count and total size
        const cachedBuckets = sessionCache.getBuckets(sessionId);
        if (cachedBuckets) {
            const bucketIndex = cachedBuckets.findIndex(b => b.name === bucketName);
            if (bucketIndex !== -1 && cachedBuckets[bucketIndex]) {
                cachedBuckets[bucketIndex]!.objectCount = objects.length;
                cachedBuckets[bucketIndex]!.totalSize = objects.reduce((sum, obj) => sum + (obj.size || 0), 0);
                cachedBuckets[bucketIndex]!.lastUpdated = new Date();
                sessionCache.setBuckets(sessionId, cachedBuckets);
            }
        }
        
        // Cache the objects
        sessionCache.setBucketObjects(sessionId, bucketName, objects);
        return objects;
    } catch (error) {
        console.error(`Error fetching objects for bucket ${bucketName}:`, error);
        throw error;
    }
};

export const getOrFetchBuckets = async (sessionId: string, forceRefresh: boolean = false): Promise<CachedBucket[]> => {
    if (!forceRefresh) {
        const cached = sessionCache.getBuckets(sessionId);
        if (cached) {
            return cached;
        }
    }
    
    return await fetchAndCacheBuckets(sessionId);
};

export const getOrFetchBucketObjects = async (
    sessionId: string, 
    bucketName: string, 
    forceRefresh: boolean = false
): Promise<CachedObject[]> => {
    if (!forceRefresh) {
        const cached = sessionCache.getBucketObjects(sessionId, bucketName);
        if (cached) {
            return cached;
        }
    }
    
    return await fetchAndCacheBucketObjects(sessionId, bucketName);
};

export const invalidateSessionCache = (sessionId: string): void => {
    sessionCache.invalidateCache(sessionId);
};

export const invalidateBucketCache = (sessionId: string, bucketName: string): void => {
    sessionCache.invalidateBucketCache(sessionId, bucketName);
}; 