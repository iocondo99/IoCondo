export interface ImagePickerAsset {
  uri: string;
  width: number;
  height: number;
  fileName?: string | null;
  mimeType?: string;
}

export interface ImagePickerResult {
  canceled: boolean;
  assets: ImagePickerAsset[] | null;
}

export interface ImagePickerOptions {
  mediaTypes?: 'images' | 'videos' | 'all';
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}

export async function requestCameraPermissionsAsync(): Promise<{
  status: 'granted' | 'denied';
  granted: boolean;
}> {
  return { status: 'granted', granted: true };
}

export async function launchCameraAsync(_options?: ImagePickerOptions): Promise<ImagePickerResult> {
  try {
    const dynamicRequire = Function('m', 'return require(m)') as (m: string) => {
      launchCameraAsync?: (opts?: ImagePickerOptions) => Promise<ImagePickerResult>;
    };
    const mod = dynamicRequire('expo-image-picker');
    if (mod?.launchCameraAsync) {
      return await mod.launchCameraAsync(_options);
    }
  } catch {
    // Fallback anteprima scatto su simulatore
  }
  return {
    canceled: false,
    assets: [
      {
        uri: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
        width: 800,
        height: 600,
        fileName: `guasto_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
      },
    ],
  };
}
