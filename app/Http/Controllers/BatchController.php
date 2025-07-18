<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\CultivationArea;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
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

            // Cargar relaciones necesarias para el frontend (cultivationArea y su currentStage)
            $batches = $query->with('cultivationArea.currentStage')->get();
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
                'origin_type' => ['nullable', 'string', Rule::in(['seeds', 'clones', 'tissue_culture', 'external_purchase'])],
                'origin_details' => 'nullable|string',
            ]);

            $cultivationArea = CultivationArea::find($validated['cultivation_area_id']);

            $batch = Batch::create(array_merge($validated, [
                'tenant_id' => $tenantId,
                'facility_id' => $cultivationArea->facility_id,
            ]));

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
        $batch->load(['cultivationArea.currentStage']);
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
                'cultivation_area_id' => [
                    'sometimes',
                    'required',
                    'exists:cultivation_areas,id',
                    Rule::exists('cultivation_areas', 'id')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
                'origin_type' => ['sometimes', 'nullable', 'string', Rule::in(['seeds', 'clones', 'tissue_culture', 'external_purchase'])],
                'origin_details' => 'sometimes|nullable|string',
            ]);

            if (isset($validated['cultivation_area_id'])) {
                $newCultivationArea = CultivationArea::find($validated['cultivation_area_id']);
                if ($newCultivationArea) {
                    $validated['facility_id'] = $newCultivationArea->facility_id;
                }
            }

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
            // TODO: Implementar lógica para verificar eventos de trazabilidad
            // Si el lote tiene eventos asociados, no permitir la eliminación.
            // Ejemplo:
            // if ($batch->traceabilityEvents()->count() > 0) {
            //     return response()->json(['message' => 'No se puede eliminar el lote: Tiene eventos de trazabilidad asociados.'], 409);
            // }

            $batch->delete();
            Log::info('Batch deleted successfully.', ['batch_id' => $batch->id, 'tenant_id' => $tenantId]);
            return response()->noContent();
        } catch (\Throwable $e) {
            Log::error('Error deleting batch', ['batch_id' => $batch->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Failed to delete batch.'], 500);
        }
    }

    /**
     * Divide a batch into a new batch.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Batch  $batch The original batch to split.
     * @return \Illuminate\Http\JsonResponse
     */
    public function split(Request $request, Batch $batch)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing.'], 400);
        }
        if ($batch->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: Batch does not belong to the current tenant.');
        }

        try {
            $validatedData = $request->validate([
                'splitQuantity' => 'required|integer|min:1|max:' . ($batch->current_units - 1),
                'newBatchName' => 'required|string|max:255',
                'newCultivationAreaId' => [
                    'required',
                    'exists:cultivation_areas,id',
                    Rule::exists('cultivation_areas', 'id')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
            ]);

            $splitQuantity = $validatedData['splitQuantity'];
            $newBatchName = $validatedData['newBatchName'];
            $newCultivationAreaId = $validatedData['newCultivationAreaId'];

            $newCultivationArea = CultivationArea::find($newCultivationAreaId);

            DB::beginTransaction();

            $batch->current_units -= $splitQuantity;
            $batch->save();
            Log::info('Original batch units updated after split.', ['batch_id' => $batch->id, 'new_units' => $batch->current_units]);

            $newBatch = Batch::create([
                'name' => $newBatchName,
                'current_units' => $splitQuantity,
                'end_type' => $batch->end_type,
                'variety' => $batch->variety,
                'projected_yield' => null,
                'advance_to_harvesting_on' => null,
                'cultivation_area_id' => $newCultivationAreaId,
                'tenant_id' => $tenantId,
                'facility_id' => $newCultivationArea->facility_id,
                'parent_batch_id' => $batch->id,
                'origin_type' => $batch->origin_type,
                'origin_details' => $batch->origin_details,
            ]);
            Log::info('New batch created after split.', ['new_batch_id' => $newBatch->id, 'parent_batch_id' => $batch->id]);

            DB::commit();

            return response()->json([
                'message' => 'Lote dividido exitosamente',
                'original_batch' => $batch->load('cultivationArea.currentStage'),
                'new_batch' => $newBatch->load('cultivationArea.currentStage')
            ], 200);

        } catch (ValidationException $e) {
            DB::rollBack();
            Log::error('Validation failed during batch split', ['errors' => $e->errors(), 'batch_id' => $batch->id]);
            return response()->json([
                'error' => 'Validation failed.',
                'details' => $e->errors()
            ], 422);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Unexpected error during batch split', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString(), 'batch_id' => $batch->id]);
            return response()->json(['error' => 'An unexpected error occurred during batch split.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Process a batch, updating its current units (e.g., after drying/lyophilization).
     * POST /api/batches/{batch}/process
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Batch  $batch The batch to process.
     * @return \Illuminate\Http\JsonResponse
     */
    public function process(Request $request, Batch $batch)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing.'], 400);
        }
        if ($batch->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: Batch does not belong to the current tenant.');
        }

        try {
            $validatedData = $request->validate([
                'processedQuantity' => 'required|numeric|min:0|max:' . $batch->current_units, // Cantidad final después del procesamiento
                'processMethod' => 'required|string|max:255', // Ej. 'Lyophilization', 'Air Drying', 'Curing'
                'processDescription' => 'nullable|string', // Notas adicionales sobre el proceso
            ]);

            $processedQuantity = $validatedData['processedQuantity'];
            $processMethod = $validatedData['processMethod'];
            $processDescription = $validatedData['processDescription'];

            // Opcional: Podrías registrar un evento de trazabilidad aquí
            // (requeriría un modelo de TraceabilityEvent y una tabla asociada)
            /*
            TraceabilityEvent::create([
                'batch_id' => $batch->id,
                'event_type' => 'processing',
                'details' => "Processed from {$batch->current_units} to {$processedQuantity} units via {$processMethod}. Notes: {$processDescription}",
                'user_id' => auth()->id(), // Asumiendo autenticación
                'tenant_id' => $tenantId,
            ]);
            */

            $batch->current_units = $processedQuantity;
            $batch->save();

            Log::info('Batch processed successfully.', [
                'batch_id' => $batch->id,
                'old_units' => $batch->getOriginal('current_units'), // Obtener valor original antes de guardar
                'new_units' => $batch->current_units,
                'process_method' => $processMethod,
                'tenant_id' => $tenantId,
            ]);

            // Cargar relaciones para la respuesta del frontend
            $batch->load('cultivationArea.currentStage');

            return response()->json([
                'message' => 'Lote procesado exitosamente.',
                'batch' => $batch
            ], 200);

        } catch (ValidationException $e) {
            Log::error('Validation failed during batch processing', ['errors' => $e->errors(), 'batch_id' => $batch->id]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during batch processing', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString(), 'batch_id' => $batch->id]);
            return response()->json(['error' => 'An unexpected error occurred during batch processing.', 'details' => $e->getMessage()], 500);
        }
    }
}
