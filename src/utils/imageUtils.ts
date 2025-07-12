export interface ImageMetadata {
  timestamp: string;
  gpsLocation?: string;
  accuracy?: number;
}

/**
 * Adds timestamp and GPS information overlay to an image
 * @param canvas - The canvas element to draw on
 * @param ctx - The canvas context
 * @param metadata - Object containing timestamp and optional GPS information
 * @returns Data URL of the processed image
 */
export const addImageMetadata = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  metadata: ImageMetadata
): string => {
  const { timestamp, gpsLocation, accuracy } = metadata;
  
  // Set font properties - reduced size for more compact display
  ctx.font = 'bold 14px Arial';
  ctx.textBaseline = 'bottom';
  
  // Create background for text - reduced padding and line height
  const padding = 4;
  const lineHeight = 16;
  const lines: string[] = [];
  
  // Add timestamp - more compact format
  const date = new Date(timestamp);
  const timeString = date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  const dateString = date.toLocaleDateString('en-US', { 
    month: '2-digit', 
    day: '2-digit', 
    year: '2-digit' 
  });
  lines.push(`${dateString} ${timeString}`);
  
  // Add GPS information if available - more compact format
  if (gpsLocation) {
    // Shorten GPS coordinates to 4 decimal places
    const coords = gpsLocation.split(',');
    if (coords.length === 2) {
      const lat = parseFloat(coords[0].trim()).toFixed(4);
      const lng = parseFloat(coords[1].trim()).toFixed(4);
      lines.push(`${lat}, ${lng}`);
    } else {
      lines.push(gpsLocation);
    }
    
    if (accuracy) {
      lines.push(`±${accuracy.toFixed(0)}m`);
    }
  }
  
  // Calculate background dimensions
  let maxWidth = 0;
  lines.forEach(line => {
    const width = ctx.measureText(line).width;
    if (width > maxWidth) maxWidth = width;
  });
  
  const backgroundHeight = lines.length * lineHeight + padding * 2;
  const backgroundWidth = maxWidth + padding * 2;
  
  // Position in bottom-right corner
  const x = canvas.width - backgroundWidth - 8;
  const y = canvas.height - backgroundHeight - 8;
  
  // Draw semi-transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(x, y, backgroundWidth, backgroundHeight);
  
  // Draw text
  ctx.fillStyle = 'white';
  lines.forEach((line, index) => {
    ctx.fillText(line, x + padding, y + padding + (index + 1) * lineHeight);
  });
  
  return canvas.toDataURL('image/jpeg', 0.9);
};

/**
 * Processes an image (from camera or file upload) and adds metadata overlay
 * @param imageSrc - Base64 image data
 * @param gpsLocation - Optional GPS coordinates
 * @param accuracy - Optional GPS accuracy in meters
 * @returns Promise that resolves to the processed image data URL
 */
export const processImageWithMetadata = async (
  imageSrc: string,
  gpsLocation?: string,
  accuracy?: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw the original image
        ctx.drawImage(img, 0, 0);
        
        // Add metadata overlay
        const metadata: ImageMetadata = {
          timestamp: new Date().toLocaleString(),
          gpsLocation,
          accuracy
        };
        
        const processedImage = addImageMetadata(canvas, ctx, metadata);
        resolve(processedImage);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageSrc;
  });
};

/**
 * Captures image from video element and adds metadata overlay
 * @param videoElement - HTML video element
 * @param gpsLocation - Optional GPS coordinates
 * @param accuracy - Optional GPS accuracy in meters
 * @returns Processed image data URL
 */
export const captureImageWithMetadata = (
  videoElement: HTMLVideoElement,
  gpsLocation?: string,
  accuracy?: number
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Draw the video frame
  ctx.drawImage(videoElement, 0, 0);
  
  // Add metadata overlay
  const metadata: ImageMetadata = {
    timestamp: new Date().toLocaleString(),
    gpsLocation,
    accuracy
  };
  
  return addImageMetadata(canvas, ctx, metadata);
}; 