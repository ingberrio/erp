<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenant;
use App\Models\Batch;
use App\Models\LossTheftReport;
use App\Models\InventoryPhysicalCount;
use App\Models\TraceabilityEvent;
use App\Models\RecordRetentionPolicy;
use Carbon\Carbon;
use Illuminate\Support\Facades\Storage;

class ExportHealthCanadaData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'compliance:export-health-canada 
                            {--tenant= : Specific tenant ID to export}
                            {--start-date= : Start date for export (YYYY-MM-DD)}
                            {--end-date= : End date for export (YYYY-MM-DD)}
                            {--format=json : Export format (json, csv, xml)}
                            {--output= : Output file path}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Export comprehensive Health Canada compliance data for inspections';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🇨🇦 Health Canada Compliance Data Export');
        $this->info('=========================================');
        
        $tenantId = $this->option('tenant');
        $startDate = $this->option('start-date') ? Carbon::parse($this->option('start-date')) : Carbon::now()->subYear();
        $endDate = $this->option('end-date') ? Carbon::parse($this->option('end-date')) : Carbon::now();
        $format = $this->option('format');
        $outputPath = $this->option('output');
        
        // Get tenants to export
        if ($tenantId) {
            $tenants = Tenant::where('id', $tenantId)->get();
            if ($tenants->isEmpty()) {
                $this->error("Tenant with ID {$tenantId} not found.");
                return 1;
            }
        } else {
            $tenants = Tenant::all();
        }
        
        $exportData = [];
        
        foreach ($tenants as $tenant) {
            $this->info("\n📊 Exporting data for: {$tenant->name}");
            
            $tenantData = [
                'tenant_info' => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'subdomain' => $tenant->subdomain,
                    'export_date' => Carbon::now()->toISOString(),
                    'export_period' => [
                        'start' => $startDate->toDateString(),
                        'end' => $endDate->toDateString()
                    ]
                ],
                'facilities' => [],
                'batches' => [],
                'traceability_events' => [],
                'physical_counts' => [],
                'loss_theft_reports' => [],
                'retention_policies' => [],
                'compliance_summary' => []
            ];
            
            // Export facilities
            $facilities = $tenant->facilities;
            foreach ($facilities as $facility) {
                $tenantData['facilities'][] = [
                    'id' => $facility->id,
                    'name' => $facility->name,
                    'license_number' => $facility->license_number,
                    'address' => $facility->address ?? 'Not specified',
                    'created_at' => $facility->created_at->toISOString()
                ];
            }
            
            // Export batches with full traceability
            $batches = Batch::where('tenant_id', $tenant->id)
                ->whereBetween('created_at', [$startDate, $endDate])
                ->get();
                
            $this->info("  ✓ Found {$batches->count()} batches");
            
            foreach ($batches as $batch) {
                $tenantData['batches'][] = [
                    'id' => $batch->id,
                    'batch_number' => $batch->batch_number,
                    'product_type' => $batch->product_type,
                    'strain' => $batch->strain,
                    'quantity' => $batch->quantity,
                    'unit' => $batch->unit,
                    'status' => $batch->status,
                    'cost_per_unit' => $batch->cost_per_unit,
                    'harvest_date' => $batch->harvest_date?->toDateString(),
                    'expiry_date' => $batch->expiry_date?->toDateString(),
                    'created_at' => $batch->created_at->toISOString(),
                    'updated_at' => $batch->updated_at->toISOString()
                ];
            }
            
            // Export traceability events
            $events = TraceabilityEvent::where('tenant_id', $tenant->id)
                ->whereBetween('created_at', [$startDate, $endDate])
                ->get();
                
            $this->info("  ✓ Found {$events->count()} traceability events");
            
            foreach ($events as $event) {
                $tenantData['traceability_events'][] = [
                    'id' => $event->id,
                    'batch_id' => $event->batch_id,
                    'event_type' => $event->event_type,
                    'description' => $event->description,
                    'performed_by' => $event->performed_by,
                    'event_date' => $event->event_date->toISOString(),
                    'created_at' => $event->created_at->toISOString()
                ];
            }
            
            // Export physical counts
            $physicalCounts = InventoryPhysicalCount::where('tenant_id', $tenant->id)
                ->whereBetween('count_date', [$startDate, $endDate])
                ->get();
                
            $this->info("  ✓ Found {$physicalCounts->count()} physical counts");
            
            foreach ($physicalCounts as $count) {
                $tenantData['physical_counts'][] = [
                    'id' => $count->id,
                    'batch_id' => $count->batch_id,
                    'location' => $count->location,
                    'expected_quantity' => $count->expected_quantity,
                    'actual_quantity' => $count->actual_quantity,
                    'variance' => $count->variance,
                    'unit' => $count->unit,
                    'counted_by' => $count->counted_by,
                    'witness' => $count->witness,
                    'count_date' => $count->count_date->toISOString(),
                    'notes' => $count->notes
                ];
            }
            
            // Export loss/theft reports
            $lossReports = LossTheftReport::where('tenant_id', $tenant->id)
                ->whereBetween('incident_date', [$startDate, $endDate])
                ->get();
                
            $this->info("  ✓ Found {$lossReports->count()} loss/theft reports");
            
            foreach ($lossReports as $report) {
                $tenantData['loss_theft_reports'][] = [
                    'id' => $report->id,
                    'report_number' => $report->report_number,
                    'incident_type' => $report->incident_type,
                    'incident_category' => $report->incident_category,
                    'batch_id' => $report->batch_id,
                    'product_type' => $report->product_type,
                    'quantity_lost' => $report->quantity_lost,
                    'unit' => $report->unit,
                    'estimated_value' => $report->estimated_value,
                    'incident_date' => $report->incident_date->toISOString(),
                    'discovered_date' => $report->discovered_date?->toISOString(),
                    'reported_by' => $report->reported_by,
                    'description' => $report->description,
                    'investigation_status' => $report->investigation_status,
                    'police_notified' => $report->police_notified,
                    'police_notification_date' => $report->police_notification_date?->toISOString(),
                    'police_report_number' => $report->police_report_number,
                    'health_canada_submitted' => $report->health_canada_submitted,
                    'health_canada_submission_date' => $report->health_canada_submission_date?->toISOString()
                ];
            }
            
            // Export retention policies
            $policies = RecordRetentionPolicy::where('tenant_id', $tenant->id)->get();
            
            foreach ($policies as $policy) {
                $tenantData['retention_policies'][] = [
                    'id' => $policy->id,
                    'record_type' => $policy->record_type,
                    'retention_period_months' => $policy->retention_period_months,
                    'is_active' => $policy->is_active,
                    'created_at' => $policy->created_at->toISOString()
                ];
            }
            
            // Generate compliance summary
            $tenantData['compliance_summary'] = [
                'total_batches' => $batches->count(),
                'total_events' => $events->count(),
                'total_physical_counts' => $physicalCounts->count(),
                'total_loss_reports' => $lossReports->count(),
                'total_theft_reports' => $lossReports->where('incident_type', 'theft')->count(),
                'total_variance_amount' => $physicalCounts->sum('variance'),
                'total_loss_value' => $lossReports->sum('estimated_value'),
                'active_batches' => $batches->where('status', 'active')->count(),
                'retention_policies_count' => $policies->count(),
                'health_canada_submissions' => $lossReports->where('health_canada_submitted', true)->count()
            ];
            
            $exportData[] = $tenantData;
        }
        
        // Generate filename
        $timestamp = Carbon::now()->format('Y-m-d_H-i-s');
        $filename = $outputPath ?: "health_canada_export_{$timestamp}.{$format}";
        
        // Export data in requested format
        $this->info("\n📄 Generating export file: {$filename}");
        
        switch ($format) {
            case 'json':
                $content = json_encode($exportData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                break;
                
            case 'csv':
                $content = $this->convertToCsv($exportData);
                break;
                
            case 'xml':
                $content = $this->convertToXml($exportData);
                break;
                
            default:
                $this->error("Unsupported format: {$format}");
                return 1;
        }
        
        // Save file
        Storage::disk('local')->put($filename, $content);
        $fullPath = storage_path("app/{$filename}");
        
        $this->info("\n✅ Export completed successfully!");
        $this->info("📁 File saved to: {$fullPath}");
        $this->info("📊 Total tenants exported: " . count($exportData));
        
        // Display summary
        foreach ($exportData as $data) {
            $summary = $data['compliance_summary'];
            $this->info("\n🏢 {$data['tenant_info']['name']}:");
            $this->info("   Batches: {$summary['total_batches']}");
            $this->info("   Events: {$summary['total_events']}");
            $this->info("   Physical Counts: {$summary['total_physical_counts']}");
            $this->info("   Loss/Theft Reports: {$summary['total_loss_reports']}");
            $this->info("   Total Loss Value: $" . number_format($summary['total_loss_value'], 2));
        }
        
        return 0;
    }
    
    private function convertToCsv($data)
    {
        // Simplified CSV export - focus on key compliance data
        $csv = "Tenant,Batch Number,Product Type,Quantity,Status,Loss Reports,Total Loss Value,Physical Counts\n";
        
        foreach ($data as $tenantData) {
            $tenant = $tenantData['tenant_info']['name'];
            $summary = $tenantData['compliance_summary'];
            
            foreach ($tenantData['batches'] as $batch) {
                $csv .= implode(',', [
                    $tenant,
                    $batch['batch_number'],
                    $batch['product_type'],
                    $batch['quantity'] . $batch['unit'],
                    $batch['status'],
                    $summary['total_loss_reports'],
                    $summary['total_loss_value'],
                    $summary['total_physical_counts']
                ]) . "\n";
            }
        }
        
        return $csv;
    }
    
    private function convertToXml($data)
    {
        $xml = "<?xml version='1.0' encoding='UTF-8'?>\n";
        $xml .= "<HealthCanadaComplianceExport>\n";
        
        foreach ($data as $tenantData) {
            $xml .= "  <Tenant id='{$tenantData['tenant_info']['id']}'>\n";
            $xml .= "    <Name>{$tenantData['tenant_info']['name']}</Name>\n";
            $xml .= "    <ExportDate>{$tenantData['tenant_info']['export_date']}</ExportDate>\n";
            $xml .= "    <Summary>\n";
            
            foreach ($tenantData['compliance_summary'] as $key => $value) {
                $xml .= "      <{$key}>{$value}</{$key}>\n";
            }
            
            $xml .= "    </Summary>\n";
            $xml .= "  </Tenant>\n";
        }
        
        $xml .= "</HealthCanadaComplianceExport>";
        
        return $xml;
    }
}
