import { Bucket } from "web/types";

const formatBuckets = (response: any): Bucket[] => {
    return response.Buckets.map((bucket: any) => ({
        Name: bucket.Name,
        CreationDate: bucket.CreationDate,
    }));
};

export default formatBuckets;
