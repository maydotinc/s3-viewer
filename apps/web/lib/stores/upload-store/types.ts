type UploadStatus = "pending" | "active" | "completed" | "failed" | "cancelled";

type UploadEntry = {
   id: string;
   fileName: string;
   relativePath: string;
   size: number;
   uploadedBytes: number;
   status: UploadStatus;
   error: string | null;
};

type UploadBatch = {
   ids: string[];
   settled: boolean;
   completed: number;
   failed: number;
   refusal: string | null;
};

export type { UploadBatch, UploadEntry };
