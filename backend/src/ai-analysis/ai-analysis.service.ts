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
  totalAmount: number;
  currency: string;
  repairContext: string;
  summary: string;
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

  constructor(private readonly configService: ConfigService) {
    this.ollamaUrl = this.configService.get<string>('ollama.url') || 'http://localhost:11434';
    this.model = this.configService.get<string>('ollama.model') || 'llama3.2';
  }

  async analyzeInvoice(rawText: string, filename: string): Promise<AnalysisResult> {
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
  "totalAmount": 0.00,
  "currency": "EUR",
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
Anomalien markieren wenn: Werkzeuge auf Reparaturrechnung, mehr als 2 Öl-Kanister die nicht zur Reparatur passen, Positionen die nicht zum Reparaturkontext passen.
SP=Sicherheitsprüfung, HU=Hauptuntersuchung, AU=Abgasuntersuchung als inspections eintragen.`;

    try {
      const responseText = await this.callOllama(prompt);
      const result: AnalysisResult = this.parseJson(responseText);
      this.logger.log(
        `Ollama-Analyse abgeschlossen für ${filename}: ${result.anomalies?.length || 0} Anomalien`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Ollama-Fehler bei ${filename}: ${error.message}`);
      // Fallback: regelbasierte Extraktion
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
    // JSON aus Markdown-Blöcken extrahieren
    const fence = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) clean = fence[1].trim();
    // Erstes { bis letztes } extrahieren
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
    return JSON.parse(clean);
  }

  // ── Regelbasierter Fallback wenn Ollama nicht verfügbar ──────────────────
  private ruleBasedFallback(rawText: string, filename: string): AnalysisResult {
    this.logger.warn(`Verwende regelbasierte Extraktion für ${filename}`);
    const text = rawText;

    // Kennzeichen erkennen (deutsches Format)
    // Strategie 1: nach "Kennzeichen:" suchen (zuverlässigste Quelle)
    const kennzeichenCtx = text.match(/Kennzeichen[:\s]+([A-ZÄÖÜ]{1,3}[\s]*[-]?[\s]*[A-Z]{1,2}[\s]*[-]?[\s]*\d{1,4}[HE]?)/i);
    // Strategie 2: allgemeine Mustererkennung (flexibel: Leerzeichen+Bindestrich in beliebiger Kombi)
    const genericMatch = text.match(/\b([A-ZÄÖÜ]{1,3})\s*[-]?\s*([A-Z]{1,2})\s*[-]?\s*(\d{1,4}[HE]?)\b/);

    let licensePlate: string | null = null;
    if (kennzeichenCtx) {
      // Normalisieren: "HAM -CK 504" → "HAM-CK 504"
      const raw = kennzeichenCtx[1].replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
      // Sicherstellen: FORMAT X-XX 0000
      const parts = raw.match(/^([A-ZÄÖÜ]{1,3})-?([A-Z]{1,2})\s*(\d{1,4}[HE]?)$/i);
      licensePlate = parts ? `${parts[1].toUpperCase()}-${parts[2].toUpperCase()} ${parts[3].toUpperCase()}` : raw.toUpperCase();
    } else if (genericMatch) {
      licensePlate = `${genericMatch[1]}-${genericMatch[2]} ${genericMatch[3]}`.toUpperCase();
    }

    // Gesamtbetrag
    const totalMatch = text.match(/(?:Gesamt|Brutto|Rechnungsbetrag|Total)[^\d]*(\d{1,6}[.,]\d{2})/i);
    const totalAmount = totalMatch ? parseFloat(totalMatch[1].replace(',', '.')) : 0;

    // Datum
    const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    const invoiceDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : null;

    // Werkstatt (erste Zeile die nicht leer ist)
    const firstLine = text.split('\n').find(l => l.trim().length > 3)?.trim() || 'Unbekannte Werkstatt';

    // Rechnungsnummer
    const numMatch = text.match(/(?:Rechnungs(?:nummer|nr\.?|-))[^\d]*(\d[\d\-\/]+)/i);
    const invoiceNumber = numMatch ? numMatch[1] : '';

    // Prüfungen
    const inspections: InspectionResult[] = [];
    if (/\bSP\b|Sicherheitspr[üu]fung/i.test(text)) inspections.push({ type: 'SP', date: invoiceDate, nextDueDate: null });
    if (/\bHU\b|Hauptuntersuchung/i.test(text)) inspections.push({ type: 'HU', date: invoiceDate, nextDueDate: null });
    if (/\bAU\b|Abgasuntersuchung/i.test(text)) inspections.push({ type: 'AU', date: invoiceDate, nextDueDate: null });

    // Betriebsmittel
    const supplies: OperatingSupplyResult[] = [];
    const oilMatch = text.match(/(\d+[.,]?\d*)\s*[lL]\s+(?:Motor|Hydraulik|Getriebe)?[öo]l/gi);
    if (oilMatch) {
      oilMatch.forEach(m => {
        const qty = parseFloat(m.match(/[\d.,]+/)?.[0]?.replace(',', '.') || '0');
        supplies.push({ type: 'Öl', quantity: qty, unit: 'L' });
      });
    }

    // Anomalien: Werkzeug-Erkennung
    const anomalies: AnomalyResult[] = [];
    const toolKeywords = ['Werkzeug', 'Schraubenschlüssel', 'Zange', 'Hammer', 'Spezialwerkzeug'];
    toolKeywords.forEach(kw => {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        anomalies.push({ positionDescription: kw, reason: 'Werkzeug auf Reparaturrechnung' });
      }
    });

    return {
      licensePlate,
      workshopName: firstLine,
      invoiceNumber,
      invoiceDate,
      totalAmount,
      currency: 'EUR',
      repairContext: 'Automatisch erkannt (regelbasiert)',
      summary: `Rechnung von ${firstLine}, Betrag: ${totalAmount} EUR. Verarbeitet ohne KI (Ollama nicht aktiv).`,
      positions: [],
      inspections,
      operatingSupplies: supplies,
      anomalies,
    };
  }
}
