<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\CultivationArea;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class BatchController extends Controller
{
    /**
     * Display a listing of the resource.
     * GET /api/batches
     * GET /api/cultivation-areas/{cultivationArea}/batches (filtrado por área)
     */
    public function index(Request $request, CultivationArea $cultivationArea = null)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing.'], 400);
        }

        try {
            $query = Batch::where('tenant_id', $tenantId);

            if ($cultivationArea && $cultivationArea->tenant_id == $tenantId) {
                $query->where('cultivation_area_id', $cultivationArea->id);
            } elseif ($cultivationArea) { // CultivationArea provided but tenant mismatch
                abort(403, 'Unauthorized access: Cultivation Area does not belong to the current tenant.');
            }

            $batches = $query->get();
            return response()->json($batches);
        } catch (\Throwable $e) {
            Log::error('Error fetching batches', [
                'tenant_id' => $tenantId,
                'cultivation_area_id' => $cultivationArea ? $cultivationArea->id : 'N/A',
                'error_message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to fetch batches.'], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     * POST /api/batches
     */
    public function store(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing.'], 400);
        }

        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'advance_to_harvesting_on' => 'nullable|date',
                'current_units' => 'required|integer|min:0',
                'end_type' => 'required|string|max:50',
                'variety' => 'required|string|max:255',
                'projected_yield' => 'nullable|numeric|min:0',
                'cultivation_area_id' => [
                    'required',
                    'exists:cultivation_areas,id',
                    Rule::exists('cultivation_areas', 'id')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
            ]);

            $batch = Batch::create([
                'name' => $validated['name'],
                'advance_to_harvesting_on' => $validated['advance_to_harvesting_on'] ?? null,
                'current_units' => $validated['current_units'],
                'end_type' => $validated['end_type'],
                'variety' => $validated['variety'],
                'projected_yield' => $validated['projected_yield'] ?? null,
                'cultivation_area_id' => $validated['cultivation_area_id'],
                'tenant_id' => $tenantId,
            ]);

            Log::info('Batch created successfully.', ['batch_id' => $batch->id, 'tenant_id' => $tenantId]);
            return response()->json($batch, 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed during batch store', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during batch store', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     * GET /api/batches/{batch}
     */
    public function show(Request $request, Batch $batch)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($batch->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: Batch does not belong to the current tenant.');
        }
        // Cargar relaciones si es necesario para el frontend
        $batch->load(['cultivationArea']);
        return response()->json($batch);
    }

    /**
     * Update the specified resource in storage.
     * PUT /api/batches/{batch}
     */
    public function update(Request $request, Batch $batch)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($batch->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to update this Batch: Tenant mismatch.');
        }

        try {
            $validated = $request->validate([
                'name' => 'sometimes|required|string|max:255',
                'advance_to_harvesting_on' => 'nullable|date',
                'current_units' => 'sometimes|required|integer|min:0',
                'end_type' => 'sometimes|required|string|max:50',
                'variety' => 'sometimes|required|string|max:255',
                'projected_yield' => 'nullable|numeric|min:0',
                'cultivation_area_id' => [ // Allows moving batch to another cultivation area
                    'sometimes',
                    'required',
                    'exists:cultivation_areas,id',
                    Rule::exists('cultivation_areas', 'id')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
            ]);

            $batch->update($validated);

            Log::info('Batch updated successfully.', ['batch_id' => $batch->id, 'tenant_id' => $tenantId]);
            return response()->json($batch);
        } catch (ValidationException $e) {
            Log::error('Validation failed during batch update', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during batch update', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     * DELETE /api/batches/{batch}
     */
    public function destroy(Request $request, Batch $batch)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($batch->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to delete this Batch: Tenant mismatch.');
        }

        try {
            $batch->delete();
            Log::info('Batch deleted successfully.', ['batch_id' => $batch->id, 'tenant_id' => $tenantId]);
            return response()->noContent();
        } catch (\Throwable $e) {
            Log::error('Error deleting batch', ['batch_id' => $batch->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Failed to delete batch.'], 500);
        }
    }
}
