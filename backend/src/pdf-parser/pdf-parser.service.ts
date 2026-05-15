import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface ZugferdData {
  sellerName: string | null;
  buyerName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;       // YYYY-MM-DD
  deliveryDate: string | null;      // YYYY-MM-DD
  totalAmount: number | null;
  currency: string;
  licensePlate: string | null;
  vehicleModel: string | null;
  vehicleFin: string | null;
  nextSpDate: string | null;        // YYYY-MM-DD
  nextHuDate: string | null;        // YYYY-MM-DD
  lineItems: ZugferdLineItem[];
  notes: string[];
}

export interface ZugferdLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

@Injectable()
export class PdfParserService {
  private readonly logger = new Logger(PdfParserService.name);

  async extractText(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(dataBuffer);
      this.logger.log(`Text extrahiert aus ${path.basename(filePath)}: ${data.text.length} Zeichen`);
      return data.text;
    } catch (error) {
      this.logger.error(`Fehler beim Lesen von PDF ${filePath}: ${error.message}`);
      throw new Error(`PDF konnte nicht gelesen werden: ${error.message}`);
    }
  }

  /** Extrahiert ZUGFeRD/Factur-X XML aus dem PDF-Binary und parsed es strukturiert */
  async extractZugferdData(filePath: string): Promise<ZugferdData | null> {
    try {
      const buffer = fs.readFileSync(filePath);
      const xmlContent = this.findEmbeddedXml(buffer);
      if (!xmlContent) return null;

      const { XMLParser } = require('fast-xml-parser');
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseTagValue: true,
        trimValues: true,
      });
      const doc = parser.parse(xmlContent);

      return this.mapZugferdDoc(doc);
    } catch (error) {
      this.logger.warn(`ZUGFeRD-Parsing fehlgeschlagen für ${path.basename(filePath)}: ${error.message}`);
      return null;
    }
  }

  /** Sucht ZUGFeRD/Factur-X XML im PDF-Binary (raw + komprimierte Streams) */
  private findEmbeddedXml(buffer: Buffer): string | null {
    // 1. Versuche zuerst unkomprimiert (manche PDFs speichern XML raw)
    const rawResult = this.searchXmlInBuffer(buffer);
    if (rawResult) return rawResult;

    // 2. Suche komprimierte Streams (FlateDecode) und dekomprimiere sie
    const streamMarker = Buffer.from('stream');
    const endStreamMarker = Buffer.from('endstream');
    let pos = 0;
    while (pos < buffer.length) {
      const streamStart = this.bufferIndexOf(buffer, streamMarker, pos);
      if (streamStart === -1) break;

      // Überspringe 'stream' + optionales \r\n oder \n
      let dataStart = streamStart + streamMarker.length;
      if (buffer[dataStart] === 0x0d) dataStart++; // \r
      if (buffer[dataStart] === 0x0a) dataStart++; // \n

      const streamEnd = this.bufferIndexOf(buffer, endStreamMarker, dataStart);
      if (streamEnd === -1 || streamEnd - dataStart < 10) { pos = streamStart + 1; continue; }

      const streamData = buffer.slice(dataStart, streamEnd);
      if (streamData.length < 4) { pos = streamEnd + endStreamMarker.length; continue; }

      // Versuche verschiedene Inflate-Varianten
      const attempts: Array<() => Buffer> = [
        () => zlib.inflateSync(streamData),
        // PDF FlateDecode: zlib-Header (2 Bytes) ohne Adler-32-Checksum
        () => streamData[0] === 0x78 ? zlib.inflateRawSync(streamData.slice(2)) : (() => { throw new Error(); })(),
        () => zlib.inflateRawSync(streamData),
      ];
      for (const attempt of attempts) {
        try {
          const decompressed = attempt();
          if (decompressed.length > 50) {
            const result = this.searchXmlInBuffer(decompressed);
            if (result) return result;
          }
        } catch { /* weiter versuchen */ }
      }

      pos = streamEnd + endStreamMarker.length;
    }
    return null;
  }

  private searchXmlInBuffer(buffer: Buffer): string | null {
    const markers = [
      Buffer.from('<?xml version'),
      Buffer.from('<rsm:CrossIndustryInvoice'),
      Buffer.from('<CrossIndustryInvoice'),
    ];

    for (const marker of markers) {
      const start = this.bufferIndexOf(buffer, marker);
      if (start === -1) continue;

      const closingTags = ['</rsm:CrossIndustryInvoice>', '</CrossIndustryInvoice>'];
      for (const closing of closingTags) {
        const closingBuf = Buffer.from(closing);
        const end = this.bufferIndexOf(buffer, closingBuf, start);
        if (end !== -1) {
          const xmlRaw = buffer.slice(start, end + closingBuf.length).toString('utf-8');
          if (xmlRaw.includes('<') && xmlRaw.includes('>')) {
            this.logger.log(`ZUGFeRD XML gefunden: ${xmlRaw.length} Zeichen`);
            return xmlRaw;
          }
        }
      }
    }
    return null;
  }

  private bufferIndexOf(buf: Buffer, search: Buffer, from = 0): number {
    const len = buf.length - search.length;
    for (let i = from; i <= len; i++) {
      let found = true;
      for (let j = 0; j < search.length; j++) {
        if (buf[i + j] !== search[j]) { found = false; break; }
      }
      if (found) return i;
    }
    return -1;
  }

  private mapZugferdDoc(doc: any): ZugferdData {
    const root =
      doc?.['rsm:CrossIndustryInvoice'] ||
      doc?.['CrossIndustryInvoice'] ||
      doc;

    const tx =
      root?.['rsm:SupplyChainTradeTransaction'] ||
      root?.['SupplyChainTradeTransaction'] || {};

    const agreement =
      tx?.['ram:ApplicableHeaderTradeAgreement'] ||
      tx?.['ApplicableHeaderTradeAgreement'] || {};

    const delivery =
      tx?.['ram:ApplicableHeaderTradeDelivery'] ||
      tx?.['ApplicableHeaderTradeDelivery'] || {};

    const settlement =
      tx?.['ram:ApplicableHeaderTradeSettlement'] ||
      tx?.['ApplicableHeaderTradeSettlement'] || {};

    const exDoc =
      root?.['rsm:ExchangedDocument'] ||
      root?.['ExchangedDocument'] || {};

    // ── Rechnungsnummer & Datum ───────────────────────────────────────
    const invoiceNumber = this.str(exDoc?.['ram:ID'] || exDoc?.['ID']);
    const issueDateRaw  = this.str(
      exDoc?.['ram:IssueDateTime']?.['udt:DateTimeString']?.['#text'] ||
      exDoc?.['ram:IssueDateTime']?.['udt:DateTimeString'] ||
      exDoc?.['IssueDateTime']?.['DateTimeString']?.['#text'] ||
      exDoc?.['IssueDateTime']?.['DateTimeString']
    );
    const deliveryDateRaw = this.str(
      delivery?.['ram:ActualDeliverySupplyChainEvent']?.['ram:OccurrenceDateTime']?.['udt:DateTimeString']?.['#text'] ||
      delivery?.['ActualDeliverySupplyChainEvent']?.['OccurrenceDateTime']?.['DateTimeString']?.['#text']
    );

    // ── Lieferant (Werkstatt) & Käufer (Kunde) ───────────────────────
    const seller = agreement?.['ram:SellerTradeParty'] || agreement?.['SellerTradeParty'] || {};
    const buyer  = agreement?.['ram:BuyerTradeParty']  || agreement?.['BuyerTradeParty']  || {};
    const sellerName = this.str(seller?.['ram:Name'] || seller?.['Name']);
    const buyerName  = this.str(buyer?.['ram:Name']  || buyer?.['Name']);

    // ── Gesamtbetrag ─────────────────────────────────────────────────
    const monetary = settlement?.['ram:SpecifiedTradeSettlementHeaderMonetarySummation'] ||
                     settlement?.['SpecifiedTradeSettlementHeaderMonetarySummation'] || {};
    const totalRaw = this.str(
      monetary?.['ram:GrandTotalAmount'] ||
      monetary?.['GrandTotalAmount'] ||
      monetary?.['ram:TaxInclusiveTotalAmount'] ||
      monetary?.['TaxInclusiveTotalAmount']
    );
    const totalAmount = totalRaw ? parseFloat(totalRaw) : null;
    const currency = this.str(settlement?.['ram:InvoiceCurrencyCode'] || settlement?.['InvoiceCurrencyCode']) || 'EUR';

    // ── Notizen (Kennzeichen / Fahrzeugdaten) ─────────────────────────
    const noteField =
      exDoc?.['ram:IncludedNote'] ||
      exDoc?.['IncludedNote'] || [];
    const notesArray = Array.isArray(noteField) ? noteField : [noteField];
    const notes: string[] = notesArray
      .map(n => this.str(n?.['ram:Content'] || n?.['Content'] || n))
      .filter(Boolean);

    // ── Fahrzeugdaten aus Notizen extrahieren ─────────────────────────
    let licensePlate: string | null = null;
    let vehicleModel: string | null = null;
    let vehicleFin: string | null = null;
    let nextSpDate: string | null = null;
    let nextHuDate: string | null = null;

    const allNotes = notes.join(' ');
    const plateMatch = allNotes.match(/([A-ZÄÖÜ]{2,3}-[A-Z]{1,3}\s+\d{1,4}[HE]?)/);
    if (plateMatch) licensePlate = plateMatch[1].trim();
    const modelMatch = allNotes.match(/Modell:\s*([^\n,;]+)/i);
    if (modelMatch) vehicleModel = modelMatch[1].trim();
    const finMatch = allNotes.match(/FIN:\s*([A-Z0-9]{17})/i);
    if (finMatch) vehicleFin = finMatch[1];

    // FIN aus AdditionalReferencedDocument (TypeCode 130, ReferenceTypeCode AKG)
    // — Truck Center Werneke speichert FIN hier statt in den Notes
    if (!vehicleFin) {
      const addRef = agreement?.['ram:AdditionalReferencedDocument'] || agreement?.['AdditionalReferencedDocument'];
      const addRefArray = addRef ? (Array.isArray(addRef) ? addRef : [addRef]) : [];
      for (const ref of addRefArray) {
        const typeCode = this.str(ref?.['ram:TypeCode'] || ref?.['TypeCode']);
        const refType  = this.str(ref?.['ram:ReferenceTypeCode'] || ref?.['ReferenceTypeCode']);
        const id       = this.str(ref?.['ram:IssuerAssignedID'] || ref?.['IssuerAssignedID']);
        if (typeCode === '130' && refType === 'AKG' && /^[A-Z0-9]{17}$/.test(id)) {
          vehicleFin = id;
          break;
        }
      }
    }
    const spMatch = allNotes.match(/SP[:\s]+(\d{2})\.(\d{2})\.(\d{4})/i);
    if (spMatch) nextSpDate = `${spMatch[3]}-${spMatch[2]}-${spMatch[1]}`;
    const huMatch = allNotes.match(/HU[:\s]+(\w+ \d{4}|\d{2}\.\d{2}\.\d{4})/i);
    if (huMatch) nextHuDate = this.parseHuDate(huMatch[1]);

    // ── Positionen ────────────────────────────────────────────────────
    const lineField =
      tx?.['ram:IncludedSupplyChainTradeLineItem'] ||
      tx?.['IncludedSupplyChainTradeLineItem'] || [];
    const lineArray = Array.isArray(lineField) ? lineField : [lineField];
    const lineItems: ZugferdLineItem[] = lineArray.map(item => {
      const product  = item?.['ram:SpecifiedTradeProduct'] || item?.['SpecifiedTradeProduct'] || {};
      const delivery = item?.['ram:SpecifiedLineTradeDelivery'] || item?.['SpecifiedLineTradeDelivery'] || {};
      const price    = item?.['ram:SpecifiedLineTradeSettlement'] ||
                       item?.['SpecifiedLineTradeSettlement'] ||
                       item?.['ram:SpecifiedSupplyChainTradeSettlement'] ||
                       item?.['SpecifiedSupplyChainTradeSettlement'] || {};

      const description = this.str(product?.['ram:Name'] || product?.['Name']) || 'Unbekannte Position';
      const qtyRaw  = this.str(delivery?.['ram:BilledQuantity']?.['#text'] || delivery?.['BilledQuantity']?.['#text'] || delivery?.['ram:BilledQuantity'] || delivery?.['BilledQuantity']);
      const unit    = this.str(delivery?.['ram:BilledQuantity']?.['@_unitCode'] || delivery?.['BilledQuantity']?.['@_unitCode']) || 'Stk';

      const priceSpec = price?.['ram:SpecifiedTradeSettlementLineMonetarySummation'] ||
                        price?.['SpecifiedTradeSettlementLineMonetarySummation'] || {};
      const totalPriceRaw = this.str(priceSpec?.['ram:LineTotalAmount'] || priceSpec?.['LineTotalAmount']);

      const tradePrice = item?.['ram:SpecifiedLineTradeAgreement']?.['ram:NetPriceProductTradePrice'] ||
                         item?.['SpecifiedLineTradeAgreement']?.['NetPriceProductTradePrice'] || {};
      const unitPriceRaw = this.str(tradePrice?.['ram:ChargeAmount'] || tradePrice?.['ChargeAmount']);

      return {
        description,
        quantity:   parseFloat(qtyRaw  || '1') || 1,
        unit:       this.normalizeUnit(unit),
        unitPrice:  parseFloat(unitPriceRaw  || '0') || 0,
        totalPrice: parseFloat(totalPriceRaw || '0') || 0,
      };
    }).filter(item => item.totalPrice > 0 || item.description !== 'Unbekannte Position');

    return {
      sellerName,
      buyerName,
      invoiceNumber,
      invoiceDate:  this.formatDate8(issueDateRaw),
      deliveryDate: this.formatDate8(deliveryDateRaw),
      totalAmount,
      currency,
      licensePlate,
      vehicleModel,
      vehicleFin,
      nextSpDate,
      nextHuDate,
      lineItems,
      notes,
    };
  }

  // ── Hilfsmethoden ───────────────────────────────────────────────────
  private str(val: any): string {
    if (val === null || val === undefined) return '';
    return String(val).trim();
  }

  /** Konvertiert YYYYMMDD → YYYY-MM-DD */
  private formatDate8(raw: string): string | null {
    if (!raw) return null;
    const s = raw.replace(/\D/g, '');
    if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return null;
  }

  /** "August 2026" oder "08.2026" → "2026-08-01" */
  private parseHuDate(raw: string): string | null {
    const monthNames: Record<string, string> = {
      januar: '01', februar: '02', märz: '03', april: '04',
      mai: '05', juni: '06', juli: '07', august: '08',
      september: '09', oktober: '10', november: '11', dezember: '12',
    };
    const monthMatch = raw.toLowerCase().match(/(\w+)\s+(\d{4})/);
    if (monthMatch) {
      const m = monthNames[monthMatch[1]] || monthMatch[1].padStart(2, '0');
      return `${monthMatch[2]}-${m}-01`;
    }
    const dotMatch = raw.match(/(\d{2})\.(\d{4})/);
    if (dotMatch) return `${dotMatch[2]}-${dotMatch[1]}-01`;
    return null;
  }

  private normalizeUnit(unit: string): string {
    const map: Record<string, string> = {
      H87: 'Stk', C62: 'Stk', EA: 'Stk', PCE: 'Stk',
      LTR: 'Liter', MLT: 'ml',
      HUR: 'Std.', MIN: 'Min.',
      KGM: 'kg', GRM: 'g',
      MTR: 'm', CMT: 'cm', MMT: 'mm',
      SET: 'Set', PR: 'Paar',
    };
    return map[unit] || unit || 'Stk';
  }

  async getFileAsBase64(filePath: string): Promise<string> {
    const data = fs.readFileSync(filePath);
    return data.toString('base64');
  }

  /**
   * OCR für gescannte PDFs ohne Text-Layer.
   * Rendert jede Seite als Bild und lässt Tesseract (deutsch) den Text erkennen.
   * Benötigt: pdfjs-dist, canvas, tesseract.js
   */
  async ocrPdf(pdfBuffer: Buffer): Promise<string> {
    let pdfjsLib: any;
    let createCanvas: any;
    let Tesseract: any;

    try {
      pdfjsLib    = require('pdfjs-dist/legacy/build/pdf.js');
      createCanvas = require('canvas').createCanvas;
      Tesseract   = require('tesseract.js');
    } catch (e) {
      this.logger.error(`OCR-Abhängigkeiten nicht verfügbar: ${e.message}`);
      return '';
    }

    try {
      // Worker-Pfad für Node.js setzen
      pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve(
        'pdfjs-dist/legacy/build/pdf.worker.js',
      );

      const pdf = await pdfjsLib
        .getDocument({ data: new Uint8Array(pdfBuffer) })
        .promise;

      this.logger.log(`OCR: ${pdf.numPages} Seiten werden verarbeitet`);
      const pageTexts: string[] = [];

      for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 6); pageNum++) {
        const page    = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.5 }); // hohe Auflösung für bessere OCR-Qualität

        const canvas  = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const ctx     = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        const imgBuffer = canvas.toBuffer('image/png');

        const { data: { text } } = await Tesseract.recognize(imgBuffer, 'deu', {
          logger: () => {},
        });

        if (text.trim().length > 10) {
          pageTexts.push(text);
          this.logger.log(`OCR Seite ${pageNum}: ${text.trim().length} Zeichen erkannt`);
        }
      }

      return pageTexts.join('\n\n');
    } catch (error) {
      this.logger.error(`OCR-Verarbeitung fehlgeschlagen: ${error.message}`);
      return '';
    }
  }
}
