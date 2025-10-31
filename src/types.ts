export type UserMetadata = {
  author?: string;
  expiresAt?: string; // ISO
  [k: string]: any;
};

export type StoredItem = {
  file_id: string;
  bucket: string;
  key: string;
  status: "PENDING_UPLOAD" | "UPLOADED" | "EXTRACTED" | "ERROR";
  userMetadata?: UserMetadata;
  systemMetadata?: {
    size?: number;
    mimeType?: string;
    pages?: number;
    width?: number;
    height?: number;
    sha256?: string;
  };
  createdAt: string;
  updatedAt: string;
};
