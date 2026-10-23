export type GarmentCategory = 'all' | 'tshirts' | 'shirts' | 'jackets' | 'hoodies' | 'trousers';

export interface Garment {
  id: string;
  name: string;
  category: Exclude<GarmentCategory, 'all'>;
  image: string;       // URL or path
  colors: string[];    // hex values
  sizes: string[];
  price?: number;
  brand?: string;
  description?: string;
}

export interface SavedLook {
  id: string;
  garmentId: string;
  garmentName: string;
  garmentImage: string;
  resultImage: string; // base64 or URL
  capturedAt: string;
}

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';
export type TryOnStatus  = 'idle' | 'capturing' | 'processing' | 'done' | 'error';
