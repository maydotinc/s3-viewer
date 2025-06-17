import { BucketFolder } from "./types";

const testData: BucketFolder[] = new Array;
for (let i = 0; i < 100; i++) {
    testData.push({
        Name: "test" + i,
        CreationDate: new Date(new Date().getTime() + i * 1000).toISOString(),
        Files: i,
        Folders: i,
        TotalSize: i,
    });
}

export default testData;