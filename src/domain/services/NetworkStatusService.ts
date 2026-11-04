export type ConnectionQuality = 'offline' | 'slow' | 'online';

export type NetworkStatusListener = (status: ConnectionQuality) => void;

export interface NetworkStatusService {
  getStatus(): ConnectionQuality;
  subscribe(listener: NetworkStatusListener): () => void;
}
