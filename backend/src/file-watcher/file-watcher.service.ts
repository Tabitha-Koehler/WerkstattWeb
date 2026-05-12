import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class FileWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileWatcherService.name);
  private watcher: chokidar.FSWatcher | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly invoicesService: InvoicesService,
  ) {}

  onModuleInit() {
    const watchFolder = this.configService.get<string>('watchFolder');

    if (!watchFolder) {
      this.logger.warn('WATCH_FOLDER nicht konfiguriert – Ordnerüberwachung deaktiviert');
      return;
    }

    if (!fs.existsSync(watchFolder)) {
      try {
        fs.mkdirSync(watchFolder, { recursive: true });
        this.logger.log(`Überwachungsordner erstellt: ${watchFolder}`);
      } catch (e) {
        this.logger.error(`Ordner konnte nicht erstellt werden: ${watchFolder} – ${e.message}`);
        return;
      }
    }

    this.logger.log(`Überwache Ordner: ${watchFolder}`);

    this.watcher = chokidar.watch(watchFolder, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
    });

    this.watcher.on('add', (filePath: string) => {
      if (filePath.toLowerCase().endsWith('.pdf')) {
        this.logger.log(`Neue Rechnung erkannt: ${filePath}`);
        this.processFile(filePath);
      }
    });

    this.watcher.on('error', (error) => {
      this.logger.error(`Fehler beim Überwachen: ${error}`);
    });
  }

  private async processFile(filePath: string): Promise<void> {
    try {
      await this.invoicesService.processInvoiceFile(filePath);
    } catch (error) {
      this.logger.error(`Fehler bei Verarbeitung von ${filePath}: ${error.message}`);
    }
  }

  onModuleDestroy() {
    if (this.watcher) {
      this.watcher.close();
      this.logger.log('Ordnerüberwachung gestoppt');
    }
  }
}
