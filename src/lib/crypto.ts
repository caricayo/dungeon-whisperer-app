/**
 * Client-side encryption utilities for securing sensitive data like API keys
 */

// Generate a key from password using PBKDF2
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt data using AES-GCM
export async function encryptData(data: string, userId: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Use userId as password base + device fingerprint for additional entropy
    const deviceFingerprint = navigator.userAgent + navigator.language + screen.width + screen.height;
    const password = userId + deviceFingerprint;
    
    const key = await deriveKey(password, salt);
    const encodedData = encoder.encode(data);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );
    
    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // Return base64 encoded result
    return btoa(String.fromCharCode(...combined));
  } catch {
    console.error('Encryption failed:', _error);
    throw new Error('Failed to encrypt data');
  }
}

// Decrypt data using AES-GCM
export async function decryptData(encryptedData: string, userId: string): Promise<string> {
  try {
    const decoder = new TextDecoder();
    const combined = new Uint8Array(
      Array.from(atob(encryptedData), c => c.charCodeAt(0))
    );
    
    // Extract salt, iv, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);
    
    // Use same password derivation as encryption
    const deviceFingerprint = navigator.userAgent + navigator.language + screen.width + screen.height;
    const password = userId + deviceFingerprint;
    
    const key = await deriveKey(password, salt);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch {
    console.error('Decryption failed:', _error);
    throw new Error('Failed to decrypt data');
  }
}

// Secure memory cleanup (best effort)
export function secureWipe(data: string): void {
  // Note: In JavaScript, we can't truly wipe memory, but we can overwrite references
  if (typeof data === 'string') {
    data = '';
  }
}