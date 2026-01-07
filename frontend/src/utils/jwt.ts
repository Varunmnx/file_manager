// utils/jwt.ts
import {jwtDecode} from 'jwt-decode';

export interface JwtPayload {
  sub: string;        // user ID
  email?: string;
  name?: string;
  exp: number;        // expiration time (Unix timestamp)
  iat: number;        // issued at
  // Add other claims your backend includes
}

export const isValidToken = (token: string): boolean => {
  try {
    // 1. Basic format check
    if (!token || typeof token !== 'string') return false;

    // 2. Try to decode
    const decoded = jwtDecode<JwtPayload>(token);

    // 3. Check if expired
    const currentTime = Date.now() / 1000; // in seconds
    if (decoded.exp < currentTime) {
      console.warn('Token expired');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Invalid token:', error);
    return false;
  }
};

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwtDecode<JwtPayload>(token);
  } catch {
    return null;
  }
};