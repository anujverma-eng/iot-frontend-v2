import CryptoJS from 'crypto-js';

/** A _per‑app_ secret.  
 *  – In production put this in an env‑based build var (Vite, dotenv, etc.). */
const SECRET = import.meta.env.VITE_TOKEN_ENC_KEY ?? 'CHANGE-ME-IN-ENV';

export const encrypt = (plain: string): string =>
  CryptoJS.AES.encrypt(plain, SECRET).toString();

export const decrypt = (cipher: string): string =>
  CryptoJS.AES.decrypt(cipher, SECRET).toString(CryptoJS.enc.Utf8);
