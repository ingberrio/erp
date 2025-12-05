<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use App\Models\LossTheftReport;
use App\Models\Facility;
use App\Models\Batch;
use App\Services\LossTheftDetectionService;
use Carbon\Carbon;

class LossTheftReportController extends Controller
{
    protected LossTheftDetectionService $detectionService;

    public function __construct(LossTheftDetectionService $detectionService)
    {
        $this->detectionService = $detectionService;
    }

    /**
     * Display a listing of loss/theft reports
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $tenantId = $request->header('X-Tenant-ID') ?? $user->tenant_id;
        $facilityId = $request->query('facility_id');
        
        $query = LossTheftReport::with(['facility', 'batch', 'reportedBy'])
            ->orderBy('created_at', 'desc');
        
        // Apply tenant filtering for non-global admins
        if (!$user->is_global_admin && $tenantId) {
            $query->where('tenant_id', $tenantId);
        }
        
        // Apply facility filtering if provided
        if ($facilityId) {
            $query->where('facility_id', $facilityId);
        }
        
        // Filter by status if requested
        if ($request->has('status')) {
            $query->where('hc_report_status', $request->query('status'));
        }
        
        // Filter by incident type if requested
        if ($request->has('type')) {
            $query->where('incident_type', $request->query('type'));
        }
        
        $reports = $query->paginate(25);
        
        // Add calculated fields
        $reports->getCollection()->transform(function ($report) {
            $report->requires_hc_reporting = $report->requiresHealthCanadaReporting();
            $report->days_since_incident = now()->diffInDays($report->incident_date);
            $report->urgency_level = $this->calculateUrgencyLevel($report);
            return $report;
        });
        
        return response()->json([
            'data' => $reports,
            'summary' => $this->getReportsSummary($tenantId, $facilityId),
        ]);
    }

    /**
     * Store a new loss/theft report
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'incident_type' => 'required|in:loss,theft',
            'incident_category' => 'required|in:loss_unexplained,loss_in_transit,unusual_waste,armed_robbery,break_and_entry,grab_theft,pilferage,theft_in_transit,other',
            'incident_date' => 'required|date|before_or_equal:today',
            'discovery_date' => 'required|date|after_or_equal:incident_date|before_or_equal:today',
            'facility_id' => 'required|exists:facilities,id',
            'specific_location' => 'nullable|string|max:255',
            'sub_location' => 'nullable|string|max:255',
            'batch_id' => 'nullable|exists:batches,id',
            'product_type' => 'required|in:cannabis_dried,cannabis_fresh,cannabis_oil,cannabis_plants',
            'quantity_lost' => 'required|numeric|min:0.001',
            'unit' => 'required|string|max:10',
            'estimated_value' => 'nullable|numeric|min:0',
            'description' => 'required|string|max:2000',
            'circumstances' => 'nullable|string|max:2000',
            'police_notified' => 'boolean',
            'police_report_number' => 'nullable|string|max:50',
            'police_notification_date' => 'nullable|date',
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }
        
        $data = $validator->validated();
        $data['reported_by_user_id'] = Auth::id();
        $data['tenant_id'] = $request->header('X-Tenant-ID') ?? Auth::user()->tenant_id;
        
        // Validate police notification requirements
        if ($data['police_notified'] && !$data['police_notification_date']) {
            $data['police_notification_date'] = now()->toDateString();
        }
        
        $report = LossTheftReport::create($data);
        
        Log::info('Loss/theft report created manually', [
            'report_id' => $report->id,
            'report_number' => $report->report_number,
            'user_id' => Auth::id(),
            'incident_type' => $report->incident_type,
            'quantity' => $report->quantity_lost,
        ]);
        
        return response()->json([
            'message' => 'Loss/theft report created successfully',
            'data' => $report->load(['facility', 'batch', 'reportedBy']),
            'requires_hc_reporting' => $report->requiresHealthCanadaReporting(),
        ], 201);
    }

    /**
     * Display the specified loss/theft report
     */
    public function show($id)
    {
        $report = LossTheftReport::with(['facility', 'batch', 'reportedBy', 'tenant'])
            ->findOrFail($id);
        
        // Check access permissions
        $user = Auth::user();
        if (!$user->is_global_admin && $report->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        $report->requires_hc_reporting = $report->requiresHealthCanadaReporting();
        $report->days_since_incident = now()->diffInDays($report->incident_date);
        $report->urgency_level = $this->calculateUrgencyLevel($report);
        
        return response()->json(['data' => $report]);
    }

    /**
     * Update the specified loss/theft report
     */
    public function update(Request $request, $id)
    {
        $report = LossTheftReport::findOrFail($id);
        
        // Check access permissions
        $user = Auth::user();
        if (!$user->is_global_admin && $report->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        $validator = Validator::make($request->all(), [
            'investigation_status' => 'sometimes|in:pending,in_progress,completed,referred_to_police',
            'investigation_findings' => 'nullable|string|max:2000',
            'corrective_actions' => 'nullable|string|max:2000',
            'hc_confirmation_number' => 'nullable|string|max:50',
            'police_notified' => 'sometimes|boolean',
            'police_report_number' => 'nullable|string|max:50',
            'police_notification_date' => 'nullable|date',
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }
        
        $report->update($validator->validated());
        
        Log::info('Loss/theft report updated', [
            'report_id' => $report->id,
            'user_id' => Auth::id(),
            'changes' => $validator->validated(),
        ]);
        
        return response()->json([
            'message' => 'Report updated successfully',
            'data' => $report->load(['facility', 'batch', 'reportedBy'])
        ]);
    }

    /**
     * Mark report as submitted to Health Canada
     */
    public function markSubmittedToHealthCanada(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'confirmation_number' => 'required|string|max:50',
            'submission_notes' => 'nullable|string|max:1000',
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }
        
        $report = LossTheftReport::findOrFail($id);
        
        // Check access permissions
        $user = Auth::user();
        if (!$user->is_global_admin && $report->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        $report->markReportedToHealthCanada($request->confirmation_number);
        
        Log::info('Loss/theft report marked as submitted to Health Canada', [
            'report_id' => $report->id,
            'confirmation_number' => $request->confirmation_number,
            'user_id' => Auth::id(),
        ]);
        
        return response()->json([
            'message' => 'Report marked as submitted to Health Canada',
            'data' => $report
        ]);
    }

    /**
     * Generate Health Canada Form CS-FRM-011 data
     */
    public function generateHealthCanadaForm($id)
    {
        $report = LossTheftReport::with(['facility', 'batch', 'reportedBy', 'tenant'])
            ->findOrFail($id);
        
        // Check if report requires Health Canada submission
        if (!$report->requiresHealthCanadaReporting()) {
            return response()->json([
                'message' => 'This report does not meet Health Canada reporting thresholds',
                'threshold_info' => LossTheftReport::HC_REPORTING_THRESHOLDS
            ], 400);
        }
        
        $formData = [
            // Basic Information
            'report_number' => $report->report_number,
            'incident_type' => $report->incident_type,
            'incident_category' => $report->incident_category,
            'incident_date' => $report->incident_date->format('Y-m-d'),
            'discovery_date' => $report->discovery_date->format('Y-m-d'),
            
            // Facility Information
            'facility_name' => $report->facility->name,
            'facility_address' => $report->facility->address,
            'licence_number' => $report->facility->licence_number,
            
            // Product Information
            'product_type' => $report->product_type,
            'quantity_lost' => $report->quantity_lost,
            'unit' => $report->unit,
            'estimated_value' => $report->estimated_value,
            
            // Incident Details
            'description' => $report->description,
            'circumstances' => $report->circumstances,
            'specific_location' => $report->specific_location,
            
            // Investigation
            'investigation_status' => $report->investigation_status,
            'investigation_findings' => $report->investigation_findings,
            'corrective_actions' => $report->corrective_actions,
            
            // Police Information
            'police_notified' => $report->police_notified,
            'police_report_number' => $report->police_report_number,
            'police_notification_date' => $report->police_notification_date?->format('Y-m-d'),
            
            // Reporting Information
            'reported_by' => $report->reportedBy->name,
            'reported_by_email' => $report->reportedBy->email,
            'report_date' => $report->created_at->format('Y-m-d'),
        ];
        
        return response()->json([
            'form_data' => $formData,
            'form_type' => 'CS-FRM-011',
            'instructions' => 'This data should be submitted to Health Canada using Form CS-FRM-011',
            'submission_deadline' => $this->calculateSubmissionDeadline($report),
        ]);
    }

    /**
     * Get reports summary statistics
     */
    protected function getReportsSummary(?int $tenantId = null, ?int $facilityId = null): array
    {
        $query = LossTheftReport::query();
        
        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }
        
        if ($facilityId) {
            $query->where('facility_id', $facilityId);
        }
        
        return [
            'total_reports' => $query->count(),
            'pending_hc_reports' => $query->where('hc_report_status', 'pending')->count(),
            'theft_reports' => $query->where('incident_type', 'theft')->count(),
            'loss_reports' => $query->where('incident_type', 'loss')->count(),
            'total_value_lost' => $query->sum('estimated_value'),
            'reports_this_month' => $query->whereMonth('created_at', now()->month)->count(),
        ];
    }

    /**
     * Calculate urgency level for a report
     */
    protected function calculateUrgencyLevel(LossTheftReport $report): string
    {
        if ($report->incident_type === 'theft') {
            return 'urgent';
        }
        
        if ($report->requiresHealthCanadaReporting()) {
            return 'high';
        }
        
        if ($report->quantity_lost >= 50) {
            return 'high';
        }
        
        return 'medium';
    }

    /**
     * Calculate Health Canada submission deadline
     */
    protected function calculateSubmissionDeadline(LossTheftReport $report): string
    {
        // Health Canada requires immediate reporting for theft
        // and within reasonable timeframe for losses
        if ($report->incident_type === 'theft') {
            return 'Immediate (within 24 hours)';
        }
        
        return 'Within 7 days of discovery';
    }
}
