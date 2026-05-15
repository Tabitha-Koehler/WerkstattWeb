import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';

export interface InvoicePosition {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  category: string;
  isAnomaly: boolean;
  anomalyReason: string | null;
}

export interface InspectionResult {
  type: 'SP' | 'HU' | 'AU';
  date: string | null;
  nextDueDate: string | null;
}

export interface OperatingSupplyResult {
  type: string;
  quantity: number;
  unit: string;
}

export interface AnomalyResult {
  positionDescription: string;
  reason: string;
}

export interface AnalysisResult {
  licensePlate: string | null;
  workshopName: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  serviceDate: string | null;     // Annahmedatum / Servicedatum
  totalAmount: number;
  currency: string;
  repairContext: string;
  summary: string;
  mileage: number | null;         // km-Stand aus Rechnung
  positions: InvoicePosition[];
  inspections: InspectionResult[];
  operatingSupplies: OperatingSupplyResult[];
  anomalies: AnomalyResult[];
}

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);
  private readonly ollamaUrl: string;
  private readonly model: string;
  private readonly ollamaEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.ollamaUrl = this.configService.get<string>('ollama.url') || 'http://localhost:11434';
    this.model = this.configService.get<string>('ollama.model') || 'llama3.2';
    this.ollamaEnabled = this.configService.get<string>('OLLAMA_ENABLED') !== 'false';
  }

  async analyzeInvoice(rawText: string, filename: string): Promise<AnalysisResult> {
    if (!this.ollamaEnabled) {
      return this.ruleBasedFallback(rawText, filename);
    }

    const prompt = `Du analysierst eine deutsche Werkstattrechnung für eine Spedition. Antworte NUR mit validem JSON, ohne Erklärungen, ohne Markdown, ohne Code-Fences.

RECHNUNGSTEXT:
${rawText.substring(0, 6000)}

DATEINAME: ${filename}

Gib genau dieses JSON zurück:
{
  "licensePlate": "Kennzeichen z.B. HH-AB-1234 oder null",
  "workshopName": "Name der Werkstatt",
  "invoiceNumber": "Rechnungsnummer",
  "invoiceDate": "YYYY-MM-DD oder null",
  "serviceDate": "Annahmedatum YYYY-MM-DD oder null",
  "totalAmount": 0.00,
  "currency": "EUR",
  "mileage": null,
  "repairContext": "Kurzbeschreibung der Reparatur z.B. Bremsenwechsel Vorderachse",
  "summary": "Zusammenfassung in 2 Sätzen",
  "positions": [
    {
      "description": "Positionsbezeichnung",
      "quantity": 1.0,
      "unit": "Stk",
      "unitPrice": 0.00,
      "totalPrice": 0.00,
      "category": "REPAIR",
      "isAnomaly": false,
      "anomalyReason": null
    }
  ],
  "inspections": [],
  "operatingSupplies": [],
  "anomalies": []
}

Kategorien: REPAIR, INSPECTION, BETRIEBSMITTEL, LABOR, PARTS, TOOLS, OTHER
Anomalien markieren wenn:
- Werkzeuge (Spezialwerkzeug, Schraubenschlüssel, Zange etc.) auf einer Reparaturrechnung stehen
- Mehr als 2 Kanister Öl/Betriebsmittel die nicht zum Reparaturkontext passen (z.B. Motoröl beim Reifenwechsel)
- Ungewöhnlich hohe Mengen: Motoröl >15L, Getriebeöl >10L, AdBlue >100L, Kühlmittel >20L
- Positionen die offensichtlich nicht zum Reparaturkontext passen (z.B. Reinigungsmittel, Regale, Bürobedarf)
- Kühlmittel/Frostschutz bei einem reinen Reifenwechsel
- Menge einer Position ist für den Fahrzeugtyp LKW unplausibel hoch
SP=Sicherheitsprüfung, HU=Hauptuntersuchung, AU=Abgasuntersuchung als inspections eintragen.
mileage: km-Stand aus Rechnung als Zahl oder null.`;

    try {
      const responseText = await this.callOllama(prompt);
      const result: AnalysisResult = this.parseJson(responseText);
      this.logger.log(
        `Ollama-Analyse abgeschlossen für ${filename}: ${result.anomalies?.length || 0} Anomalien`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Ollama-Fehler bei ${filename}: ${error.message}`);
      return this.ruleBasedFallback(rawText, filename);
    }
  }

  private callOllama(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL('/api/generate', this.ollamaUrl);
      const isHttps = url.protocol === 'https:';
      const body = JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 4096 },
      });

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = (isHttps ? https : http).request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.response || '');
          } catch {
            reject(new Error('Ungültige Antwort von Ollama'));
          }
        });
      });

      req.on('error', (e) =>
        reject(new Error(`Ollama nicht erreichbar (${this.ollamaUrl}): ${e.message}`)),
      );
      req.setTimeout(120000, () => {
        req.destroy();
        reject(new Error('Ollama Timeout (120s)'));
      });
      req.write(body);
      req.end();
    });
  }

  private parseJson(text: string): AnalysisResult {
    let clean = text.trim();
    const fence = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) clean = fence[1].trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
    return JSON.parse(clean);
  }

  // ── Regelbasierter Fallback ──────────────────────────────────────────────
  ruleBasedFallback(rawText: string, filename: string): AnalysisResult {
    this.logger.log(`Regelbasierte Extraktion für ${filename}`);
    const text = rawText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // ── Hilfsfunktion: Deutsche Zahl parsen (1.234,56 → 1234.56) ──────────
    const parseDE = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'));

    // ── Kennzeichen ────────────────────────────────────────────────────────
    // Format A: Standard — Label dann Wert: "Kennzeichen: HAM-CK 505"
    const kennzeichenCtx = text.match(/(?:Kennzeichen|KFZ)[:\s]+([A-ZÄÖÜ]{1,3}[\s]*[-][\s]*[A-Z]{1,2}[\s]*\d{1,4}[HE]?)/i);
    const fzgMatch = text.match(/(?:FZG[\s.]*NR|Amtl\.?\s*Kennzeichen|Fahrzeugkennzeichen)[^\n]*\n?[^\n]*?([A-ZÄÖÜ]{2,3}-[A-Z]{1,3}[\s]\d{1,4}[HE]?)/i);
    // Format B: Werneke-DMS (Spalten-Umkehrung) — Wert kommt VOR dem Label
    // Ältere PDFs: "WMAN18ZZ5CY277190HAM-CK 503FIN:" (kein Space)
    // Neuere PDFs: "HAM-CK 506 FIN:" (mit Space)
    const reversedPlate = text.match(/([A-ZÄÖÜ]{1,3}-[A-Z]{1,2}\s\d{1,4}[HE]?)\s*FIN:/i);
    // Format C: Werneke 1-seitige Rechnungen — Kennzeichen als eigene Zeile nach dem Warnhinweis
    const standalonePlate = text.match(/^([A-ZÄÖÜ]{1,3}-[A-Z]{1,2}\s\d{1,4}[HE]?)$/m);
    let licensePlate: string | null = null;
    const rawPlate = (kennzeichenCtx?.[1] || fzgMatch?.[1] || reversedPlate?.[1] || standalonePlate?.[1] || '').trim();
    if (rawPlate) {
      // Normalisieren: "HAM -CK 505" → "HAM-CK 505"
      const parts = rawPlate.match(/^([A-ZÄÖÜ]{1,3})\s*[-]\s*([A-Z]{1,3})\s+(\d{1,4}[HE]?)$/i);
      licensePlate = parts
        ? `${parts[1].toUpperCase()}-${parts[2].toUpperCase()} ${parts[3].toUpperCase()}`
        : rawPlate.replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').toUpperCase();
    }

    // ── Werkstattname ──────────────────────────────────────────────────────
    let workshopName = '';
    const hausMatch = text.match(/Hausanschrift[:\s*]+([^/*\n]+(?:GmbH|KG|AG|e\.K\.|GbR)[^/*\n]*)/i);
    if (hausMatch) workshopName = hausMatch[1].trim();
    if (!workshopName || workshopName.length < 3) {
      const firmaPos = text.search(/^Firma\s*$/im);
      const companyLine = lines.find((l) => {
        if (!/(?:GmbH|Co\.KG|e\.K\.|GbR|AG)\b/i.test(l)) return false;
        const pos = text.indexOf(l);
        if (firmaPos !== -1 && pos > firmaPos && pos < firmaPos + 200) return false;
        return true;
      });
      if (companyLine) {
        workshopName = companyLine.split(/[/*|]/)[0].split(/ - /)[0].replace(/\*.*$/, '').trim();
      }
    }
    if (!workshopName || workshopName.length < 3) {
      workshopName = lines.find(l => l.length > 3 && !/^[!#$@]/.test(l) && !/^\d/.test(l) && !/^Firma$/i.test(l)) || 'Unbekannte Werkstatt';
    }

    // ── Rechnungsnummer ────────────────────────────────────────────────────
    // Erlaubt Leerzeichen in der Nummer (z.B. "05 25 1348") → nach Match normalisieren
    const numPatterns = [
      /(\d[\d\-\/]{3,})\s*RE-Nummer/i,
      /(?:RE-Nummer|Rechnung-Nummer)[:\s]*\n?\s*(\d[\d\-\/\s]{2,}?)(?=\s*(?:Datum|$|\n))/i,
      /(?:RE-Nummer|Rechnung-Nummer)[:\s]+(\d[\d\-\/\s]{2,})/i,
      /Rechnungs?(?:nummer|nr\.?)[:\s]+(\d[\d\-\/\s]+)/i,
    ];
    let invoiceNumber = '';
    for (const p of numPatterns) {
      const m = text.match(p);
      if (m) {
        invoiceNumber = m[1].trim().replace(/\s+/g, ' ');
        break;
      }
    }

    // ── Datum (Rechnungsdatum) ─────────────────────────────────────────────
    let invoiceDate: string | null = null;
    const datumCtx = text.match(/(?:RECHNUNG|Datum:)[^\d\n]*(\d{2})\.(\d{2})\.(\d{4})/i);
    const firstDate = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    const dm = datumCtx || firstDate;
    if (dm) {
      const [, d, mo, y] = dm;
      invoiceDate = `${y}-${mo}-${d}`;
    }

    // ── Annahmedatum / Servicedatum ────────────────────────────────────────
    let serviceDate: string | null = null;
    const annahmeMatch = text.match(/Annahme[-\s]?Datum[:\s]+(\d{2})\.(\d{2})\.(\d{4})/i);
    if (annahmeMatch) {
      serviceDate = `${annahmeMatch[3]}-${annahmeMatch[2]}-${annahmeMatch[1]}`;
    }

    // ── km-Stand ───────────────────────────────────────────────────────────
    let mileage: number | null = null;
    // Format A: Standard — Label dann Wert: "Km-Stand: 418341"
    const kmMatch = text.match(/km[-\s]?Stand[:\s]+(\d[\d.]+)/i);
    if (kmMatch) {
      mileage = parseInt(kmMatch[1].replace(/\./g, ''), 10);
    }
    // Fallback: "Tachostand" oder "Kilometerstand"
    if (!mileage) {
      const tacho = text.match(/(?:Tachostand|Kilometerstand|KM-Stand)[:\s]+(\d[\d.]+)/i);
      if (tacho) mileage = parseInt(tacho[1].replace(/\./g, ''), 10);
    }
    // Format B: Werneke-DMS (Spalten-Umkehrung) — Wert steht vor "Km-Stand:" Label
    // z.B. "614083 DAIMLER TRUCK   02.03.2009   HU:   Km-Stand:"
    if (!mileage) {
      const kmReversed = text.match(/\b(\d{5,7})\b[\s\S]{0,80}?Km[-\s]?Stand:/i);
      if (kmReversed) mileage = parseInt(kmReversed[1].replace(/\./g, ''), 10);
    }

    // ── Gesamtbetrag ───────────────────────────────────────────────────────
    let totalAmount = 0;
    const ebMatch = text.match(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*€?\s*Endbetrag/i);
    if (ebMatch) totalAmount = parseDE(ebMatch[1]);
    if (!totalAmount) {
      const rbMatch = text.match(/(?:Rechnungsbetrag|Gesamtbetrag|Brutto(?:betrag)?)[:\s\n]*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
      if (rbMatch) totalAmount = parseDE(rbMatch[1]);
    }
    if (!totalAmount) {
      const allEur = [...text.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*€/g)].map(m => parseDE(m[1]));
      const sig = allEur.filter(a => a >= 5);
      if (sig.length) totalAmount = sig[sig.length - 1];
    }
    if (!totalAmount) {
      const legacyMatch = text.match(/(?:Gesamt|Brutto)[^\d\n]*(\d{1,6}[.,]\d{2})/i);
      if (legacyMatch) totalAmount = parseFloat(legacyMatch[1].replace(',', '.'));
    }

    // ── Reparaturkontext ───────────────────────────────────────────────────
    let repairContext = '';
    // Priorität 1: explizites Leistungs-Label (Wortgrenze verhindert Match in "Auftragsnummer")
    const leistungMatch = text.match(/\b(?:Leistung|Betreff|Auftrag)\b[:\s]*\n?([^\n$]{5,})/i);
    if (leistungMatch) {
      repairContext = leistungMatch[1]
        .replace(/\$[a-z]+\$[^\$]*\$[a-z]+\$/gi, '')  // $anA$...$anE$ entfernen
        .replace(/\s+/g, ' ').substring(0, 200).trim();
    }
    if (!repairContext) {
      const headerMatch = text.match(/Pos\s+Menge\s+Einh\.[^\n]*\n([^\n]{8,80})\n\s*1\s/i);
      if (headerMatch) repairContext = headerMatch[1].replace(/\s+/g, ' ').trim();
    }
    if (!repairContext) {
      const posLine = lines.find(l =>
        l.length > 8 &&
        /[a-z]{4}/i.test(l) &&
        !/^[!#$@*]/.test(l) &&
        !/^(?:Firma|Seite|Datum|Kunden|Rechnung|Kennzeichen|Marke|Modell|FIN|HRB|USt|Steuer|IBAN|BIC|DE[0-9]|Pos\s|Menge|Hausan)/i.test(l) &&
        !/^\d+\s+[\d,]+\s+\w+/.test(l) &&
        // Zahlungsbedingungen / Footer / Adresszeilen ausschließen
        !/Zahlbar|ohne Abzug|Skonto|Bankverbindung|Zahlungsziel|innerhalb von|Fälligkeit|Bitte überweisen|Bequem überweisen|Bezahlcode/i.test(l) &&
        !/Geschäftsführer|Handelsregister|HRB-Nr|Ust\.-IdNr|Steuer-Nr|web:|email:|www\./i.test(l) &&
        !/^(?:DE\d{2}|[A-Z]{6,}[0-9]{6,})/.test(l) &&  // IBAN / BIC
        !/^(?:Cargo\s|Marker\s|Spedition\s|Firma\s)/i.test(l) &&   // Empfängeradresse
        !/GmbH[+&]Co|GmbH\*/.test(l)  // Werkstatt-Briefkopf-Zeile
      );
      repairContext = posLine ? posLine.substring(0, 120) : '';
    }
    if (!repairContext) repairContext = 'Regelbasiert extrahiert';

    // ── Prüfungen ──────────────────────────────────────────────────────────
    // Hilfsfunktion: nextDueDate berechnen wenn kein explizites Datum im Text
    const calcNextDue = (type: 'SP' | 'HU' | 'AU', fromDate: string | null): string | null => {
      if (!fromDate) return null;
      const d = new Date(fromDate);
      if (isNaN(d.getTime())) return null;
      if (type === 'SP') d.setMonth(d.getMonth() + 6);       // SP alle 6 Monate
      else if (type === 'HU') d.setFullYear(d.getFullYear() + 2); // HU alle 24 Monate
      else if (type === 'AU') d.setFullYear(d.getFullYear() + 1); // AU alle 12 Monate
      return d.toISOString().split('T')[0];
    };
    const baseDate = serviceDate || invoiceDate;
    const inspections: InspectionResult[] = [];
    const spNext = text.match(/SP[:\s]+(\d{2})\.(\d{2})\.(\d{4})/i);
    const huNext = text.match(/HU[:\s]+(\d{2})\.(\d{2})\.(\d{4})/i);
    // Explizites Datum nur verwenden, wenn es NACH dem Rechnungsdatum liegt (sonst ist es das Durchführungsdatum, nicht das Fälligkeitsdatum)
    const afterBase = (dateStr: string | null): boolean => {
      if (!dateStr || !baseDate) return false;
      return dateStr > baseDate;
    };
    if (/\bSP\b|Sicherheitspr[üu]fung|SP\s*§\s*29/i.test(text)) {
      const rawExplicit = spNext ? `${spNext[3]}-${spNext[2]}-${spNext[1]}` : null;
      const explicit = afterBase(rawExplicit) ? rawExplicit : null;
      inspections.push({ type: 'SP', date: baseDate, nextDueDate: explicit ?? calcNextDue('SP', baseDate) });
    }
    if (/\bHU\b|Hauptuntersuchung/i.test(text)) {
      const rawExplicit = huNext ? `${huNext[3]}-${huNext[2]}-${huNext[1]}` : null;
      const explicit = afterBase(rawExplicit) ? rawExplicit : null;
      inspections.push({ type: 'HU', date: baseDate, nextDueDate: explicit ?? calcNextDue('HU', baseDate) });
    }
    if (/\bAU\b|Abgasuntersuchung/i.test(text)) {
      inspections.push({ type: 'AU', date: baseDate, nextDueDate: calcNextDue('AU', baseDate) });
    }

    // ── Betriebsmittel ─────────────────────────────────────────────────────
    const supplies: OperatingSupplyResult[] = [];
    const oilMatches = text.matchAll(/(\d+[.,]?\d*)\s*(?:x\s*)?[lL](?:iter)?\s+(?:Motor|Hydraulik|Getriebe)?[öo]l/gi);
    for (const m of oilMatches) {
      supplies.push({ type: 'Öl', quantity: parseFloat(m[1].replace(',', '.')), unit: 'L' });
    }
    const coolantMatches = text.matchAll(/(\d+[.,]?\d*)\s*[lL](?:iter)?\s+(?:Kühlmittel|Kühlerfrostschutz|Frostschutz)/gi);
    for (const m of coolantMatches) {
      supplies.push({ type: 'Kühlmittel', quantity: parseFloat(m[1].replace(',', '.')), unit: 'L' });
    }
    const adblueMatches = text.matchAll(/(\d+[.,]?\d*)\s*[lL](?:iter)?\s+AdBlue/gi);
    for (const m of adblueMatches) {
      supplies.push({ type: 'AdBlue', quantity: parseFloat(m[1].replace(',', '.')), unit: 'L' });
    }

    // ── Positionen ─────────────────────────────────────────────────────────
    const positions: InvoicePosition[] = [];

    // Format C (zuerst): Hollenberg — Zeilen mit "###"-Prefix (Zeilennr. ersetzt)
    // Beispiel: " ########Motorenöl 5W30LL incl. Altölentsorg348,05 €273,70 €ltr."
    // Felder ohne Trennzeichen concateniert: desc + qty + EP + GP + unit
    const hollenbergLines = text.match(/^\s*#{3,}.+€.+€/gm) || [];
    if (hollenbergLines.length > 0) {
      for (const line of hollenbergLines) {
        // Führende # (und Leerzeichen) entfernen, trailing whitespace trimmen
        const stripped = line.replace(/^\s*#+\s*/, '').trimEnd();
        // Split by " €" — letztes Segment = Einheit, vorletztes = GP, drittletztes enthält EP am Ende
        const priceParts = stripped.split(' €');
        if (priceParts.length < 2) continue;
        const unit = (priceParts[priceParts.length - 1] || '').trim().replace(/^[.,\s]+/, '');
        const gpRaw = (priceParts[priceParts.length - 2] || '').trim();
        const gpNumMatch = gpRaw.match(/(\d{1,3}(?:\.\d{3})*,\d{2})$/);
        const gp = parseDE(gpNumMatch?.[1] || gpRaw);
        if (!gp || gp <= 0 || isNaN(gp)) continue;
        let ep = gp;
        let descQtyPart = '';
        if (priceParts.length >= 3) {
          const thirdLast = priceParts[priceParts.length - 3];
          const epMatch = thirdLast.match(/(\d{1,3}(?:\.\d{3})*,\d{2})$/);
          if (epMatch) {
            ep = parseDE(epMatch[1]);
            descQtyPart = thirdLast.slice(0, thirdLast.length - epMatch[0].length);
          } else {
            descQtyPart = priceParts.slice(0, priceParts.length - 2).join(' €');
          }
        } else {
          // Nur 2 Teile: erster Teil ist desc+qty+EP zusammen (kein extra EP)
          descQtyPart = priceParts[0];
        }
        // Menge am Ende von descQtyPart extrahieren
        const qtyMatch = descQtyPart.match(/(\d+(?:,\d+)?)\s*$/);
        let qty = 1;
        let desc = descQtyPart.trim();
        if (qtyMatch) {
          const parsedQty = parseFloat(qtyMatch[1].replace(',', '.'));
          if (!isNaN(parsedQty) && parsedQty > 0 && parsedQty < 10000) {
            qty = parsedQty;
            desc = descQtyPart.slice(0, descQtyPart.length - qtyMatch[0].length).trim();
          }
        }
        // Falsch-Extraktion rückgängig machen für bekannte Muster:
        // 1. Reifengröße (z.B. "315/70R22,5") — Felgengröße ist Teil der Beschreibung
        // 2. Ölviskosität (z.B. "5W30") — Viskositätszahl ist Teil der Beschreibung
        // 3. §-Paragraphen (z.B. "SP §29") — Paragraphennummer ist Teil der Beschreibung
        if (
          /\d+\/\d+[A-Z]/i.test(descQtyPart) ||
          /\d+W$/i.test(desc) ||
          descQtyPart.includes('§')
        ) {
          qty = 1;
          desc = descQtyPart.trim();
        }
        // Abschließende Artefakte entfernen:
        // 1. Hängendes Komma (z.B. "Schmierfett1,")
        desc = desc.replace(/[,]\s*$/, '').trim();
        // 2. Einzelne Ziffer direkt nach einem Buchstaben am Ende (z.B. "Schmierfett1" → "Schmierfett")
        //    Nur einzelne Ziffer — mehrstell. Zahlen wie "5W30" oder "§291" werden nicht berührt
        desc = desc.replace(/([A-Za-zÄÖÜäöüß])\d$/, '$1').trim();
        if (desc.length < 2) continue;
        if (/^(?:Summe|Gesamt|Brutto|Netto|MwSt|USt|Endbetrag)/i.test(desc)) continue;
        // Kein €-Zeichen oder Mail-Marker in der Beschreibung
        if (desc.includes('€') || desc.includes('$anA') || desc.includes('$anE')) continue;
        positions.push({ description: desc, quantity: qty, unit: unit || 'Stk', unitPrice: ep, totalPrice: gp, category: 'OTHER', isAnomaly: false, anomalyReason: null });
        if (positions.length >= 20) break;
      }
    }

    // Format A: "1  10,00  Liter  [Nr]  Bezeichnung  EP  GP  [M]"
    if (positions.length === 0) {
      const posFormatA = /^\s*(\d+)\s+([\d.,]+)\s+(\w+)\s+(?:\w+\s+)?(.+?)\s+([\d.]*,\d{2})\s+([\d.]*,\d{2})\s*[A-Z]?\s*$/gm;
      for (const m of text.matchAll(posFormatA)) {
        const qty = parseFloat(m[2].replace(',', '.'));
        const desc = m[4].replace(/\s+/g, ' ').trim();
        const ep = parseDE(m[5]);
        const gp = parseDE(m[6]);
        if (gp > 0 && gp <= (totalAmount || 99999) * 1.5 && desc.length > 2 &&
            !/^(?:Summe|Gesamt|Brutto|Netto|MwSt|USt|Endbetrag)/i.test(desc)) {
          positions.push({ description: desc, quantity: qty, unit: m[3], unitPrice: ep, totalPrice: gp, category: 'OTHER', isAnomaly: false, anomalyReason: null });
          if (positions.length >= 20) break;
        }
      }
    }

    // Format B: "Beschreibung  234,56 €"
    if (positions.length === 0) {
      const posFormatB = /^(.{5,60}?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*€\s*$/gm;
      for (const m of text.matchAll(posFormatB)) {
        const desc = m[1].trim();
        const price = parseDE(m[2]);
        if (price > 0 && price <= (totalAmount || 99999) * 1.1 &&
            !/^(?:Summe|Gesamt|Brutto|Netto|MwSt|USt|Endbetrag|Rechnungs|Übertr)/i.test(desc)) {
          positions.push({ description: desc, quantity: 1, unit: 'Stk', unitPrice: price, totalPrice: price, category: 'OTHER', isAnomaly: false, anomalyReason: null });
          if (positions.length >= 20) break;
        }
      }
    }

    // ── Anomalien ──────────────────────────────────────────────────────────
    const anomalies: AnomalyResult[] = [];

    // Werkzeuge auf Reparaturrechnung
    ['Werkzeug', 'Schraubenschlüssel', 'Zange', 'Hammer', 'Spezialwerkzeug', 'Meißel', 'Säge'].forEach(kw => {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        anomalies.push({ positionDescription: kw, reason: 'Werkzeug auf Reparaturrechnung — gehört nicht zur Fahrzeugreparatur' });
      }
    });

    // Mengenplausibilität
    const quantityChecks: Array<{ pattern: RegExp; limit: number; unit: string; label: string }> = [
      { pattern: /(\d+[.,]?\d*)\s*[lL](?:iter)?\s+Motor(?:öl|oil)/gi, limit: 15, unit: 'L', label: 'Motoröl' },
      { pattern: /(\d+[.,]?\d*)\s*[lL](?:iter)?\s+Getriebe(?:öl|oil)/gi, limit: 10, unit: 'L', label: 'Getriebeöl' },
      { pattern: /(\d+[.,]?\d*)\s*[lL](?:iter)?\s+Hydraulik(?:öl|flüssigkeit)/gi, limit: 20, unit: 'L', label: 'Hydrauliköl' },
      { pattern: /(\d+[.,]?\d*)\s*[lL](?:iter)?\s+(?:Kühlmittel|Kühlerfrostschutz|Frostschutz)/gi, limit: 20, unit: 'L', label: 'Kühlmittel' },
      { pattern: /(\d+[.,]?\d*)\s*[lL](?:iter)?\s+AdBlue/gi, limit: 200, unit: 'L', label: 'AdBlue' },
      { pattern: /(\d+)\s*(?:x\s*)?Kanister/gi, limit: 3, unit: 'Stk', label: 'Kanister' },
    ];
    for (const check of quantityChecks) {
      for (const m of text.matchAll(check.pattern)) {
        const qty = parseFloat(m[1].replace(',', '.'));
        if (qty > check.limit) {
          anomalies.push({
            positionDescription: `${qty} ${check.unit} ${check.label}`,
            reason: `Ungewöhnlich hohe Menge: ${qty} ${check.unit} ${check.label} (Grenzwert: ${check.limit} ${check.unit})`,
          });
        }
      }
    }

    // Kontext-Plausibilität: Kühlmittel/Öl bei reinem Reifenwechsel
    const isReifenContext = /\b(?:Reifen|Bereifung|Reifenwechsel|Reifenmontage)\b/i.test(repairContext);
    const hasOtherServices = /\b(?:Brems|Motor|Getriebe|Kupplung|Filter|Inspektion)\b/i.test(repairContext);
    if (isReifenContext && !hasOtherServices) {
      if (/\b(?:Kühlmittel|Kühlerfrostschutz|Frostschutz)\b/i.test(text)) {
        anomalies.push({
          positionDescription: 'Kühlmittel/Frostschutz',
          reason: 'Kühlmittel bei Reifenwechsel — ungewöhnliche Kombination, bitte prüfen',
        });
      }
      if (/\b(?:Motoröl|Motor-Öl)\b/i.test(text)) {
        const oilQtyMatch = text.match(/(\d+[.,]?\d*)\s*[lL]\s+Motoröl/i);
        const oilQty = oilQtyMatch ? parseFloat(oilQtyMatch[1].replace(',', '.')) : 0;
        if (oilQty > 2) {
          anomalies.push({
            positionDescription: 'Motoröl',
            reason: `${oilQty}L Motoröl bei Reifenwechsel — ungewöhnliche Menge`,
          });
        }
      }
    }

    // Kontext-Plausibilität: Diagnose/Klima bei Bremsenreparatur
    const isBremsenContext = /\b(?:Bremse|Bremsbeläge|Bremsscheibe|Bremsanlage)\b/i.test(repairContext);
    if (isBremsenContext) {
      ['Klimaanlage', 'Klimareiniger', 'Diagnose', 'Diagnosegerät'].forEach(kw => {
        if (text.includes(kw)) {
          anomalies.push({
            positionDescription: kw,
            reason: `"${kw}" bei Bremsenreparatur — möglicherweise nicht zur Reparatur passend`,
          });
        }
      });
    }

    // Reparaturfremde Materialien
    ['Regal', 'Reinigungsmittel', 'Bürobedarf', 'Handtuch', 'Kaffeemaschine'].forEach(kw => {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        anomalies.push({ positionDescription: kw, reason: `Reparaturfremde Position: "${kw}" — möglicherweise Lagerbedarf fehlgeleitet` });
      }
    });

    return {
      licensePlate,
      workshopName,
      invoiceNumber,
      invoiceDate,
      serviceDate,
      mileage,
      totalAmount,
      currency: 'EUR',
      repairContext,
      summary: `${workshopName}: ${repairContext.substring(0, 80)}. Betrag: ${totalAmount.toFixed(2)} EUR.`,
      positions,
      inspections,
      operatingSupplies: supplies,
      anomalies,
    };
  }
}
