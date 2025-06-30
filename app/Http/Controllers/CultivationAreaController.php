<?php

namespace App\Http\Controllers;

use App\Models\CultivationArea;
use App\Models\Facility;
use App\Models\Stage;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB; // Importar DB para transacciones

class CultivationAreaController extends Controller
{
    /**
     * Display a listing of the resource.
     * GET /api/cultivation-areas
     * GET /api/facilities/{facility}/cultivation-areas (filtrado por instalación)
     * GET /api/stages/{stage}/cultivation-areas (filtrado por etapa actual)
     */
    public function index(Request $request, Facility $facility = null, Stage $stage = null)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing.'], 400);
        }

        try {
            $query = CultivationArea::where('tenant_id', $tenantId);

            if ($facility && $facility->tenant_id == $tenantId) {
                $query->where('facility_id', $facility->id);
            } elseif ($facility) { // Facility provided but tenant mismatch
                abort(403, 'Unauthorized access: Facility does not belong to the current tenant.');
            }

            if ($stage && $stage->tenant_id == $tenantId) {
                $query->where('current_stage_id', $stage->id);
            } elseif ($stage) { // Stage provided but tenant mismatch
                abort(403, 'Unauthorized access: Stage does not belong to the current tenant.');
            }

            // Cargar relaciones para el frontend (batches y currentStage)
            $cultivationAreas = $query->with(['batches', 'currentStage'])->orderBy('order')->get(); // Ordenar por 'order'

            return response()->json($cultivationAreas);
        } catch (\Throwable $e) {
            Log::error('Error fetching cultivation areas', [
                'tenant_id' => $tenantId,
                'facility_id' => $facility ? $facility->id : 'N/A',
                'stage_id' => $stage ? $stage->id : 'N/A',
                'error_message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to fetch cultivation areas.'], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     * POST /api/cultivation-areas
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
                'description' => 'nullable|string|max:1000',
                'capacity_units' => 'nullable|integer|min:0',
                'capacity_unit_type' => 'nullable|string|max:50',
                'facility_id' => [
                    'nullable',
                    'exists:facilities,id',
                    Rule::exists('facilities', 'id')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
                'current_stage_id' => [
                    'required',
                    'exists:stages,id',
                    Rule::exists('stages', 'id')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
                'order' => 'nullable|integer|min:0', // Permitir order al crear
            ]);

            // Determinar el siguiente orden si no se proporciona
            $maxOrder = CultivationArea::where('current_stage_id', $validated['current_stage_id'])
                                        ->where('tenant_id', $tenantId)
                                        ->max('order');
            $order = $validated['order'] ?? ($maxOrder !== null ? $maxOrder + 1 : 0);


            $cultivationArea = CultivationArea::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'capacity_units' => $validated['capacity_units'] ?? null,
                'capacity_unit_type' => $validated['capacity_unit_type'] ?? null,
                'facility_id' => $validated['facility_id'] ?? null,
                'current_stage_id' => $validated['current_stage_id'],
                'tenant_id' => $tenantId,
                'order' => $order, // Asignar el orden
            ]);

            Log::info('Cultivation Area created successfully.', ['area_id' => $cultivationArea->id, 'tenant_id' => $tenantId]);
            return response()->json($cultivationArea, 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed during cultivation area store', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during cultivation area store', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     * GET /api/cultivation-areas/{cultivationArea}
     */
    public function show(Request $request, CultivationArea $cultivationArea)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($cultivationArea->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: Cultivation Area does not belong to the current tenant.');
        }
        // Cargar relaciones para el frontend
        $cultivationArea->load(['batches', 'currentStage', 'facility']);
        return response()->json($cultivationArea);
    }

    /**
     * Update the specified resource in storage.
     * PUT /api/cultivation-areas/{cultivationArea}
     */
    public function update(Request $request, CultivationArea $cultivationArea)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($cultivationArea->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to update this Cultivation Area: Tenant mismatch.');
        }

        try {
            $validated = $request->validate([
                'name' => 'sometimes|required|string|max:255',
                'description' => 'nullable|string|max:1000',
                'capacity_units' => 'nullable|integer|min:0',
                'capacity_unit_type' => 'nullable|string|max:50',
                'facility_id' => [
                    'nullable',
                    'exists:facilities,id',
                    Rule::exists('facilities', 'id')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
                'current_stage_id' => [ // This is key for drag & drop
                    'sometimes',
                    'required',
                    'exists:stages,id',
                    Rule::exists('stages', 'id')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
                'order' => 'sometimes|required|integer|min:0', // 'order' puede cambiar
            ]);

            $cultivationArea->update($validated);

            Log::info('Cultivation Area updated successfully.', ['area_id' => $cultivationArea->id, 'tenant_id' => $tenantId]);
            return response()->json($cultivationArea);
        } catch (ValidationException $e) {
            Log::error('Validation failed during cultivation area update', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during cultivation area update', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     * DELETE /api/cultivation-areas/{cultivationArea}
     */
    public function destroy(Request $request, CultivationArea $cultivationArea)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($cultivationArea->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to delete this Cultivation Area: Tenant mismatch.');
        }

        // Antes de eliminar un área, verificar si tiene Batches asociados
        if ($cultivationArea->batches()->exists()) {
            return response()->json(['error' => 'Cannot delete cultivation area: It has associated batches.'], 409); // Conflict
        }

        try {
            $cultivationArea->delete();
            Log::info('Cultivation Area deleted successfully.', ['area_id' => $cultivationArea->id, 'tenant_id' => $tenantId]);
            return response()->noContent();
        } catch (\Throwable $e) {
            Log::error('Error deleting cultivation area', ['area_id' => $cultivationArea->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Failed to delete cultivation area.'], 500);
        }
    }

    /**
     * Reorder cultivation areas within a specific stage.
     * PUT /api/stages/{stage}/cultivation-areas/reorder
     */
    public function reorder(Request $request, Stage $stage)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing.'], 400);
        }
        if ($stage->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to reorder cultivation areas in this stage: Stage tenant mismatch.');
        }

        try {
            $validatedData = $request->validate([
                'area_ids' => 'nullable|array', // Permitir array vacío
                'area_ids.*' => [
                    'sometimes', // Solo validar si hay elementos
                    'exists:cultivation_areas,id',
                    Rule::exists('cultivation_areas', 'id')->where(function ($query) use ($stage, $tenantId) {
                        return $query->where('current_stage_id', $stage->id)
                                     ->where('tenant_id', $tenantId);
                    }),
                ],
            ]);

            DB::transaction(function () use ($validatedData, $stage, $tenantId) {
                if (!empty($validatedData['area_ids'])) {
                    foreach ($validatedData['area_ids'] as $index => $areaId) {
                        CultivationArea::where('id', $areaId)
                            ->where('current_stage_id', $stage->id) // Doble verificación por seguridad
                            ->where('tenant_id', $tenantId)
                            ->update(['order' => $index]);
                    }
                }
            });

            Log::info('Cultivation Areas reordered successfully within stage.', ['stage_id' => $stage->id, 'tenant_id' => $tenantId, 'reordered_count' => count($validatedData['area_ids'] ?? [])]);
            return response()->json(['message' => 'Cultivation Areas reordered successfully.'], 200);
        } catch (ValidationException $e) {
            Log::error('Validation failed during cultivation area reorder', ['errors' => $e->errors(), 'request_data' => $request->all()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during cultivation area reorder', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString(), 'request_data' => $request->all()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }
}
