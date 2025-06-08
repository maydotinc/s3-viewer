type S3Bucket = {
    BucketRegion: string;
    CreationDate: string;
    Name: string;
}

type S3Object = {
    ChecksumAlgorithm: string;
    ChecksumType: string;
    ETag: string;
    Key: string;
    LastModified: string;
    Size: number;
    StorageClass: string;
}