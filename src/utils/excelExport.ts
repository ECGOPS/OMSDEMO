import { saveAs } from 'file-saver';
import { NetworkInspection } from '@/lib/types';
import ExcelJS from 'exceljs';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

/**
 * Convert base64 image to blob
 */
const base64ToBlob = (base64: string, mimeType: string = 'image/jpeg'): Blob => {
  try {
    const cleanBase64 = base64.split(',')[1] || base64;
    const byteCharacters = atob(cleanBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  } catch (error) {
    console.error('Error converting base64 to blob:', error);
    return new Blob([], { type: mimeType });
  }
};

/**
 * Convert blob to base64 data URL
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result && typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert Firebase Storage URL to base64 using Firebase SDK (bypasses CORS)
 */
async function firebaseUrlToBase64(storageUrl: string): Promise<string> {
  try {
    // Extract the path from the Firebase Storage URL
    // URL format: https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Fimage?alt=media&token=...
    const url = new URL(storageUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+)/);
    
    if (!pathMatch) {
      console.warn('Could not extract path from Firebase Storage URL:', storageUrl);
      return '';
    }
    
    // Decode the path (remove %2F encoding)
    const imagePath = decodeURIComponent(pathMatch[1]);
    
    // Use Firebase SDK to get the image
    const storage = getStorage();
    const imageRef = ref(storage, imagePath);
    
    // Get download URL (this bypasses CORS)
    const downloadURL = await getDownloadURL(imageRef);
    
    // Fetch the image using the download URL
    const response = await fetch(downloadURL);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const blob = await response.blob();
    return await blobToBase64(blob);
  } catch (error) {
    console.error('Error converting Firebase Storage URL to base64:', error);
    return '';
  }
}

/**
 * Convert any image URL to base64, handling Firebase Storage URLs specially
 */
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    // Check if it's a Firebase Storage URL
    if (url.includes('firebasestorage.googleapis.com')) {
      return await firebaseUrlToBase64(url);
    }
    
    // For other URLs, use regular fetch
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const blob = await response.blob();
    return await blobToBase64(blob);
  } catch (error) {
    console.error('Error converting image URL to base64:', error);
    return '';
  }
}

// Browser-compatible base64 to buffer conversion
function base64ToBuffer(base64: string): Uint8Array {
  try {
    // Remove data URL prefix if present
    const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Decode base64 to binary string
    const binaryString = atob(base64Data);
    
    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  } catch (error) {
    console.error('Error converting base64 to buffer:', error);
    throw error;
  }
}

/**
 * Truncate base64 string to fit Excel cell limit
 */
const truncateBase64 = (base64: string, maxLength: number = 32000): string => {
  if (!base64 || typeof base64 !== 'string') {
    return '';
  }
  if (base64.length <= maxLength) {
    return base64;
  }
  // Truncate and add note
  return base64.substring(0, maxLength) + '... [TRUNCATED - Full image data available in Images sheet]';
};

/**
 * Safely split string into chunks
 */
const splitIntoChunks = (str: string, chunkSize: number = 30000): string[] => {
  if (!str || typeof str !== 'string') {
    return [];
  }
  
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.substring(i, i + chunkSize));
  }
  return chunks;
};

/**
 * Export overhead line inspections to Excel with embedded images using ExcelJS
 */
export const exportOverheadLineInspectionsToExcel = async (
  inspections: NetworkInspection[],
  filename: string = 'network-inspections.xlsx',
  onProgress?: (progress: { current: number; total: number; percentage: number; stage: string }) => void
) => {
  try {
    console.log('ExcelJS export utility called with:', inspections.length, 'inspections');
    
    // Initialize progress tracking
    let currentProgress = 0;
    const totalSteps = inspections.length * 2 + 5; // Each inspection has 2 image processing steps + 5 setup steps
    
    const updateProgress = (stage: string, increment: number = 1) => {
      currentProgress += increment;
      const percentage = Math.round((currentProgress / totalSteps) * 100);
      onProgress?.({
        current: currentProgress,
        total: totalSteps,
        percentage,
        stage
      });
    };
    
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    updateProgress('Creating workbook...');
    console.log('Workbook created');
    
    // Create the main worksheet
    const worksheet = workbook.addWorksheet('Network Inspections');
    updateProgress('Setting up worksheet...');
    console.log('Worksheet created');
    
    // Define headers
    const headers = [
      'Inspection ID',
      'Date',
      'Region',
      'District', 
      'Feeder Name',
      'Voltage Level',
      'Reference Pole',
      'Additional Notes',
      'Status',
      'Pole ID',
      'Pole Height',
      'Pole Type',
      'Pole Location',
      'GPS Coordinates',
      'Inspector Name',
      'Inspector Email',
      // Pole Condition
      'Pole Tilted',
      'Pole Broken',
      'Pole Rotten', 
      'Pole Burnt',
      'Pole Substandard',
      'Pole Conflict with LV',
      'Pole Condition Notes',
      // Stay Condition
      'Stay Required but Not Available',
      'Stay Cut',
      'Stay Misaligned', 
      'Stay Defective',
      'Stay Condition Notes',
      // Cross Arm Condition
      'Cross Arm Misaligned',
      'Cross Arm Bend',
      'Cross Arm Corroded',
      'Cross Arm Substandard',
      'Cross Arm Others',
      'Cross Arm Notes',
      // Insulator Condition
      'Insulator Type',
      'Insulator Broken/Cracked',
      'Insulator Burnt/Flash Over',
      'Insulator Shattered',
      'Insulator Defective Binding',
      'Insulator Notes',
      // Conductor Condition
      'Conductor Loose Connectors',
      'Conductor Weak Jumpers',
      'Conductor Burnt Lugs',
      'Conductor Sagged Line',
      'Conductor Broken',
      'Conductor Undersized',
      'Conductor Notes',
      // Lightning Arrester Condition
      'Arrester Broken/Cracked',
      'Arrester Flash Over',
      'Arrester No Earthing',
      'Arrester Bypassed',
      'Arrester No Arrester',
      'Arrester Notes',
      // Vegetation Conflicts
      'Vegetation Climbers',
      'Vegetation Trees',
      'Vegetation Conflicts Notes',
      // New fields before images
      'GPS',
      'Location',
      'Additional Note',
      // Images (Before Correction)
      'Before Image 1',
      'Before Image 2',
      'Before Image 3',
      'Before Image 4',
      'Before Image 5',
      // Images (After Correction)
      'After Image 1',
      'After Image 2',
      'After Image 3',
      'After Image 4',
      'After Image 5'
    ];

    // Add headers
    worksheet.addRow(headers);
    console.log('Headers added');
    console.log('Total columns:', headers.length);
    console.log('Image columns are at positions 52-56 (0-indexed), which are Excel columns AZ-BD');

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    console.log('Processing inspection data...');
    updateProgress('Processing inspection data...');
    
    // Process each inspection
    for (let index = 0; index < inspections.length; index++) {
      const inspection = inspections[index];
      try {
        console.log(`Processing inspection ${index + 1}/${inspections.length}:`, inspection.id);
        updateProgress(`Processing inspection ${index + 1}/${inspections.length}...`);
        
        // Process images
        const images = Array.isArray(inspection.images) ? inspection.images : [];
        const afterImages = Array.isArray(inspection.afterImages) ? inspection.afterImages : [];
        const imageBuffers = await Promise.all(
          images.slice(0, 5).map(async (image, imgIndex) => {
            try {
              if (typeof image === 'string') {
                if (image.startsWith('data:')) {
                  // Already base64, convert to buffer
                  return base64ToBuffer(image);
                } else if (image.startsWith('http')) {
                  console.log(`Converting image ${imgIndex + 1} from URL:`, image);
                  const base64 = await imageUrlToBase64(image);
                  if (base64 && base64.startsWith('data:')) {
                    return base64ToBuffer(base64);
                  } else {
                    console.log(`⚠️ Skipping image ${imgIndex + 1} - could not convert URL to base64`);
                    return null;
                  }
                }
              }
              return null;
            } catch (error) {
              console.error(`Error processing image ${imgIndex + 1}:`, error);
              return null;
            }
          })
        );

        // Pad with null if less than 5 images
        while (imageBuffers.length < 5) {
          imageBuffers.push(null);
        }

        // Process afterImages
        updateProgress(`Processing after images for inspection ${index + 1}...`);
        const afterImageBuffers = await Promise.all(
          afterImages.slice(0, 5).map(async (image, imgIndex) => {
            try {
              if (typeof image === 'string') {
                if (image.startsWith('data:')) {
                  return base64ToBuffer(image);
                } else if (image.startsWith('http')) {
                  const base64 = await imageUrlToBase64(image);
                  if (base64 && base64.startsWith('data:')) {
                    return base64ToBuffer(base64);
                  } else {
                    console.log(`⚠️ Skipping after image ${imgIndex + 1} - could not convert URL to base64`);
                    return null;
                  }
                }
              }
              return null;
            } catch (error) {
              return null;
            }
          })
        );
        while (afterImageBuffers.length < 5) {
          afterImageBuffers.push(null);
        }

        // Create data row
        const dataRow = [
          inspection.id || '',
          inspection.date || new Date(inspection.createdAt).toLocaleDateString(),
          inspection.region || 'Unknown',
          inspection.district || 'Unknown',
          inspection.feederName || '',
          inspection.voltageLevel || '',
          inspection.referencePole || '',
          inspection.additionalNotes || 'N/A',
          inspection.status || '',
          inspection.poleId || '',
          inspection.poleHeight || '',
          inspection.poleType || '',
          inspection.groundCondition || '',
          `${inspection.latitude || 0}, ${inspection.longitude || 0}`,
          inspection.inspector?.name || '',
          inspection.inspector?.email || '',
          // Pole Condition
          inspection.poleCondition?.tilted ? 'Yes' : 'No',
          inspection.poleCondition?.broken ? 'Yes' : 'No',
          inspection.poleCondition?.rotten ? 'Yes' : 'No',
          inspection.poleCondition?.burnt ? 'Yes' : 'No',
          inspection.poleCondition?.substandard ? 'Yes' : 'No',
          inspection.poleCondition?.conflictWithLV ? 'Yes' : 'No',
          inspection.poleCondition?.notes || 'N/A',
          // Stay Condition
          inspection.stayCondition?.requiredButNotAvailable ? 'Yes' : 'No',
          inspection.stayCondition?.cut ? 'Yes' : 'No',
          inspection.stayCondition?.misaligned ? 'Yes' : 'No',
          inspection.stayCondition?.defectiveStay ? 'Yes' : 'No',
          inspection.stayCondition?.notes || 'N/A',
          // Cross Arm Condition
          inspection.crossArmCondition?.misaligned ? 'Yes' : 'No',
          inspection.crossArmCondition?.bend ? 'Yes' : 'No',
          inspection.crossArmCondition?.corroded ? 'Yes' : 'No',
          inspection.crossArmCondition?.substandard ? 'Yes' : 'No',
          inspection.crossArmCondition?.others ? 'Yes' : 'No',
          inspection.crossArmCondition?.notes || 'N/A',
          // Insulator Condition
          inspection.insulatorCondition?.insulatorType || 'N/A',
          inspection.insulatorCondition?.brokenOrCracked ? 'Yes' : 'No',
          inspection.insulatorCondition?.burntOrFlashOver ? 'Yes' : 'No',
          inspection.insulatorCondition?.shattered ? 'Yes' : 'No',
          inspection.insulatorCondition?.defectiveBinding ? 'Yes' : 'No',
          inspection.insulatorCondition?.notes || 'N/A',
          // Conductor Condition
          inspection.conductorCondition?.looseConnectors ? 'Yes' : 'No',
          inspection.conductorCondition?.weakJumpers ? 'Yes' : 'No',
          inspection.conductorCondition?.burntLugs ? 'Yes' : 'No',
          inspection.conductorCondition?.saggedLine ? 'Yes' : 'No',
          inspection.conductorCondition?.broken ? 'Yes' : 'No',
          inspection.conductorCondition?.undersized ? 'Yes' : 'No',
          inspection.conductorCondition?.notes || 'N/A',
          // Lightning Arrester Condition
          inspection.lightningArresterCondition?.brokenOrCracked ? 'Yes' : 'No',
          inspection.lightningArresterCondition?.flashOver ? 'Yes' : 'No',
          inspection.lightningArresterCondition?.noEarthing ? 'Yes' : 'No',
          inspection.lightningArresterCondition?.bypassed ? 'Yes' : 'No',
          inspection.lightningArresterCondition?.noArrester ? 'Yes' : 'No',
          inspection.lightningArresterCondition?.notes || 'N/A',
          // Vegetation Conflicts
          inspection.vegetationConflicts?.climbers ? 'Yes' : 'No',
          inspection.vegetationConflicts?.trees ? 'Yes' : 'No',
          inspection.vegetationConflicts?.notes || 'N/A',
          // New fields before images
          `${inspection.latitude || 0}, ${inspection.longitude || 0}`,
          inspection.location || '',
          inspection.additionalNotes || '',
          // Images - placeholder text with hyperlinks (positioned to match image columns)
          '', // Placeholder for Image 1 (column 52 - AZ)
          '', // Placeholder for Image 2 (column 53 - BA) 
          '', // Placeholder for Image 3 (column 54 - BB)
          '', // Placeholder for Image 4 (column 55 - BC)
          '', // Placeholder for Image 5 (column 56 - BD)
          '', // Placeholder for After Image 1 (column 57 - BE)
          '', // Placeholder for After Image 2 (column 58 - BF)
          '', // Placeholder for After Image 3 (column 59 - BG)
          '', // Placeholder for After Image 4 (column 60 - BH)
          ''  // Placeholder for After Image 5 (column 61 - BI)
        ];

        // Add the row
        const row = worksheet.addRow(dataRow);
        const rowNumber = row.number;
        
        // Set row height to accommodate images (4 cm = approximately 113.4 points)
        row.height = 113.4; // 4 cm in points

        // Add embedded images to the row
        for (let imgIndex = 0; imgIndex < imageBuffers.length; imgIndex++) {
          const imageBuffer = imageBuffers[imgIndex];
          if (imageBuffer && imageBuffer.byteLength > 0) {
            try {
              console.log(`Processing image ${imgIndex + 1}, buffer size: ${imageBuffer.byteLength} bytes`);
              
              // Add image to the workbook
              const imageId = workbook.addImage({
                buffer: imageBuffer,
                extension: 'jpeg',
              });

              // Move image columns to start at column 56 (BD) - adjusted for vegetation conflicts
              const imageCol = 56 + imgIndex; // Image columns start at column 56 (BD)
              const imageRow = rowNumber - 1; // Excel rows are 0-indexed
              
              console.log(`Positioning image ${imgIndex + 1} at column ${imageCol}, row ${imageRow}`);
              
              // Add image to worksheet with 4x4 cm sizing
              worksheet.addImage(imageId, {
                tl: { 
                  nativeCol: imageCol, 
                  nativeRow: imageRow,
                  nativeColOff: 0,
                  nativeRowOff: 0
                },
                br: { 
                  nativeCol: imageCol + 1, 
                  nativeRow: imageRow + 1,
                  nativeColOff: 0,
                  nativeRowOff: 0
                },
                editAs: 'oneCell'
              } as any);

              console.log(`Successfully added image ${imgIndex + 1} to row ${rowNumber}, column ${imageCol + 1} (Excel column ${String.fromCharCode(65 + imageCol)})`);
            } catch (imageError) {
              console.error(`Error adding image ${imgIndex + 1} to Excel:`, imageError);
            }
          } else {
            console.log(`No image data for image ${imgIndex + 1}`);
          }
        }

        // Add embedded afterImages to the row
        for (let imgIndex = 0; imgIndex < afterImageBuffers.length; imgIndex++) {
          const imageBuffer = afterImageBuffers[imgIndex];
          if (imageBuffer && imageBuffer.byteLength > 0) {
            try {
              const imageId = workbook.addImage({
                buffer: imageBuffer,
                extension: 'jpeg',
              });
              // After images start at column 61 (BG) - adjusted for vegetation conflicts
              const imageCol = 61 + imgIndex;
              const imageRow = rowNumber - 1;
              worksheet.addImage(imageId, {
                tl: { nativeCol: imageCol, nativeRow: imageRow, nativeColOff: 0, nativeRowOff: 0 },
                br: { nativeCol: imageCol + 1, nativeRow: imageRow + 1, nativeColOff: 0, nativeRowOff: 0 },
                editAs: 'oneCell'
              } as any);
            } catch (imageError) {}
          }
        }

        // Add clickable links row below the data row
        const linkRow = new Array(66).fill(''); // Fill with empty cells up to after image columns (adjusted for vegetation conflicts)
        for (let imgIndex = 0; imgIndex < Math.min(images.length, 5); imgIndex++) {
          const image = images[imgIndex];
          if (typeof image === 'string' && image.startsWith('http')) {
            linkRow[56 + imgIndex] = `Click to open Image ${imgIndex + 1}`;
          }
        }
        for (let imgIndex = 0; imgIndex < Math.min(afterImages.length, 5); imgIndex++) {
          const image = afterImages[imgIndex];
          if (typeof image === 'string' && image.startsWith('http')) {
            linkRow[61 + imgIndex] = `Click to open After Image ${imgIndex + 1}`;
          }
        }
        
        const linksRow = worksheet.addRow(linkRow);
        const linksRowNumber = linksRow.number;
        
        // Add hyperlinks to the links row
        for (let imgIndex = 0; imgIndex < Math.min(images.length, 5); imgIndex++) {
          const image = images[imgIndex];
          if (typeof image === 'string' && image.startsWith('http')) {
            const imageCol = 56 + imgIndex; // Image columns start at column 56 (BD) - adjusted for vegetation conflicts
            const cell = worksheet.getCell(linksRowNumber, imageCol + 1); // Excel is 1-indexed for cells
            
            // Add hyperlink to the cell
            cell.value = {
              text: `Click to open Image ${imgIndex + 1}`,
              hyperlink: image,
              tooltip: `Click to open Image ${imgIndex + 1} in browser`
            };
            
            // Style the hyperlink
            cell.font = {
              color: { argb: 'FF0000FF' }, // Blue color
              underline: true,
              bold: true
            };
            
            console.log(`Added clickable link for image ${imgIndex + 1} to: ${image}`);
          } else {
            console.log(`Skipping image ${imgIndex + 1} - not a valid URL:`, image);
          }
        }
        for (let imgIndex = 0; imgIndex < Math.min(afterImages.length, 5); imgIndex++) {
          const image = afterImages[imgIndex];
          if (typeof image === 'string' && image.startsWith('http')) {
            const imageCol = 61 + imgIndex; // After images start at column 61 (BG) - adjusted for vegetation conflicts
            const cell = worksheet.getCell(linksRowNumber, imageCol + 1);
            cell.value = {
              text: `Click to open After Image ${imgIndex + 1}`,
              hyperlink: image,
              tooltip: `Click to open After Image ${imgIndex + 1} in browser`
            };
            cell.font = {
              color: { argb: 'FF0000FF' },
              underline: true,
              bold: true
            };
            console.log(`Added clickable link for after image ${imgIndex + 1} to: ${image}`);
          } else {
            console.log(`Skipping after image ${imgIndex + 1} - not a valid URL:`, image);
          }
        }

      } catch (error) {
        console.error(`Error processing inspection ${inspection.id}:`, error);
        // Add error row
        const errorRow = [
          inspection.id || 'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR',
          'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR',
          'ERROR',
          'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR',
          'ERROR',
          'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR',
          'ERROR',
          'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR',
          'ERROR',
          'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR',
          'ERROR',
          'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR',
          'ERROR',
          'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR',
          'ERROR',
          'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR'
        ];
        worksheet.addRow(errorRow);
      }
    }

    // Set column widths
    worksheet.columns.forEach((column, index) => {
      if (index < 15) {
        column.width = 15;
      } else if (index < 52) {
        column.width = 12;
      } else {
        // Image columns (52-66) - make them 4 cm wide (approximately 15.2 characters)
        column.width = 15.2;
      }
    });

    // Create a test images sheet to verify image embedding
    if (inspections.some(inspection => inspection.images && inspection.images.length > 0)) {
      console.log('Creating test images sheet...');
      const testSheet = workbook.addWorksheet('Test Images');
      
      // Add a simple test image
      const firstInspectionWithImages = inspections.find(inspection => 
        inspection.images && inspection.images.length > 0
      );
      
      if (firstInspectionWithImages && firstInspectionWithImages.images && firstInspectionWithImages.images.length > 0) {
        const testImage = firstInspectionWithImages.images[0];
        if (typeof testImage === 'string') {
          try {
            let imageBuffer: Uint8Array | null = null;
            
            if (testImage.startsWith('data:')) {
              imageBuffer = base64ToBuffer(testImage);
            } else {
              const response = await fetch(testImage);
              const blob = await response.blob();
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              imageBuffer = base64ToBuffer(base64);
            }

            if (imageBuffer && imageBuffer.length > 0) {
              console.log('Adding test image to Excel, buffer size:', imageBuffer.length);
              
              // Add image to the test sheet
              const imageId = workbook.addImage({
                buffer: imageBuffer,
                extension: 'png',
              });

              // Add image to cell A1 of test sheet
              testSheet.addImage(imageId, {
                tl: { 
                  nativeCol: 0, 
                  nativeRow: 0, 
                  nativeColOff: 0, 
                  nativeRowOff: 0 
                },
                br: { 
                  nativeCol: 1, 
                  nativeRow: 1, 
                  nativeColOff: 0, 
                  nativeRowOff: 0 
                },
                editAs: 'oneCell'
              } as any);

              console.log('Test image added successfully');
            }
          } catch (error) {
            console.error('Error adding test image:', error);
          }
        }
      }
    }

    updateProgress('Generating Excel file...');
    console.log('Generating Excel file...');
    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    updateProgress('Creating file buffer...');
    console.log('Excel buffer created, size:', buffer.byteLength);
    
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    updateProgress('Preparing file for download...');
    console.log('Blob created, size:', blob.size);
    
    // Save file
    updateProgress('Downloading file...');
    console.log('Saving file:', filename);
    saveAs(blob, filename);
    updateProgress('Export completed!', 0); // Don't increment, just update stage
    console.log('File saved successfully');
    
    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
};

/**
 * Export single inspection to Excel with embedded images
 */
export const exportSingleInspectionToExcel = async (
  inspection: NetworkInspection,
  filename?: string,
  onProgress?: (progress: { current: number; total: number; percentage: number; stage: string }) => void
) => {
  const defaultFilename = `inspection-${inspection.id}-${new Date().toISOString().split('T')[0]}.xlsx`;
  return exportOverheadLineInspectionsToExcel([inspection], filename || defaultFilename, onProgress);
}; 