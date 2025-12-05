<?php

namespace App\Services;

use App\Models\LossTheftReport;
use App\Models\Batch;
use App\Models\InventoryPhysicalCount;
use App\Models\TraceabilityEvent;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use App\Notifications\LossTheftDetectedNotification;

class LossTheftDetectionService
{
    /**
     * Analyze inventory discrepancy and determine if loss/theft report is needed
     */
    public function analyzeInventoryDiscrepancy(
        Batch $batch,
        float $expectedQuantity,
        float $actualQuantity,
        ?string $justificationReason = null,
        ?int $userId = null
    ): ?LossTheftReport {
        $discrepancy = $expectedQuantity - $actualQuantity;
        
        // Only process negative discrepancies (shortages)
        if ($discrepancy <= 0) {
            return null;
        }

        Log::info('Analyzing inventory discrepancy', [
            'batch_id' => $batch->id,
            'expected' => $expectedQuantity,
            'actual' => $actualQuantity,
            'discrepancy' => $discrepancy,
            'reason' => $justificationReason,
        ]);

        // Check if this is an explainable loss that doesn't require reporting
        if ($this->isExplainableLoss($justificationReason, $discrepancy)) {
            Log::info('Discrepancy classified as explainable loss', [
                'batch_id' => $batch->id,
                'reason' => $justificationReason,
                'amount' => $discrepancy,
            ]);
            return null;
        }

        // Check if discrepancy meets Health Canada reporting thresholds
        if (!$this->meetsReportingThreshold($batch->product_type, $discrepancy)) {
            Log::info('Discrepancy below Health Canada reporting threshold', [
                'batch_id' => $batch->id,
                'product_type' => $batch->product_type,
                'amount' => $discrepancy,
            ]);
            return null;
        }

        // Create loss report
        $lossReport = $this->createLossReport($batch, $discrepancy, $justificationReason, $userId);
        
        // Send notifications
        $this->sendLossTheftNotifications($lossReport);
        
        // Create traceability event for the loss
        $this->createLossTraceabilityEvent($batch, $discrepancy, $lossReport);

        return $lossReport;
    }

    /**
     * Check if loss is explainable and doesn't require reporting
     */
    protected function isExplainableLoss(?string $reason, float $amount): bool
    {
        if (!$reason) {
            return false;
        }

        $explainableReasons = [
            'sampling',
            'testing', 
            'quality_control',
            'processing_loss',
            'moisture_loss',
            'trimming_waste',
            'normal_waste',
            'lab_testing',
            'research'
        ];

        $normalizedReason = strtolower(str_replace([' ', '_', '-'], '', $reason));
        
        foreach ($explainableReasons as $explainable) {
            if (str_contains($normalizedReason, str_replace('_', '', $explainable))) {
                // Even explainable losses have limits
                return $amount <= $this->getMaxExplainableLoss($explainable);
            }
        }

        return false;
    }

    /**
     * Get maximum explainable loss for different reasons
     */
    protected function getMaxExplainableLoss(string $reason): float
    {
        return match($reason) {
            'sampling', 'testing', 'quality_control', 'lab_testing' => 5.0, // 5g max for testing
            'processing_loss' => 50.0, // 50g max for processing
            'moisture_loss' => 20.0, // 20g max for moisture
            'trimming_waste' => 30.0, // 30g max for trimming
            'normal_waste' => 10.0, // 10g max for normal waste
            'research' => 25.0, // 25g max for research
            default => 1.0, // 1g default max
        };
    }

    /**
     * Check if amount meets Health Canada reporting thresholds
     */
    protected function meetsReportingThreshold(string $productType, float $amount): bool
    {
        $thresholds = [
            'dried' => 1.0,     // 1g
            'fresh' => 5.0,     // 5g
            'oil' => 1.0,       // 1ml
            'extract' => 1.0,   // 1g
            'plants' => 1,      // 1 plant
        ];

        $threshold = $thresholds[$productType] ?? 1.0;
        return $amount >= $threshold;
    }

    /**
     * Create loss report
     */
    protected function createLossReport(
        Batch $batch, 
        float $amount, 
        ?string $reason, 
        ?int $userId
    ): LossTheftReport {
        $productTypeMapping = [
            'dried' => 'cannabis_dried',
            'fresh' => 'cannabis_fresh',
            'oil' => 'cannabis_oil',
            'extract' => 'cannabis_oil',
            'plants' => 'cannabis_plants'
        ];

        return LossTheftReport::create([
            'incident_type' => 'loss',
            'incident_category' => 'loss_unexplained',
            'incident_date' => now()->toDateString(),
            'discovery_date' => now()->toDateString(),
            'facility_id' => $batch->facility_id,
            'batch_id' => $batch->id,
            'product_type' => $productTypeMapping[$batch->product_type] ?? 'cannabis_dried',
            'quantity_lost' => $amount,
            'unit' => $batch->units ?? 'g',
            'estimated_value' => $this->calculateEstimatedValue($batch, $amount),
            'description' => "Unexplained inventory discrepancy detected during physical count for batch: {$batch->name}",
            'circumstances' => $reason 
                ? "Reported justification: {$reason}. Amount exceeds normal parameters for this reason."
                : "No specific justification provided for inventory shortage.",
            'reported_by_user_id' => $userId ?? auth()->id() ?? 1,
            'tenant_id' => $batch->tenant_id,
            'investigation_status' => 'pending',
            'hc_report_status' => 'pending',
        ]);
    }

    /**
     * Calculate estimated dollar value of lost cannabis
     */
    protected function calculateEstimatedValue(Batch $batch, float $amount): float
    {
        // These are approximate wholesale values - should be configurable
        $pricePerGram = match($batch->product_type) {
            'dried' => 5.00,    // $5/g dried cannabis
            'fresh' => 1.00,    // $1/g fresh cannabis
            'oil' => 50.00,     // $50/ml oil
            'extract' => 40.00, // $40/g extract
            default => 5.00
        };

        return $amount * $pricePerGram;
    }

    /**
     * Send notifications for loss/theft detection
     */
    protected function sendLossTheftNotifications(LossTheftReport $report): void
    {
        try {
            // Get facility managers and responsible persons
            $facility = $report->facility;
            $notifiableUsers = [];

            // Add facility responsible person
            if ($facility && $facility->tenant) {
                $responsiblePersons = $facility->tenant->users()
                    ->where('is_global_admin', true)
                    ->orWhereHas('roles', function($query) {
                        $query->where('name', 'facility-manager')
                              ->orWhere('name', 'responsible-person');
                    })
                    ->get();
                
                $notifiableUsers = $notifiableUsers->merge($responsiblePersons);
            }

            // Send notifications
            foreach ($notifiableUsers as $user) {
                $user->notify(new LossTheftDetectedNotification($report));
            }

            Log::info('Loss/theft notifications sent', [
                'report_id' => $report->id,
                'recipients' => $notifiableUsers->count(),
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send loss/theft notifications', [
                'report_id' => $report->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Create traceability event for the loss
     */
    protected function createLossTraceabilityEvent(
        Batch $batch, 
        float $amount, 
        LossTheftReport $report
    ): void {
        try {
            TraceabilityEvent::create([
                'batch_id' => $batch->id,
                'event_type' => 'loss_theft',
                'description' => "Inventory loss detected - Report #{$report->report_number}",
                'facility_id' => $batch->facility_id,
                'quantity' => $amount,
                'unit' => $batch->units ?? 'g',
                'reason' => "Loss/theft report generated: {$report->report_number}",
                'user_id' => $report->reported_by_user_id,
                'tenant_id' => $batch->tenant_id,
            ]);

            // Update batch quantity to reflect the loss
            $batch->update([
                'current_units' => max(0, $batch->current_units - $amount)
            ]);

            Log::info('Loss traceability event created', [
                'batch_id' => $batch->id,
                'report_id' => $report->id,
                'amount' => $amount,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to create loss traceability event', [
                'batch_id' => $batch->id,
                'report_id' => $report->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Detect potential theft patterns
     */
    public function detectTheftPatterns(): array
    {
        $patterns = [];

        // Multiple losses from same facility in short time
        $recentLosses = LossTheftReport::where('created_at', '>=', now()->subDays(30))
            ->selectRaw('facility_id, COUNT(*) as loss_count, SUM(quantity_lost) as total_lost')
            ->groupBy('facility_id')
            ->havingRaw('COUNT(*) >= 3 OR SUM(quantity_lost) >= 100')
            ->get();

        foreach ($recentLosses as $pattern) {
            $patterns[] = [
                'type' => 'multiple_losses',
                'facility_id' => $pattern->facility_id,
                'count' => $pattern->loss_count,
                'total_amount' => $pattern->total_lost,
                'severity' => $pattern->loss_count >= 5 ? 'high' : 'medium',
            ];
        }

        // Losses during specific shifts or times - only if we have discovery_date data
        try {
            $timePatterns = LossTheftReport::selectRaw('
                    EXTRACT(HOUR FROM discovery_date) as hour, 
                    COUNT(*) as count,
                    SUM(quantity_lost) as total
                ')
                ->where('created_at', '>=', now()->subDays(90))
                ->whereNotNull('discovery_date')
                ->groupByRaw('EXTRACT(HOUR FROM discovery_date)')
                ->havingRaw('COUNT(*) >= 3')
                ->get();

            foreach ($timePatterns as $pattern) {
                $patterns[] = [
                    'type' => 'time_pattern',
                    'hour' => (int)$pattern->hour,
                    'count' => $pattern->count,
                    'total_amount' => $pattern->total,
                    'severity' => $pattern->count >= 5 ? 'high' : 'medium',
                ];
            }
        } catch (\Exception $e) {
            Log::warning('Could not analyze time patterns', ['error' => $e->getMessage()]);
        }

        return $patterns;
    }

    /**
     * Generate automated variance alert
     */
    public function checkForVarianceAlerts(): array
    {
        $alerts = [];

        // Check for batches with significant discrepancies
        $recentCounts = InventoryPhysicalCount::with('batch')
            ->where('count_date', '>=', now()->subDays(7))
            ->where('justified_at', null) // Unjustified discrepancies
            ->get();

        foreach ($recentCounts as $count) {
            if (!$count->batch) continue;

            $discrepancy = abs($count->batch->current_units - $count->counted_quantity);
            
            if ($discrepancy >= 1.0) { // 1g threshold
                $alerts[] = [
                    'type' => 'unjustified_discrepancy',
                    'batch_id' => $count->batch_id,
                    'batch_name' => $count->batch->name,
                    'expected' => $count->batch->current_units,
                    'counted' => $count->counted_quantity,
                    'discrepancy' => $discrepancy,
                    'count_date' => $count->count_date,
                    'days_pending' => now()->diffInDays($count->count_date),
                    'severity' => $discrepancy >= 10 ? 'high' : 'medium',
                ];
            }
        }

        return $alerts;
    }
}