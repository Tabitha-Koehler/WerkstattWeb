import { Module } from '@nestjs/common';
import { FileWatcherService } from './file-watcher.service';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [InvoicesModule],
  providers: [FileWatcherService],
})
export class FileWatcherModule {}
