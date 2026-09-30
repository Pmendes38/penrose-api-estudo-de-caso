// src/modules/uploads/uploader/uploader.port.ts
export type UploadedFileInfo = { key: string; url: string; contentType: string; bytes: number };

export interface UploaderPort {
  uploadMany(files: Array<{ buffer: Buffer; contentType: string; suggestedExt?: string }>, opts?: {
    folder?: string;
  }): Promise<UploadedFileInfo[]>;
}
