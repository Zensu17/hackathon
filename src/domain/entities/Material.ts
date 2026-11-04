export interface MaterialAttachment {
  name: string;
  sizeBytes: number;
  mimeType: string;
  storagePath: string;
  remoteUrl: string | null;
}

// Use Uint8Array instead of DOM File or Blob so domain and application layers remain platform-independent.
export interface MaterialUploadInput {
  name: string;
  sizeBytes: number;
  mimeType: string;
  bytes: Uint8Array;
}

export interface Material {
  id: string;
  courseId: string;
  weekId: string;
  title: string;
  description: string;
  externalUrl: string | null;
  attachment: MaterialAttachment | null;
  isAvailableOffline: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
