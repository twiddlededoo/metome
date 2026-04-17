// End-to-end encryption utilities using Web Crypto API
// Implements ECDH key exchange + AES-GCM encryption

export interface KeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicKeyBase64: string;
}

export interface EncryptedFile {
  data: ArrayBuffer; // Encrypted ciphertext
  iv: Uint8Array; // 12-byte IV for AES-GCM
  senderPublicKey: string; // Base64 encoded sender's public key
}

export interface QRData {
  sessionId: string;
  receiverPublicKey: string; // Base64 encoded receiver's public key
}

class EncryptionManager {
  private readonly ALGORITHM = 'ECDH';
  private readonly CURVE = 'P-256';
  private readonly ENCRYPTION_ALGORITHM = 'AES-GCM';
  private readonly IV_LENGTH = 12; // 96 bits for AES-GCM
  private readonly HKDF_INFO = 'file-transfer';

  /**
   * Generate ECDH key pair for the receiver (laptop)
   */
  async generateReceiverKeyPair(): Promise<KeyPair> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        namedCurve: this.CURVE,
      },
      true, // extractable
      [] // no usage needed for ECDH public key
    );

    const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyBase64 = this.arrayBufferToBase64(publicKeyBuffer);

    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeyBase64,
    };
  }

  /**
   * Generate ECDH key pair for the sender (phone)
   */
  async generateSenderKeyPair(): Promise<KeyPair> {
    return this.generateReceiverKeyPair(); // Same implementation
  }

  /**
   * Derive shared secret using ECDH
   */
  async deriveSharedSecret(
    privateKey: CryptoKey,
    peerPublicKeyBase64: string
  ): Promise<CryptoKey> {
    const peerPublicKeyBuffer = this.base64ToArrayBuffer(peerPublicKeyBase64);
    const peerPublicKey = await crypto.subtle.importKey(
      'raw',
      peerPublicKeyBuffer,
      {
        name: this.ALGORITHM,
        namedCurve: this.CURVE,
      },
      false,
      []
    );

    return crypto.subtle.deriveKey(
      {
        name: this.ALGORITHM,
        public: peerPublicKey,
      },
      privateKey,
      {
        name: 'HKDF',
        hash: 'SHA-256',
      },
      false,
      ['deriveKey']
    );
  }

  /**
   * Derive AES key from shared secret using HKDF
   */
  async deriveAESKey(
    sharedSecret: CryptoKey,
    sessionId: string
  ): Promise<CryptoKey> {
    const salt = new TextEncoder().encode(sessionId);
    const info = new TextEncoder().encode(this.HKDF_INFO);

    return crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info,
      },
      sharedSecret,
      {
        name: this.ENCRYPTION_ALGORITHM,
        length: 256, // 256-bit AES key
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt file data using AES-GCM
   */
  async encryptFile(
    fileData: ArrayBuffer,
    aesKey: CryptoKey
  ): Promise<{ encryptedData: ArrayBuffer; iv: Uint8Array }> {
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

    const encryptedData = await crypto.subtle.encrypt(
      {
        name: this.ENCRYPTION_ALGORITHM,
        iv,
      },
      aesKey,
      fileData
    );

    return {
      encryptedData,
      iv,
    };
  }

  /**
   * Decrypt file data using AES-GCM
   */
  async decryptFile(
    encryptedData: ArrayBuffer,
    iv: Uint8Array,
    aesKey: CryptoKey
  ): Promise<ArrayBuffer> {
    try {
      // Copy into a fresh ArrayBuffer-backed Uint8Array to satisfy strict BufferSource typing
      const ivCopy = new Uint8Array(iv.length);
      ivCopy.set(iv);
      return await crypto.subtle.decrypt(
        {
          name: this.ENCRYPTION_ALGORITHM,
          iv: ivCopy,
        },
        aesKey,
        encryptedData
      );
    } catch (error) {
      throw new Error('Decryption failed: Invalid key or corrupted data');
    }
  }

  /**
   * Complete encryption flow for sender (phone)
   */
  async encryptFileForTransfer(
    fileData: ArrayBuffer,
    receiverPublicKeyBase64: string,
    sessionId: string
  ): Promise<EncryptedFile> {
    // Generate sender's key pair
    const senderKeyPair = await this.generateSenderKeyPair();

    // Derive shared secret
    const sharedSecret = await this.deriveSharedSecret(
      senderKeyPair.privateKey,
      receiverPublicKeyBase64
    );

    // Derive AES key
    const aesKey = await this.deriveAESKey(sharedSecret, sessionId);

    // Encrypt file
    const { encryptedData, iv } = await this.encryptFile(fileData, aesKey);

    return {
      data: encryptedData,
      iv,
      senderPublicKey: senderKeyPair.publicKeyBase64,
    };
  }

  /**
   * Complete decryption flow for receiver (laptop)
   */
  async decryptReceivedFile(
    encryptedFile: EncryptedFile,
    receiverPrivateKey: CryptoKey,
    sessionId: string
  ): Promise<ArrayBuffer> {
    // Derive shared secret
    const sharedSecret = await this.deriveSharedSecret(
      receiverPrivateKey,
      encryptedFile.senderPublicKey
    );

    // Derive AES key
    const aesKey = await this.deriveAESKey(sharedSecret, sessionId);

    // Decrypt file
    return this.decryptFile(encryptedFile.data, encryptedFile.iv, aesKey);
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   */
  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Encode QR data as JSON string
   */
  encodeQRData(qrData: QRData): string {
    return JSON.stringify(qrData);
  }

  /**
   * Decode QR data from JSON string
   */
  decodeQRData(qrString: string): QRData {
    try {
      return JSON.parse(qrString);
    } catch (error) {
      throw new Error('Invalid QR code format');
    }
  }

  /**
   * Convert file to ArrayBuffer
   */
  fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return file.arrayBuffer();
  }

  /**
   * Convert ArrayBuffer to Blob for download
   */
  arrayBufferToBlob(buffer: ArrayBuffer, mimeType: string): Blob {
    return new Blob([buffer], { type: mimeType });
  }
}

export const encryptionManager = new EncryptionManager();
