/* eslint-disable ts/method-signature-style */
declare module 'busboy' {
  import type { IncomingHttpHeaders } from 'node:http'

  interface BusboyConfig {
    headers: IncomingHttpHeaders
  }

  interface Busboy {
    on(event: 'file', callback: (field: string, file: NodeJS.ReadableStream, info: { filename?: string, mimeType?: string }) => void): void
    on(event: 'error', callback: (err: Error) => void): void
    on(event: 'finish', callback: () => void): void
  }

  function busboy(options: BusboyConfig): Busboy

  export = busboy
}
