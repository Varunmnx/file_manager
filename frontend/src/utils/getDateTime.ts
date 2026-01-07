/* eslint-disable @typescript-eslint/no-explicit-any */
export function formatDate(isoString:string, options = {}) {
  // Error handling
  if (!isoString) {
    throw new Error('Date string is required');
  }
  
  if (typeof isoString !== 'string') {
    throw new Error('Date must be a string');
  }
  
  const date = new Date(isoString);
  
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date string');
  }
  
  // Default format options
  const defaultOptions = {
    format: 'full', // 'full', 'long', 'medium', 'short', 'relative'
    locale: 'en-US',
    includeTime: true
  };
  
  const config = { ...defaultOptions, ...options };
  
  // Different format options
  switch (config.format) {
    case 'full':
      return date.toLocaleString(config.locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
    case 'long':
      return date.toLocaleString(config.locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
    case 'medium':
      return date.toLocaleString(config.locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
    case 'short':
      return date.toLocaleString(config.locale, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
    case 'relative':
      return getRelativeTime(date as unknown as number);
      
    default:
      return date.toLocaleString(config.locale);
  }
}

export function getRelativeTime(date: number) {
  const now = new Date();
  const diffMs = now.getDate() - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`;
}
 
export function getShortDate(isoString:string) {
  // Error handling
  if (!isoString) {
    throw new Error('Date string is required');
  }
  
  if (typeof isoString !== 'string') {
    throw new Error('Date must be a string');
  }
  
  const date = new Date(isoString);
  
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date string');
  }
  
  // Format as "MMM DD, YYYY"
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  
  return date.toLocaleDateString('en-US', options as any);
}