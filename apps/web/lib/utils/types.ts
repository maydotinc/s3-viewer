export type Bucket = {
    Name: string;
    CreationDate: string | Date;
}

export type Object = {
    Key: string;
    LastModified: string | Date;
    Size: number;
}

export type BucketFolder = Bucket & {
    Files: number;
    Folders: number;
    TotalSize: number;
}