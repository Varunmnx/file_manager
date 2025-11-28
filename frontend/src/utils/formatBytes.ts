export function formatBytes(bytes:number, decimals = 2) {
  // Error handling
  if (bytes === null || bytes === undefined) {
    throw new Error('Bytes value is required');
  }
  
  if (typeof bytes !== 'number') {
    throw new Error('Bytes must be a number');
  }
  
  if (isNaN(bytes)) {
    throw new Error('Bytes cannot be NaN');
  }
  
  if (bytes < 0) {
    throw new Error('Bytes cannot be negative');
  }
  
  if (!Number.isFinite(bytes)) {
    throw new Error('Bytes must be a finite number');
  }
  
  if (decimals < 0) {
    throw new Error('Decimals cannot be negative');
  }
  
  // Handle zero
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}
