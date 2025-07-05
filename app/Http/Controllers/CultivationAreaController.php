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
        $user = auth()->user(); // Obtener el usuario autenticado

        // Determinar el tenant_id. Si es global admin, no aplicamos filtro de tenant_id.
        // Si no es global admin, usamos su tenant_id.
        // Si el frontend envía 'X-Tenant-ID: null' como string, lo convertimos a null PHP.
        $requestedTenantId = $request->header('X-Tenant-ID');
        if ($requestedTenantId === 'null') {
            $requestedTenantId = null;
        }

        Log::info('CultivationAreaController@index: Request received.', [
            'user_id' => $user->id,
            'is_global_admin' => $user->is_global_admin,
            'requested_tenant_id_header' => $requestedTenantId, // Valor del header después de la conversión
            'user_tenant_id' => $user->tenant_id, // Tenant ID del usuario autenticado
        ]);

        try {
            $query = CultivationArea::query();

            // Si el usuario NO es un administrador global, siempre debe filtrar por su tenant_id.
            if (!$user->is_global_admin) {
                if (empty($user->tenant_id)) {
                    // Esto no debería suceder si el usuario no es global admin y tiene un tenant_id NOT NULL
                    Log::error('CultivationAreaController@index: User is not global admin but has null tenant_id.', ['user_id' => $user->id]);
                    return response()->json(['error' => 'User tenant ID is missing.'], 400);
                }
                $query->where('tenant_id', $user->tenant_id);
                Log::info('CultivationAreaController@index: Filtering by user tenant_id.', ['tenant_id' => $user->tenant_id]);
            } else {
                // Si es global admin, no aplicamos el scope de tenant_id automáticamente.
                // El HasTenant trait ya debería manejar esto si el scope está deshabilitado para global admins.
                // Por ahora, asumimos que para global admin, se ven todas las áreas si no hay filtro de instalación/etapa.
                Log::info('CultivationAreaController@index: Global Admin detected. Bypassing tenant_id filter for main query.');
            }


            if ($facility) {
                // Para global admin, la instalación puede ser de cualquier tenant.
                // Para non-global admin, la instalación debe ser de su propio tenant (ya filtrado por el scope).
                if (!$user->is_global_admin && $facility->tenant_id !== $user->tenant_id) {
                    abort(403, 'Unauthorized access: Facility does not belong to the current tenant.');
                }
                $query->where('facility_id', $facility->id);
                Log::info('CultivationAreaController@index: Filtering by facility_id.', ['facility_id' => $facility->id]);
            }

            if ($stage) {
                // Similar a facility, para global admin, la etapa puede ser de cualquier tenant.
                // Para non-global admin, la etapa debe ser de su propio tenant.
                if (!$user->is_global_admin && $stage->tenant_id !== $user->tenant_id) {
                    abort(403, 'Unauthorized access: Stage does not belong to the current tenant.');
                }
                $query->where('current_stage_id', $stage->id);
                Log::info('CultivationAreaController@index: Filtering by stage_id.', ['stage_id' => $stage->id]);
            }

            // Cargar relaciones para el frontend (batches y currentStage)
            $cultivationAreas = $query->with(['batches', 'currentStage'])->orderBy('order')->get();

            Log::info('CultivationAreaController@index: Cultivation areas fetched successfully.', ['count' => $cultivationAreas->count()]);
            return response()->json($cultivationAreas);
        } catch (\Throwable $e) {
            Log::error('CultivationAreaController@index: Error fetching cultivation areas', [
                'error_message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $user->id,
                'is_global_admin' => $user->is_global_admin,
                'facility_param' => $facility ? $facility->id : 'N/A',
                'stage_param' => $stage ? $stage->id : 'N/A',
                'requested_tenant_id_header' => $requestedTenantId,
            ]);
            return response()->json(['error' => 'Failed to fetch cultivation areas.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     * POST /api/cultivation-areas
     */
    public function store(Request $request)
    {
        $user = auth()->user();

        // Validar los datos de la solicitud
        $rules = [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'capacity_units' => 'nullable|integer|min:0',
            'capacity_unit_type' => 'nullable|string|max:50',
            // facility_id y current_stage_id deben pertenecer al tenant del usuario
            'facility_id' => [
                'nullable',
                'exists:facilities,id',
                // La validación de existencia de facility_id debe considerar el tenant
                Rule::exists('facilities', 'id')->where(function ($query) use ($user) {
                    if (!$user->is_global_admin) {
                        $query->where('tenant_id', $user->tenant_id);
                    }
                    // Si es global admin, no filtramos por tenant_id aquí,
                    // ya que puede asignar a cualquier tenant.
                }),
            ],
            'current_stage_id' => [
                'required',
                'exists:stages,id',
                // La validación de existencia de current_stage_id debe considerar el tenant
                Rule::exists('stages', 'id')->where(function ($query) use ($user) {
                    if (!$user->is_global_admin) {
                        $query->where('tenant_id', $user->tenant_id);
                    }
                    // Si es global admin, no filtramos por tenant_id aquí,
                    // ya que puede asignar a cualquier tenant.
                }),
            ],
            'order' => 'nullable|integer|min:0',
        ];

        // Si es Super Admin, el tenant_id es obligatorio en el payload para crear un área
        if ($user->is_global_admin) {
            // CAMBIO CLAVE: Eliminar 'string' de la validación de tenant_id
            $rules['tenant_id'] = ['required', Rule::exists('tenants', 'id')];
        }

        try {
            $validated = $request->validate($rules);

            // Determinar el tenant_id para el área de cultivo
            $areaTenantId = null;
            if ($user->is_global_admin) {
                // Para Super Admin, el tenant_id viene del payload
                $areaTenantId = $validated['tenant_id'];
            } else {
                // Para usuarios de tenant, el tenant_id es el suyo propio
                $areaTenantId = $user->tenant_id;
            }

            if (empty($areaTenantId)) {
                 Log::error('CultivationAreaController@store: Tenant ID is null or empty when trying to create area.', [
                    'user_id' => $user->id,
                    'is_global_admin' => $user->is_global_admin,
                    'validated_data' => $validated,
                    'user_tenant_id' => $user->tenant_id,
                ]);
                return response()->json(['error' => 'Tenant ID is missing or invalid for Cultivation Area creation.'], 400);
            }

            // Determinar el siguiente orden si no se proporciona
            $maxOrder = CultivationArea::where('current_stage_id', $validated['current_stage_id'])
                                        ->where('tenant_id', $areaTenantId) // Filtrar por el tenant_id correcto
                                        ->max('order');
            $order = $validated['order'] ?? ($maxOrder !== null ? $maxOrder + 1 : 0);

            $cultivationArea = CultivationArea::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'capacity_units' => $validated['capacity_units'] ?? null,
                'capacity_unit_type' => $validated['capacity_unit_type'] ?? null,
                'facility_id' => $validated['facility_id'] ?? null,
                'current_stage_id' => $validated['current_stage_id'],
                'tenant_id' => $areaTenantId, // Usar el tenant_id determinado
                'order' => $order,
            ]);

            Log::info('Cultivation Area created successfully.', ['area_id' => $cultivationArea->id, 'tenant_id' => $areaTenantId]);
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
        $user = auth()->user();
        if (!$user->is_global_admin && $cultivationArea->tenant_id != $user->tenant_id) {
            abort(403, 'Unauthorized access: Cultivation Area does not belong to your tenant.');
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
        $user = auth()->user();
        if (!$user->is_global_admin && $cultivationArea->tenant_id != $user->tenant_id) {
            abort(403, 'Unauthorized to update this Cultivation Area: Tenant mismatch.');
        }

        try {
            $rules = [
                'name' => 'sometimes|required|string|max:255',
                'description' => 'nullable|string|max:1000',
                'capacity_units' => 'nullable|integer|min:0',
                'capacity_unit_type' => 'nullable|string|max:50',
                'facility_id' => [
                    'nullable',
                    'exists:facilities,id',
                    Rule::exists('facilities', 'id')->where(function ($query) use ($user) {
                        if (!$user->is_global_admin) {
                            $query->where('tenant_id', $user->tenant_id);
                        }
                    }),
                ],
                'current_stage_id' => [
                    'sometimes',
                    'required',
                    'exists:stages,id',
                    Rule::exists('stages', 'id')->where(function ($query) use ($user) {
                        if (!$user->is_global_admin) {
                            $query->where('tenant_id', $user->tenant_id);
                        }
                    }),
                ],
                'order' => 'sometimes|required|integer|min:0',
            ];

            // Si es Super Admin, el tenant_id puede ser actualizado si se envía
            if ($user->is_global_admin) {
                // CAMBIO CLAVE: Eliminar 'string' de la validación de tenant_id
                $rules['tenant_id'] = ['nullable', Rule::exists('tenants', 'id')];
            }

            $validated = $request->validate($rules);

            // Si es Super Admin y se envía un nuevo tenant_id, actualizarlo
            if ($user->is_global_admin && isset($validated['tenant_id'])) {
                $cultivationArea->tenant_id = $validated['tenant_id'];
            }

            $cultivationArea->update($validated);

            Log::info('Cultivation Area updated successfully.', ['area_id' => $cultivationArea->id, 'tenant_id' => $cultivationArea->tenant_id]);
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
        $user = auth()->user();
        if (!$user->is_global_admin && $cultivationArea->tenant_id != $user->tenant_id) {
            abort(403, 'Unauthorized to delete this Cultivation Area: Tenant mismatch.');
        }

        if ($cultivationArea->batches()->exists()) {
            return response()->json(['error' => 'Cannot delete cultivation area: It has associated batches.'], 409);
        }

        try {
            $cultivationArea->delete();
            Log::info('Cultivation Area deleted successfully.', ['area_id' => $cultivationArea->id, 'tenant_id' => $cultivationArea->tenant_id]);
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
        $user = auth()->user();

        if (!$user->is_global_admin && $stage->tenant_id != $user->tenant_id) {
            abort(403, 'Unauthorized to reorder cultivation areas in this stage: Stage tenant mismatch.');
        }

        try {
            $validatedData = $request->validate([
                'area_ids' => 'nullable|array',
                'area_ids.*' => [
                    'sometimes',
                    'exists:cultivation_areas,id',
                    Rule::exists('cultivation_areas', 'id')->where(function ($query) use ($stage, $user) {
                        $query->where('current_stage_id', $stage->id);
                        if (!$user->is_global_admin) {
                            $query->where('tenant_id', $user->tenant_id);
                        }
                    }),
                ],
            ]);

            DB::transaction(function () use ($validatedData, $stage, $user) {
                if (!empty($validatedData['area_ids'])) {
                    foreach ($validatedData['area_ids'] as $index => $areaId) {
                        $query = CultivationArea::where('id', $areaId)
                            ->where('current_stage_id', $stage->id);

                        if (!$user->is_global_admin) {
                            $query->where('tenant_id', $user->tenant_id);
                        }
                        $query->update(['order' => $index]);
                    }
                }
            });

            Log::info('Cultivation Areas reordered successfully within stage.', ['stage_id' => $stage->id, 'user_id' => $user->id]);
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
