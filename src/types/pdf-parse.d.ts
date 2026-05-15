declare module "pdf-parse" {
  interface PdfData {
    text: string
    numpages: number
  }
  function pdf(buffer: Buffer): Promise<PdfData>
  export default pdf
}
