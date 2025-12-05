<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use App\Models\Batch;
use App\Models\InventoryReconciliation;
use App\Models\InventoryPhysicalCount;
use App\Services\LossTheftDetectionService;
use App\Models\LossTheftReport;

class InventoryReconciliationController extends Controller
{
    protected LossTheftDetectionService $lossTheftService;

    public function __construct(LossTheftDetectionService $lossTheftService)
    {
        $this->lossTheftService = $lossTheftService;
    }
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID') ?? (Auth::check() ? Auth::user()->tenant_id : null);
        $user = Auth::user();
        $isGlobalAdmin = $user->is_global_admin ?? false;
        $facilityId = $request->query('facility_id');

        $query = Batch::query()->where('facility_id', $facilityId);

        if (!$isGlobalAdmin && $tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $batches = $query->get();

        $data = $batches->map(function ($batch) {
            // Busca el último conteo físico (si existe)
            $lastPhysicalCount = \App\Models\InventoryPhysicalCount::where('batch_id', $batch->id)
                ->orderByDesc('count_date')
                ->first();
        
            $justificationStatus = 'Sin Conciliación';
            $justificationReason = null;
            $justificationNotes = null;
            $justifiedAt = null;
        
            if ($lastPhysicalCount && $lastPhysicalCount->justification_reason_id) {
                $justificationStatus = 'Justificada';
                $justificationReason = optional($lastPhysicalCount->justificationReason)->name; // Asumiendo relación belongsTo
                $justificationNotes = $lastPhysicalCount->justification_notes;
                $justifiedAt = $lastPhysicalCount->justified_at;
            } else if ($lastPhysicalCount && !is_null($lastPhysicalCount->counted_quantity)) {
                // Si hay discrepancia pero no justificación
                $justificationStatus = 'Discrepancia';
            }
        
            return [
                'batch_id'          => $batch->id,
                'batch_name'        => $batch->name,
                'product_type'      => $batch->product_type,
                'facility_id'       => $batch->facility_id,
                'logical_quantity'  => $batch->current_units,
                'logical_unit'      => $batch->units,
                // Si tienes el conteo físico, agréguelo aquí
                'physical_quantity' => $lastPhysicalCount?->counted_quantity,
                'physical_unit'     => $batch->units, // o el unit que corresponda
                'discrepancy'       => $lastPhysicalCount ? ($batch->current_units - $lastPhysicalCount->counted_quantity) : null,
                'discrepancy_percentage' => $lastPhysicalCount ? (100 * (($batch->current_units - $lastPhysicalCount->counted_quantity)/max(1,$batch->current_units))) : null,
                'count_date'        => $lastPhysicalCount?->count_date,
                'status'            => $justificationStatus,
                'justification_reason' => $justificationReason,
                'justification_notes' => $justificationNotes,
                'justified_at' => $justifiedAt,
            ];
        });
        

        return response()->json([
            'message' => 'Endpoint de reconciliación de inventario alcanzado exitosamente (Método index).',
            'data' => $data,
            'user_id' => $user->id,
            'tenant_id' => $tenantId ?? 'N/A',
            'is_global_admin' => $isGlobalAdmin,
            'request_facility_id' => $facilityId,
        ]);
    }

    public function storePhysicalCount(Request $request)
    {
        $request->validate([
            'batch_id' => 'required|exists:batches,id',
            'counted_quantity' => 'required|numeric|min:0',
            'count_date' => 'required|date',
            'facility_id' => 'required|exists:facilities,id',
        ]);

        $count = InventoryPhysicalCount::create([
            'batch_id'        => $request->batch_id,
            'counted_quantity'=> $request->counted_quantity,
            'count_date'      => $request->count_date,
            'facility_id'     => $request->facility_id,
            'sub_location_id' => $request->sub_location_id ?? null,
            'notes'           => $request->notes ?? null,
            'user_id'         => \Auth::id(),
        ]);

        return response()->json([
            'message' => 'Conteo físico registrado exitosamente.',
            'data' => $count
        ]);
    }

    public function justifyDiscrepancy(Request $request, $batch_id)
    {
        $request->validate([
            'reason_id' => 'required|exists:discrepancy_reasons,id',
            'notes' => 'nullable|string|max:1000',
        ]);

        // Busca el último conteo físico para este lote
        $physicalCount = \App\Models\InventoryPhysicalCount::where('batch_id', $batch_id)
            ->orderByDesc('count_date')
            ->first();

        if (!$physicalCount) {
            return response()->json(['message' => 'No se encontró un conteo físico para este lote.'], 404)
;
        }

        // Get the batch and reason for loss/theft analysis
        $batch = Batch::findOrFail($batch_id);
        $discrepancyReason = \App\Models\DiscrepancyReason::find($request->reason_id);
        
        // Calculate discrepancy
        $expectedQuantity = $batch->current_units;
        $actualQuantity = $physicalCount->counted_quantity;
        $discrepancyAmount = $expectedQuantity - $actualQuantity;
        
        // Analyze for potential loss/theft BEFORE justifying
        $lossReport = null;
        if ($discrepancyAmount > 0) { // Only for shortages
            try {
                $lossReport = $this->lossTheftService->analyzeInventoryDiscrepancy(
                    $batch,
                    $expectedQuantity,
                    $actualQuantity,
                    $discrepancyReason?->name,
                    \Auth::id()
                );
                
                if ($lossReport) {
                    Log::info('Loss/theft report generated during reconciliation', [
                        'batch_id' => $batch_id,
                        'report_id' => $lossReport->id,
                        'report_number' => $lossReport->report_number,
                        'discrepancy' => $discrepancyAmount,
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('Failed to analyze inventory discrepancy for loss/theft', [
                    'batch_id' => $batch_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Guarda la justificación
        $physicalCount->justification_reason_id = $request->reason_id;
        $physicalCount->justification_notes = $request->notes;
        $physicalCount->justified_by_user_id = \Auth::id();
        $physicalCount->justified_at = now();
        $physicalCount->save();

        $response = [
            'message' => 'Discrepancia justificada exitosamente.',
            'data' => $physicalCount
        ];
        
        // Include loss report information if generated
        if ($lossReport) {
            $response['loss_theft_report'] = [
                'id' => $lossReport->id,
                'report_number' => $lossReport->report_number,
                'requires_hc_reporting' => $lossReport->requiresHealthCanadaReporting(),
                'message' => 'A loss/theft report has been automatically generated due to the nature and amount of the discrepancy.'
            ];
        }

        return response()->json($response);
    }

}
