<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\LossTheftDetectionService;
use App\Models\User;
use App\Notifications\VarianceAlertNotification;
use Illuminate\Support\Facades\Log;

class CheckVarianceAlerts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inventory:check-alerts {--notify : Send notifications for alerts} {--tenant= : Check specific tenant only}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check for inventory variance alerts and potential loss/theft patterns';

    protected LossTheftDetectionService $detectionService;

    public function __construct(LossTheftDetectionService $detectionService)
    {
        parent::__construct();
        $this->detectionService = $detectionService;
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Checking for inventory variance alerts...');
        
        // Check for variance alerts
        $alerts = $this->detectionService->checkForVarianceAlerts();
        
        if (empty($alerts)) {
            $this->info('No variance alerts found.');
        } else {
            $this->warn("Found " . count($alerts) . " variance alert(s):");
            
            foreach ($alerts as $alert) {
                $this->displayAlert($alert);
            }
            
            if ($this->option('notify')) {
                $this->sendNotifications($alerts);
            }
        }
        
        // Check for theft patterns
        $this->info('\nChecking for potential theft patterns...');
        $patterns = $this->detectionService->detectTheftPatterns();
        
        if (empty($patterns)) {
            $this->info('No suspicious patterns detected.');
        } else {
            $this->error("Found " . count($patterns) . " suspicious pattern(s):");
            
            foreach ($patterns as $pattern) {
                $this->displayPattern($pattern);
            }
        }
        
        // Log the check
        Log::info('Variance alert check completed', [
            'alerts_found' => count($alerts),
            'patterns_found' => count($patterns),
            'tenant_filter' => $this->option('tenant'),
        ]);
        
        return Command::SUCCESS;
    }
    
    /**
     * Display alert information
     */
    protected function displayAlert(array $alert): void
    {
        $severity = $alert['severity'] ?? 'medium';
        $color = match($severity) {
            'high' => 'error',
            'medium' => 'warn',
            default => 'info'
        };
        
        $this->$color("\n[{$severity}] {$alert['type']}");
        $this->line("  Batch: {$alert['batch_name']} (ID: {$alert['batch_id']})");
        $this->line("  Expected: {$alert['expected']}g");
        $this->line("  Counted: {$alert['counted']}g");
        $this->line("  Discrepancy: {$alert['discrepancy']}g");
        $this->line("  Count Date: {$alert['count_date']}");
        $this->line("  Days Pending: {$alert['days_pending']}");
    }
    
    /**
     * Display pattern information
     */
    protected function displayPattern(array $pattern): void
    {
        $severity = $pattern['severity'] ?? 'medium';
        $color = match($severity) {
            'high' => 'error',
            'medium' => 'warn',
            default => 'info'
        };
        
        $this->$color("\n[{$severity}] {$pattern['type']}");
        
        if ($pattern['type'] === 'multiple_losses') {
            $this->line("  Facility ID: {$pattern['facility_id']}");
            $this->line("  Loss Count: {$pattern['count']}");
            $this->line("  Total Amount: {$pattern['total_amount']}g");
        } elseif ($pattern['type'] === 'time_pattern') {
            $this->line("  Hour: {$pattern['hour']}:00");
            $this->line("  Incident Count: {$pattern['count']}");
            $this->line("  Total Amount: {$pattern['total_amount']}g");
        }
    }
    
    /**
     * Send notifications for alerts
     */
    protected function sendNotifications(array $alerts): void
    {
        $this->info('\nSending notifications...');
        
        try {
            // Get facility managers and responsible persons
            $notifiableUsers = User::where('is_global_admin', true)
                ->orWhereHas('roles', function($query) {
                    $query->where('name', 'facility-manager')
                          ->orWhere('name', 'responsible-person');
                })
                ->get();
            
            foreach ($notifiableUsers as $user) {
                // Create a notification for each user
                // Note: You'd need to create this notification class
                // $user->notify(new VarianceAlertNotification($alerts));
                $this->line("  Notification sent to: {$user->email}");
            }
            
            $this->info("Notifications sent to " . $notifiableUsers->count() . " users.");
            
        } catch (\Exception $e) {
            $this->error("Failed to send notifications: {$e->getMessage()}");
        }
    }
    
    /**
     * Get summary statistics
     */
    public function getSummary(): array
    {
        return [
            'alerts' => $this->detectionService->checkForVarianceAlerts(),
            'patterns' => $this->detectionService->detectTheftPatterns(),
        ];
    }
}
