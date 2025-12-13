/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { HttpException, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { isBoolean, isBooleanString } from 'class-validator';
import { Types } from 'mongoose';
import * as uuid from "uuid"
// export const stringify = (value: any) => {
//   if (!value) return null;

//   try {
//     if (value instanceof Object) {
//       return JSON.stringify(value);
//     }

//     return value;
//   } catch (error) {
//     return value;
//   }
// };

// export const converToBoolean = (value: any) => {
//   if (!value) return null;

//   try {
//     if (isBoolean(value)) return value;
//     if (!isBooleanString(value)) return null;
//     if (value == 'true') return true;
//     if (value == 'false') return false;
//   } catch (error) {
//     return null;
//   }

//   return null;
// };
export function extractEmailsFromEmailResponse(input: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return input?.match(emailRegex) || [];
}

// export const stringifySafe = (value: any) => {
//   if (!value) return 'null';

//   try {
//     if (value instanceof Object) {
//       return JSON.stringify(value);
//     } else {
//       return value;
//     }
//   } catch (error) {
//     try {
//       const indent = 2;
//       let cache = [];
//       const retVal = JSON.stringify(
//         value,
//         (key, value) =>
//           typeof value === 'object' && value !== null
//             ? cache.includes(value)
//               ? undefined
//               : cache.push(value) && value
//             : value,
//         indent,
//       );
//       cache = null;
//       return retVal;
//     } catch (error) {
//       return value;
//     }
//   }
// };

export const parseSafe = (value: any) => {
  if (!value) return 'null';

  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

export const classNameOf = (cls: any) => {
  if (!cls) return '';

  try {
    if (cls instanceof Object) {
      return cls.constructor.name;
    } else {
      return cls;
    }
  } catch (error) {
    return cls;
  }
};

export const listContains = (list: string[], value: string) => {
  if (!value) return false;
  if (!list) list = [];

  for (let i = 0; i < list.length; i++) {
    if (list[i] == value) {
      return true;
    }
  }

  return false;
};

export const _toString = (id: string | Types.ObjectId): string => {
  if (typeof id === 'string') {
    return id;
  }
  return id?.toString();
};

export const StringToObjectId = (id: string | Types.ObjectId): Types.ObjectId => {
  try {
    if (id instanceof Types.ObjectId) {
      return id;
    }

    if (Types.ObjectId.isValid(id)) {
      return new Types.ObjectId(id);
    }
    throw new Error('Invalid ObjectId');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('Something went wrong when converting to object id');
  }
};

export function getExtention(fileName: string) {
  return fileName.split('.').pop();
}
export const ConvertToBatches = <T>(arr: T[], batchSize: number): T[][] => {
  const batches: T[][] = [];

  for (let i = 0; i < arr.length; i += batchSize) {
    batches.push(arr.slice(i, Math.min(i + batchSize, arr.length)));
  }

  return batches;
};
export const removeDuplicates = <T>(arr: T[]): T[] => {
  return Array.from(new Set(arr));
};
export function toObjectId(value: Types.ObjectId | string): Types.ObjectId {
  if (Types.ObjectId.isValid(value)) {
    return typeof value === 'string' ? new Types.ObjectId(value) : value;
  } else {
    throw new Error(`Invalid ObjectId or string: ${value}`);
  }
}

export function toString(value: any): string {
  if (typeof value === 'string') {
    return value;
  } else if (typeof value === 'number') {
    return value.toString();
  } else if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  } else if (value === null) {
    return 'null';
  } else if (value === undefined) {
    return 'undefined';
  } else if (Array.isArray(value)) {
    return '[' + value.map((v) => toString(v)).join(', ') + ']';
  } else if (value instanceof Date) {
    return value.toISOString();
  } else if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object Object]';
    }
  } else {
    return String(value);
  }
}

export function isTruthy(value: any): boolean {
  if (typeof value === 'string') {
    value = value.trim();
    if (
      value === '' ||
      value === 'undefined' ||
      value === 'null' ||
      value === 'false' ||
      value === '0' ||
      value === 'NaN'
    ) {
      return false;
    }
  } else if (typeof value === 'number' && (isNaN(value) || value === 0)) {
    return false;
  }
  return !!value;
}

export function toNumber(input: number | string): number {
  if (typeof input === 'number') {
    return input;
  }

  if (typeof input === 'string') {
    return parseFloat(input);
  }

  return 0;
}

export function toBoolean(input: boolean | string | number): boolean {
  if (typeof input === 'boolean') {
    return input;
  }

  if (typeof input === 'string') {
    return input.toLowerCase() === 'true';
  }

  if (typeof input === 'number') {
    return input !== 0;
  }

  return false;
}

export function sanitizeContent(content?: string): string {
  if (!content) {
    return '';
  }

  // Remove HTML tags
  const removeHtmlTags = (text: string): string => {
    return text.replace(/<\/?[^>]+(>|$)|\\/g, '');
  };

  // Decode HTML entities
  const decodeHtmlEntities = (text: string): string => {
    const entities: { [key: string]: string } = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ', // Add this if non-breaking spaces are used
    };

    for (const entity in entities) {
      const regex = new RegExp(entity, 'g');
      text = text.replace(regex, entities[entity]);
    }

    return text;
  };

  // Remove scripts and styles
  const removeScriptsAndStyles = (text: string): string => {
    return text.replace(/<script[^>]*>([\S\s]*?)<\/script>/gi, '').replace(/<style[^>]*>([\S\s]*?)<\/style>/gi, '');
  };

  // Normalize whitespace
  const normalizeWhitespace = (text: string): string => {
    return text.replace(/\s+/g, ' ').trim();
  };

  // Apply all transformations
  let sanitizedContent = content;
  sanitizedContent = removeHtmlTags(sanitizedContent);
  sanitizedContent = decodeHtmlEntities(sanitizedContent);
  sanitizedContent = removeScriptsAndStyles(sanitizedContent);
  sanitizedContent = normalizeWhitespace(sanitizedContent);

  return sanitizedContent;
}

export function handleError(error: any): string {
  if (error instanceof Error) {
    // Handle standard JavaScript Error objects
    return error.message;
  } else if (typeof error === 'string') {
    // Handle error messages that are already strings
    return error;
  } else if (typeof error === 'object' && error !== null) {
    // Handle errors that are objects with a message property
    if (error.message) {
      return error.message;
    } else {
      // Convert the object to a string if no message property exists
      return JSON.stringify(error);
    }
  } else {
    // Handle other types of errors (numbers, null, undefined, etc.)
    return String(error);
  }
}

export function handleHttpError(error: any): { statusCode: number; message: any } {
  if (error instanceof HttpException) {
    return {
      statusCode: error.getStatus(),
      message: error.getResponse() ? error.getResponse() : 'An error occurred.',
    };
  } else if (error instanceof BadRequestException) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: error.message || 'Bad request.',
    };
  } else if (error instanceof NotFoundException) {
    return {
      statusCode: HttpStatus.NOT_FOUND,
      message: error.message || 'Resource not found.',
    };
  } else if (error instanceof Error) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: error.message || 'An unknown error occurred.',
    };
  } else {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: String(error) || 'An unexpected error occurred.',
    };
  }
}

export function base64UrlDecode(base64String: string): string {
  try {
    // Replace URL-safe characters and add padding
    const safe = base64String.replace(/-/g, '+').replace(/_/g, '/');
    const padded = safe.padEnd(safe.length + ((4 - (safe.length % 4)) % 4), '=');

    // Decode
    return Buffer.from(padded, 'base64').toString('utf-8');
  } catch (error) {
    console.error('Error decoding base64 string:', error);
    return '';
  }
}

export function extractFileName(input: string) {
  let fileName: string;

  try {
    const url = new URL(input);
    fileName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
  } catch (error) {
    fileName = input.substring(input.lastIndexOf('/') + 1);
  }

  return fileName || uuid.v4();
}

export function getFileType(input: string) {
  const mimeTypes = {
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
  };

  let fileName: string;

  try {
    const url = new URL(input);
    fileName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
  } catch (error) {
    fileName = input.substring(input.lastIndexOf('/') + 1);
  }

  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

  return mimeTypes[ext] || 'unknown';
}
