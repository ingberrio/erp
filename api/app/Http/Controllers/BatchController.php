<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\CultivationArea;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use App\Models\TraceabilityEvent; // Import the TraceabilityEvent model

class BatchController extends Controller
{
    /**
     * Display a listing of the resource.
     * GET /api/batches
     * GET /api/cultivation-areas/{cultivationArea}/batches (filtered by area)
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

            // Load necessary relations for the frontend (cultivationArea and its currentStage)
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
                'product_type' => 'required|string|max:255',
                'projected_yield' => 'nullable|numeric|min:0',
                'cultivation_area_id' => [
                    'required',
                    'exists:cultivation_areas,id',
                    Rule::exists('cultivation_areas', 'id')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
                'sub_location' => 'nullable|string|max:255', // AÑADIDO: Validación para sub_location
                'origin_type' => ['nullable', 'string', Rule::in(['seeds', 'clones', 'tissue_culture', 'external_purchase', 'internal'])],
                'origin_details' => 'nullable|string',
                'is_packaged' => 'boolean', // Asegúrate de validar si lo envías desde el frontend
                'units' => 'required|string|max:50', // Asegúrate de validar si lo envías desde el frontend
            ]);

            $cultivationArea = CultivationArea::find($validated['cultivation_area_id']);

            // Validar que las unidades no excedan la capacidad del área
            if ($cultivationArea->capacity_units) {
                $currentTotalUnits = Batch::where('cultivation_area_id', $validated['cultivation_area_id'])
                    ->sum('current_units');
                $newTotalUnits = $currentTotalUnits + $validated['current_units'];
                
                if ($newTotalUnits > $cultivationArea->capacity_units) {
                    $availableUnits = $cultivationArea->capacity_units - $currentTotalUnits;
                    return response()->json([
                        'error' => 'Validation failed.',
                        'message' => "Capacity exceeded. Area '{$cultivationArea->name}' has capacity of {$cultivationArea->capacity_units} units. Current usage: {$currentTotalUnits} units. Available: {$availableUnits} units. You requested: {$validated['current_units']} units.",
                        'details' => [
                            'capacity' => $cultivationArea->capacity_units,
                            'current_usage' => $currentTotalUnits,
                            'available' => $availableUnits,
                            'requested' => $validated['current_units']
                        ]
                    ], 422);
                }
            }

            $batch = Batch::create(array_merge($validated, [
                'tenant_id' => $tenantId,
                'facility_id' => $cultivationArea->facility_id,
                'is_packaged' => $validated['is_packaged'] ?? false, // Default a false si no se envía
                'units' => $validated['units'] ?? 'g', // Default a 'g' si no se envía
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
                'product_type' => 'sometimes|required|string|max:255',
                'projected_yield' => 'nullable|numeric|min:0',
                'cultivation_area_id' => [
                    'sometimes',
                    'required',
                    'exists:cultivation_areas,id',
                    Rule::exists('cultivation_areas', 'id')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
                'sub_location' => 'nullable|string|max:255', // AÑADIDO: Validación para sub_location
                'origin_type' => ['sometimes', 'nullable', 'string', Rule::in(['seeds', 'clones', 'tissue_culture', 'external_purchase', 'internal'])],
                'origin_details' => 'sometimes|nullable|string',
                'is_packaged' => 'sometimes|boolean', // Asegúrate de validar si lo envías desde el frontend
                'units' => 'sometimes|required|string|max:50', // Asegúrate de validar si lo envías desde el frontend
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
            // Check if batch has associated traceability events
            $eventsCount = $batch->traceabilityEvents()->count();
            if ($eventsCount > 0) {
                return response()->json([
                    'error' => 'Cannot delete batch.',
                    'message' => "This batch has {$eventsCount} associated traceability event(s). Please delete the events first or archive the batch instead."
                ], 409);
            }
            
            // Check if batch has child batches (from splits)
            $childCount = $batch->childBatches()->count();
            if ($childCount > 0) {
                return response()->json([
                    'error' => 'Cannot delete batch.',
                    'message' => "This batch has {$childCount} child batch(es) from splits. Please delete the child batches first."
                ], 409);
            }
            
            // Check if batch has loss/theft reports
            $lossTheftCount = $batch->lossTheftReports()->count();
            if ($lossTheftCount > 0) {
                return response()->json([
                    'error' => 'Cannot delete batch.',
                    'message' => "This batch has {$lossTheftCount} loss/theft report(s). Please delete the reports first or archive the batch instead."
                ], 409);
            }

            $batch->delete();
            Log::info('Batch deleted successfully.', ['batch_id' => $batch->id, 'tenant_id' => $tenantId]);
            return response()->noContent();
        } catch (\Throwable $e) {
            Log::error('Error deleting batch', ['batch_id' => $batch->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Failed to delete batch.', 'message' => $e->getMessage()], 500);
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
                'newBatchProductType' => 'required|string|max:255',
                'newSubLocation' => 'nullable|string|max:255', // AÑADIDO: Sub-ubicación para el nuevo lote
            ]);

            $splitQuantity = $validatedData['splitQuantity'];
            $newBatchName = $validatedData['newBatchName'];
            $newCultivationAreaId = $validatedData['newCultivationAreaId'];
            $newBatchProductType = $validatedData['newBatchProductType'];
            $newSubLocation = $validatedData['newSubLocation'] ?? null; // Obtener la nueva sub-ubicación

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
                'product_type' => $newBatchProductType,
                'projected_yield' => null,
                'advance_to_harvesting_on' => null,
                'cultivation_area_id' => $newCultivationAreaId,
                'sub_location' => $newSubLocation, // AÑADIDO: Asignar sub_location al nuevo lote
                'tenant_id' => $tenantId,
                'facility_id' => $newCultivationArea->facility_id,
                'parent_batch_id' => $batch->id,
                'origin_type' => $batch->origin_type,
                'origin_details' => $batch->origin_details,
                'is_packaged' => $batch->is_packaged, // Heredar de la original
                'units' => $batch->units, // Heredar de la original
            ]);
            Log::info('New batch created after split.', ['new_batch_id' => $newBatch->id, 'parent_batch_id' => $batch->id]);

            // --- Crear Traceability Event para Split ---
            TraceabilityEvent::create([
                'batch_id' => $batch->id, // Original batch is affected
                'event_type' => 'split',
                'description' => "Batch '{$batch->name}' split. {$splitQuantity} units moved to new batch '{$newBatch->name}' (Product Type: {$newBatchProductType}).",
                'area_id' => $batch->cultivation_area_id, // Event occurs in original batch's area
                'facility_id' => $batch->facility_id,
                'user_id' => auth()->id(), // Assuming authenticated user
                'quantity' => $splitQuantity,
                'unit' => $batch->units, // Usar la unidad del lote original
                'from_location' => $batch->cultivationArea->name,
                'from_sub_location' => $batch->sub_location, // AÑADIDO: Sub-ubicación de origen
                'to_location' => $newCultivationArea->name,
                'to_sub_location' => $newSubLocation, // AÑADIDO: Sub-ubicación de destino
                'new_batch_id' => $newBatch->id, // Link to the new batch created by the split
                'tenant_id' => $tenantId,
            ]);
            // --- END NEW ---

            DB::commit();

            return response()->json([
                'message' => 'Batch split successfully',
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
                'processedQuantity' => 'required|numeric|min:0|max:' . $batch->current_units, // Final quantity after processing
                'processMethod' => 'required|string|max:255', // E.g., 'Lyophilization', 'Air Drying', 'Curing'
                'processDescription' => 'nullable|string', // Additional notes about the process
                'newProductType' => 'required|string|max:255',
                'facility_id' => [
                    'required',
                    'exists:facilities,id',
                    Rule::exists('facilities', 'id')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
                'newSubLocation' => 'nullable|string|max:255', // AÑADIDO: Sub-ubicación para el lote procesado
            ]);

            $processedQuantity = $validatedData['processedQuantity'];
            $processMethod = $validatedData['processMethod'];
            $processDescription = $validatedData['processDescription'];
            $newProductType = $validatedData['newProductType'];
            $eventFacilityId = $validatedData['facility_id'];
            $newSubLocation = $validatedData['newSubLocation'] ?? null; // Obtener la nueva sub-ubicación

            Log::info('Debug: facility_id for traceability event creation', ['facility_id' => $eventFacilityId]);

            DB::beginTransaction();

            // Calculate loss
            $initialQuantity = $batch->current_units;
            $loss = $initialQuantity - $processedQuantity;

            // Update the original batch's units, product type, and sub_location
            $batch->current_units = $processedQuantity;
            $batch->product_type = $newProductType;
            $batch->sub_location = $newSubLocation; // AÑADIDO: Actualizar sub_location del lote
            $batch->save();

            Log::info('Batch processed successfully.', [
                'batch_id' => $batch->id,
                'old_units' => $initialQuantity,
                'new_units' => $batch->current_units,
                'process_method' => $processMethod,
                'tenant_id' => $tenantId,
                'old_product_type' => $batch->getOriginal('product_type'),
                'new_product_type' => $newProductType,
                'facility_id_for_event' => $eventFacilityId,
                'new_sub_location' => $newSubLocation, // Log la nueva sub-ubicación
            ]);

            // --- Crear Traceability Event para Processing ---
            TraceabilityEvent::create([
                'batch_id' => $batch->id,
                'event_type' => 'processing',
                'description' => "Batch '{$batch->name}' processed from {$initialQuantity} to {$processedQuantity} units via {$processMethod}. Product type changed from '{$batch->getOriginal('product_type')}' to '{$newProductType}'. Notes: {$processDescription}",
                'area_id' => $batch->cultivation_area_id,
                'facility_id' => $eventFacilityId,
                'user_id' => auth()->id(),
                'quantity' => $initialQuantity, // Cantidad original procesada
                'unit' => $batch->units, // Usar la unidad del lote
                'method' => $processMethod,
                'reason' => $processDescription,
                'tenant_id' => $tenantId,
                'from_location' => $batch->cultivationArea->name,
                'from_sub_location' => $batch->getOriginal('sub_location'), // Sub-ubicación original
                'to_location' => $batch->cultivationArea->name, // Asumiendo que se procesa en la misma área
                'to_sub_location' => $newSubLocation, // Nueva sub-ubicación después del proceso
            ]);

            // If there was a loss, record a separate destruction/adjustment event for the loss
            if ($loss > 0) {
                TraceabilityEvent::create([
                    'batch_id' => $batch->id,
                    'event_type' => 'adjustment_loss',
                    'description' => "Adjustment for processing loss: {$loss} units. Method: {$processMethod}. From product type '{$batch->getOriginal('product_type')}'.",
                    'area_id' => $batch->cultivation_area_id,
                    'facility_id' => $eventFacilityId,
                    'user_id' => auth()->id(),
                    'quantity' => $loss,
                    'unit' => $batch->units,
                    'method' => $processMethod,
                    'reason' => 'Processing loss',
                    'tenant_id' => $tenantId,
                    'from_location' => $batch->cultivationArea->name,
                    'from_sub_location' => $newSubLocation, // La pérdida ocurre desde la nueva sub-ubicación
                    'to_location' => 'N/A', // No se mueve a una ubicación
                    'to_sub_location' => 'N/A',
                ]);
            }
            // --- END NEW ---

            DB::commit();

            // Load relations for frontend response
            $batch->load('cultivationArea.currentStage');

            return response()->json([
                'message' => 'Batch processed successfully.',
                'batch' => $batch
            ], 200);

        } catch (ValidationException $e) {
            DB::rollBack();
            Log::error('Validation failed during batch processing', ['errors' => $e->errors(), 'batch_id' => $batch->id]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Unexpected error during batch processing', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString(), 'batch_id' => $batch->id]);
            return response()->json(['error' => 'An unexpected error occurred during batch processing.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Archive a batch (soft delete for Health Canada compliance).
     * This preserves all traceability data while removing the batch from active view.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Batch  $batch
     * @return \Illuminate\Http\JsonResponse
     */
    public function archive(Request $request, Batch $batch)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($batch->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to archive this Batch: Tenant mismatch.');
        }

        try {
            $validated = $request->validate([
                'reason' => 'required|string|max:1000',
            ]);

            if ($batch->is_archived) {
                return response()->json([
                    'error' => 'Batch is already archived.',
                    'message' => 'This batch has already been archived on ' . $batch->archived_at->format('Y-m-d H:i:s'),
                ], 409);
            }

            $batch->update([
                'is_archived' => true,
                'archived_at' => now(),
                'archive_reason' => $validated['reason'],
            ]);

            // Create traceability event for the archive action
            TraceabilityEvent::create([
                'batch_id' => $batch->id,
                'event_type' => 'archive',
                'description' => "Batch archived. Reason: {$validated['reason']}",
                'area_id' => $batch->cultivation_area_id,
                'facility_id' => $batch->facility_id,
                'user_id' => auth()->id(),
                'quantity' => $batch->current_units,
                'unit' => $batch->units,
                'tenant_id' => $tenantId,
                'from_location' => $batch->cultivationArea->name ?? 'Unknown',
            ]);

            Log::info('Batch archived successfully.', [
                'batch_id' => $batch->id,
                'tenant_id' => $tenantId,
                'reason' => $validated['reason'],
                'archived_by' => auth()->id(),
            ]);

            return response()->json([
                'message' => 'Batch archived successfully. All traceability data has been preserved.',
                'batch' => $batch->load('cultivationArea.currentStage'),
            ]);
        } catch (ValidationException $e) {
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Error archiving batch', ['batch_id' => $batch->id, 'error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to archive batch.', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Restore an archived batch.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Batch  $batch
     * @return \Illuminate\Http\JsonResponse
     */
    public function restore(Request $request, Batch $batch)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($batch->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to restore this Batch: Tenant mismatch.');
        }

        try {
            if (!$batch->is_archived) {
                return response()->json([
                    'error' => 'Batch is not archived.',
                    'message' => 'This batch is not archived and cannot be restored.',
                ], 409);
            }

            $previousReason = $batch->archive_reason;

            $batch->update([
                'is_archived' => false,
                'archived_at' => null,
                'archive_reason' => null,
            ]);

            // Create traceability event for the restore action
            TraceabilityEvent::create([
                'batch_id' => $batch->id,
                'event_type' => 'restore',
                'description' => "Batch restored from archive. Previous archive reason: {$previousReason}",
                'area_id' => $batch->cultivation_area_id,
                'facility_id' => $batch->facility_id,
                'user_id' => auth()->id(),
                'quantity' => $batch->current_units,
                'unit' => $batch->units,
                'tenant_id' => $tenantId,
                'to_location' => $batch->cultivationArea->name ?? 'Unknown',
            ]);

            Log::info('Batch restored successfully.', [
                'batch_id' => $batch->id,
                'tenant_id' => $tenantId,
                'restored_by' => auth()->id(),
            ]);

            return response()->json([
                'message' => 'Batch restored successfully.',
                'batch' => $batch->load('cultivationArea.currentStage'),
            ]);
        } catch (\Throwable $e) {
            Log::error('Error restoring batch', ['batch_id' => $batch->id, 'error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to restore batch.', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Mark a batch as recalled (Health Canada compliance).
     * Recalled batches should not be included in orders or shipped to customers.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Batch  $batch
     * @return \Illuminate\Http\JsonResponse
     */
    public function recall(Request $request, Batch $batch)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($batch->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to recall this Batch: Tenant mismatch.');
        }

        try {
            $validated = $request->validate([
                'reason' => 'required|string|max:2000',
            ]);

            if ($batch->is_recalled) {
                return response()->json([
                    'error' => 'Batch is already recalled.',
                    'message' => 'This batch has already been marked as recalled on ' . $batch->recalled_at->format('Y-m-d H:i:s'),
                ], 409);
            }

            $batch->update([
                'is_recalled' => true,
                'recalled_at' => now(),
                'recall_reason' => $validated['reason'],
                'recalled_by_user_id' => auth()->id(),
            ]);

            // Create traceability event for the recall action
            TraceabilityEvent::create([
                'batch_id' => $batch->id,
                'event_type' => 'recall',
                'description' => "⚠️ BATCH RECALLED: {$validated['reason']}",
                'area_id' => $batch->cultivation_area_id,
                'facility_id' => $batch->facility_id,
                'user_id' => auth()->id(),
                'quantity' => $batch->current_units,
                'unit' => $batch->units,
                'tenant_id' => $tenantId,
                'from_location' => $batch->cultivationArea->name ?? 'Unknown',
            ]);

            Log::warning('Batch RECALLED.', [
                'batch_id' => $batch->id,
                'batch_name' => $batch->name,
                'tenant_id' => $tenantId,
                'reason' => $validated['reason'],
                'recalled_by' => auth()->id(),
            ]);

            return response()->json([
                'message' => 'Batch recalled successfully. This batch will not be available for orders.',
                'batch' => $batch->load('cultivationArea.currentStage', 'recalledBy'),
            ]);
        } catch (ValidationException $e) {
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Error recalling batch', ['batch_id' => $batch->id, 'error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to recall batch.', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove recall flag from a batch.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Batch  $batch
     * @return \Illuminate\Http\JsonResponse
     */
    public function removeRecall(Request $request, Batch $batch)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($batch->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to remove recall from this Batch: Tenant mismatch.');
        }

        try {
            if (!$batch->is_recalled) {
                return response()->json([
                    'error' => 'Batch is not recalled.',
                    'message' => 'This batch does not have a recall flag.',
                ], 409);
            }

            $previousReason = $batch->recall_reason;

            $batch->update([
                'is_recalled' => false,
                'recalled_at' => null,
                'recall_reason' => null,
                'recalled_by_user_id' => null,
            ]);

            // Create traceability event for the recall removal
            TraceabilityEvent::create([
                'batch_id' => $batch->id,
                'event_type' => 'recall_removed',
                'description' => "Recall flag removed. Previous recall reason: {$previousReason}",
                'area_id' => $batch->cultivation_area_id,
                'facility_id' => $batch->facility_id,
                'user_id' => auth()->id(),
                'quantity' => $batch->current_units,
                'unit' => $batch->units,
                'tenant_id' => $tenantId,
                'to_location' => $batch->cultivationArea->name ?? 'Unknown',
            ]);

            Log::info('Batch recall removed.', [
                'batch_id' => $batch->id,
                'batch_name' => $batch->name,
                'tenant_id' => $tenantId,
                'removed_by' => auth()->id(),
            ]);

            return response()->json([
                'message' => 'Recall flag removed successfully. Batch is now available for orders.',
                'batch' => $batch->load('cultivationArea.currentStage'),
            ]);
        } catch (\Throwable $e) {
            Log::error('Error removing recall from batch', ['batch_id' => $batch->id, 'error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to remove recall flag.', 'message' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Get available batch statuses
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function getStatuses()
    {
        return response()->json([
            'statuses' => Batch::STATUSES,
            'colors' => Batch::STATUS_COLORS,
        ]);
    }
    
    /**
     * Change the status of a batch
     * Health Canada compliant status tracking with full audit trail
     * 
     * @param Request $request
     * @param Batch $batch
     * @return \Illuminate\Http\JsonResponse
     */
    public function changeStatus(Request $request, Batch $batch)
    {
        $validated = $request->validate([
            'status' => 'required|string|in:' . implode(',', array_keys(Batch::STATUSES)),
            'reason' => 'required|string|min:10|max:1000',
        ]);
        
        $tenantId = $batch->tenant_id ?? ($request->user()->tenant_id ?? 1);
        $previousStatus = $batch->status;
        $newStatus = $validated['status'];
        
        // Check if status change is allowed
        if (!$batch->canChangeStatusTo($newStatus)) {
            return response()->json([
                'error' => 'Status change not allowed',
                'message' => "Cannot change status from '{$previousStatus}' to '{$newStatus}'. Batches with status 'destroyed' or 'sold' cannot be modified.",
            ], 422);
        }
        
        try {
            // Update the batch status
            $batch->update([
                'status' => $newStatus,
                'status_changed_at' => now(),
                'status_change_reason' => $validated['reason'],
                'status_changed_by_user_id' => auth()->id(),
            ]);
            
            // Sync with is_archived flag if status is 'archived'
            if ($newStatus === 'archived' && !$batch->is_archived) {
                $batch->update([
                    'is_archived' => true,
                    'archived_at' => now(),
                    'archive_reason' => $validated['reason'],
                ]);
            } elseif ($previousStatus === 'archived' && $newStatus !== 'archived') {
                $batch->update([
                    'is_archived' => false,
                    'archived_at' => null,
                    'archive_reason' => null,
                ]);
            }
            
            // Sync with is_recalled flag if status is 'quarantine'
            if ($newStatus === 'quarantine' && !$batch->is_recalled) {
                $batch->update([
                    'is_recalled' => true,
                    'recalled_at' => now(),
                    'recall_reason' => $validated['reason'],
                    'recalled_by_user_id' => auth()->id(),
                ]);
            } elseif ($previousStatus === 'quarantine' && $newStatus !== 'quarantine' && $batch->is_recalled) {
                $batch->update([
                    'is_recalled' => false,
                    'recalled_at' => null,
                    'recall_reason' => null,
                    'recalled_by_user_id' => null,
                ]);
            }
            
            // Determine event type and emoji based on status
            $statusEmojis = [
                'active' => '✅',
                'on_hold' => '⏸️',
                'quarantine' => '⚠️',
                'released' => '🚀',
                'in_transit' => '🚚',
                'destroyed' => '🗑️',
                'sold' => '💰',
                'archived' => '📦',
            ];
            
            $emoji = $statusEmojis[$newStatus] ?? '📋';
            $statusLabel = Batch::STATUSES[$newStatus] ?? ucfirst($newStatus);
            $previousLabel = Batch::STATUSES[$previousStatus] ?? ucfirst($previousStatus);
            
            // Create traceability event for the status change
            TraceabilityEvent::create([
                'batch_id' => $batch->id,
                'event_type' => 'status_change',
                'description' => "{$emoji} STATUS CHANGED: {$previousLabel} → {$statusLabel}. Reason: {$validated['reason']}",
                'area_id' => $batch->cultivation_area_id,
                'facility_id' => $batch->facility_id,
                'user_id' => auth()->id(),
                'quantity' => $batch->current_units,
                'unit' => $batch->units,
                'tenant_id' => $tenantId,
                'to_location' => $batch->cultivationArea->name ?? 'Unknown',
            ]);

            Log::info('Batch status changed.', [
                'batch_id' => $batch->id,
                'batch_name' => $batch->name,
                'previous_status' => $previousStatus,
                'new_status' => $newStatus,
                'reason' => $validated['reason'],
                'tenant_id' => $tenantId,
                'changed_by' => auth()->id(),
            ]);

            return response()->json([
                'message' => "Batch status changed from '{$previousLabel}' to '{$statusLabel}' successfully.",
                'batch' => $batch->fresh()->load('cultivationArea.currentStage'),
            ]);
        } catch (\Throwable $e) {
            Log::error('Error changing batch status', ['batch_id' => $batch->id, 'error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to change batch status.', 'message' => $e->getMessage()], 500);
        }
    }
}
