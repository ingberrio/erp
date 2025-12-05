<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\TraceabilityEvent;
use App\Models\Batch;
use App\Models\InventoryPhysicalCount;
use App\Models\RecordRetentionPolicy;
use Carbon\Carbon;

class ArchiveExpiredRecords extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'records:archive {--dry-run : Show what would be archived without actually archiving} {--tenant= : Archive records for specific tenant only}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Archive records that have exceeded their retention period per Health Canada requirements';

    /**
     * Models that support record retention
     */
    protected array $retentionModels = [
        TraceabilityEvent::class,
        Batch::class,
        InventoryPhysicalCount::class,
    ];

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $isDryRun = $this->option('dry-run');
        $tenantId = $this->option('tenant');
        
        $this->info('Starting record archival process...');
        
        if ($isDryRun) {
            $this->warn('DRY RUN MODE - No records will actually be archived');
        }
        
        $totalArchived = 0;
        
        foreach ($this->retentionModels as $modelClass) {
            $archived = $this->archiveModelRecords($modelClass, $isDryRun, $tenantId);
            $totalArchived += $archived;
        }
        
        if ($totalArchived > 0) {
            $action = $isDryRun ? 'would be archived' : 'archived';
            $this->info("\nTotal records {$action}: {$totalArchived}");
        } else {
            $this->info('\nNo records found that are eligible for archival.');
        }
        
        // Log the archival activity
        if (!$isDryRun && $totalArchived > 0) {
            \Log::info('Record archival completed', [
                'total_archived' => $totalArchived,
                'tenant_id' => $tenantId,
                'executed_at' => now(),
            ]);
        }
        
        return Command::SUCCESS;
    }
    
    /**
     * Archive records for a specific model
     */
    protected function archiveModelRecords(string $modelClass, bool $isDryRun, ?string $tenantId): int
    {
        $modelName = class_basename($modelClass);
        $this->info("\nProcessing {$modelName} records...");
        
        $query = $modelClass::eligibleForArchival();
        
        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }
        
        $records = $query->get();
        
        if ($records->isEmpty()) {
            $this->line("  No {$modelName} records eligible for archival.");
            return 0;
        }
        
        $count = $records->count();
        $this->line("  Found {$count} {$modelName} record(s) eligible for archival.");
        
        if ($isDryRun) {
            foreach ($records as $record) {
                $this->line("    - {$modelName} ID: {$record->id} (Created: {$record->created_at}, Expires: {$record->retention_expires_at})");
            }
            return $count;
        }
        
        $archived = 0;
        $progressBar = $this->output->createProgressBar($count);
        $progressBar->start();
        
        foreach ($records as $record) {
            try {
                if ($record->archive('Automatic archival - retention period expired')) {
                    $archived++;
                }
            } catch (\Exception $e) {
                $this->error("\n  Failed to archive {$modelName} ID {$record->id}: {$e->getMessage()}");
                \Log::error('Record archival failed', [
                    'model' => $modelName,
                    'record_id' => $record->id,
                    'error' => $e->getMessage(),
                ]);
            }
            
            $progressBar->advance();
        }
        
        $progressBar->finish();
        $this->line("\n  Successfully archived {$archived} {$modelName} record(s).");
        
        return $archived;
    }
    
    /**
     * Get retention statistics
     */
    public function getRetentionStats()
    {
        $this->info('\n=== Record Retention Statistics ===');
        
        foreach ($this->retentionModels as $modelClass) {
            $modelName = class_basename($modelClass);
            
            $total = $modelClass::count();
            $archived = $modelClass::archived()->count();
            $eligible = $modelClass::eligibleForArchival()->count();
            
            $this->line("\n{$modelName}:");
            $this->line("  Total records: {$total}");
            $this->line("  Archived: {$archived}");
            $this->line("  Eligible for archival: {$eligible}");
        }
    }
}
