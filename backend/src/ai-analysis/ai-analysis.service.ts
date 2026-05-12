import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

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
  private readonly client: Anthropic;

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('anthropic.apiKey'),
    });
  }

  async analyzeInvoice(rawText: string, filename: string): Promise<AnalysisResult> {
    const prompt = `Du analysierst eine deutsche Werkstattrechnung für eine Spedition.

Extrahiere alle relevanten Informationen und gib sie als valides JSON zurück.

RECHNUNGSTEXT:
${rawText}

DATEINAME: ${filename}

Gib NUR das folgende JSON zurück, ohne Erklärungen, ohne Markdown-Blöcke, ohne Code-Fences:
{
  "licensePlate": "Kennzeichen im deutschen Format z.B. HH-AB-1234 oder null wenn nicht vorhanden",
  "workshopName": "Name der Werkstatt",
  "invoiceNumber": "Rechnungsnummer als String",
  "invoiceDate": "YYYY-MM-DD oder null",
  "totalAmount": 0.00,
  "currency": "EUR",
  "repairContext": "Kurze Beschreibung wofür die Reparatur war z.B. Bremsenwechsel Vorderachse",
  "summary": "Zusammenfassung der Rechnung auf Deutsch in 2-3 Sätzen",
  "positions": [
    {
      "description": "Beschreibung der Position",
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

Kategorien für Positionen:
- REPAIR: Reparaturarbeiten, Instandsetzung
- INSPECTION: SP (Sicherheitsprüfung), HU (Hauptuntersuchung), AU (Abgasuntersuchung)
- BETRIEBSMITTEL: Motoröl, Hydrauliköl, Kühlmittel, Kraftstoff, Fette, Flüssigkeiten
- LABOR: Lohnkosten, Arbeitszeit, Montage
- PARTS: Ersatzteile, Verschleißteile
- TOOLS: Werkzeuge, Spezialwerkzeug (IMMER als Anomalie markieren!)
- OTHER: Sonstiges

Anomalien MÜSSEN markiert werden wenn:
1. Werkzeuge (Schraubenschlüssel, Spezialwerkzeug, etc.) auf Reparaturrechnung
2. Mehr als 2 Kanister/Gebinde Öl, die nicht zum Reparaturkontext passen
3. Positionen die eindeutig nicht zur angegebenen Reparatur gehören (z.B. Klimaservice bei Bremsenwechsel)
4. Ungewöhnlich große Mengen Verbrauchsmaterial
5. Teile für andere Fahrzeugtypen als das berechnete Fahrzeug

Für SP/HU/AU in inspections: Falls das Datum aus dem Text erkennbar ist eintragen, nextDueDate wenn angegeben.
Für operatingSupplies: Alle Öle, Flüssigkeiten, Kraftstoffe als separate Einträge.`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unerwarteter Antworttyp von Claude API');
      }

      let text = content.text.trim();
      // JSON aus Markdown-Blöcken extrahieren falls vorhanden
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        text = jsonMatch[1].trim();
      }

      const result: AnalysisResult = JSON.parse(text);
      this.logger.log(
        `Analyse abgeschlossen für ${filename}: ${result.anomalies?.length || 0} Anomalien gefunden`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Fehler bei Analyse von ${filename}: ${error.message}`);
      throw error;
    }
  }
}
