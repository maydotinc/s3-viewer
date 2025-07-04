import { Bucket, Object } from "@s3-viewer/types";

const testBuckets: Bucket[] = new Array();
for (let i = 0; i < 10000; i++) {
   testBuckets.push({
      Name: "test" + i,
      CreationDate: new Date(new Date().getTime() + i * 1000).toISOString(),
      Files: i,
      Folders: i,
      TotalSize: i,
   });
}

const testObjects: Object[] = new Array();
for (let i = 0; i < 10000; i++) {
   testObjects.push({
      Key: "test" + i,
      LastModified: new Date(new Date().getTime() + i * 1000).toISOString(),
      Size: i,
   });
}

export { testBuckets, testObjects };
