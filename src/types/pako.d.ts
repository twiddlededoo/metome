declare module 'pako' {
  export function gzip(input: any, opts?: any): Uint8Array;
  export function ungzip(input: any, opts?: any): Uint8Array;
}
