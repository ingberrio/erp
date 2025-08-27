<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use App\Scopes\TenantScope; // Importar el TenantScope (aunque no se usa directamente aquí, es buena práctica)
use Illuminate\Support\Facades\Schema; // Para Schema::hasColumn en TenantScope si aplica

class FacilityController extends Controller
{
    /**
     * Display a listing of the resource.
     * GET /api/facilities
     */
    public function index(Request $request)
    {
        // Obtener el usuario autenticado usando el guard 'sanctum'
        $user = Auth::guard('sanctum')->user();
        Log::info('FacilityController@index: Request received.', [
            'user_id' => $user->id ?? 'guest',
            'is_global_admin' => $user->is_global_admin ?? false,
            'tenant_id_from_user' => $user->tenant_id ?? 'N/A'
        ]);

        try {
            // Si el usuario es un administrador global, devolver TODAS las instalaciones.
            // El TenantScope en el modelo Facility debería manejar el bypass para is_global_admin
            // si TenantContext::getTenantId() devuelve null para global admins.
            if ($user && $user->is_global_admin) {
                Log::info('FacilityController@index: Global Admin detected. Fetching all facilities.');
                $facilities = Facility::all(); // Esto debería funcionar si el TenantScope está bien configurado
                return response()->json($facilities);
            }

            // Para usuarios no globales (administradores de tenant o usuarios normales),
            // se requiere el X-Tenant-ID header.
            $tenantId = $request->header('X-Tenant-ID');
            if (!$tenantId) {
                Log::warning('FacilityController@index: Tenant ID is missing for non-global admin.', ['user_id' => $user->id ?? 'N/A']);
                return response()->json(['error' => 'Tenant ID is missing.'], 400);
            }

            // Asegurarse de que el tenant_id del usuario autenticado coincide con el del header (seguridad adicional)
            // Esto es crucial para prevenir que un usuario de un tenant acceda a datos de otro tenant
            if ($user && $user->tenant_id && $user->tenant_id != $tenantId) {
                Log::warning('FacilityController@index: Tenant ID mismatch between user and header.', [
                    'user_id' => $user->id,
                    'user_tenant_id' => $user->tenant_id,
                    'header_tenant_id' => $tenantId
                ]);
                return response()->json(['error' => 'Unauthorized: Tenant ID mismatch.'], 403);
            }

            Log::info('FacilityController@index: Fetching facilities for tenant.', ['tenant_id' => $tenantId]);
            // Si el TenantScope está activo, ya filtrará por el tenant_id establecido en el contexto.
            // Si no, se filtra manualmente aquí.
            $facilities = Facility::where('tenant_id', $tenantId)->get();
            return response()->json($facilities);

        } catch (\Throwable $e) {
            Log::critical('Error fetching facilities in FacilityController@index', [
                'user_id' => $user->id ?? 'N/A',
                'is_global_admin' => $user->is_global_admin ?? false,
                'tenant_id_from_header' => $request->header('X-Tenant-ID') ?? 'N/A',
                'error_message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to fetch facilities due to an unexpected error.'], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     * POST /api/facilities
     */
    public function store(Request $request)
    {
        $user = Auth::guard('sanctum')->user();
        $tenantId = $request->header('X-Tenant-ID');

        // Permitir a Super Admin crear instalaciones sin tenant_id en el header,
        // pero se les asignará un tenant_id si lo envían en el body o se les pedirá.
        if ($user && $user->is_global_admin) {
            // Super Admin puede especificar el tenant_id en el body
            $tenantId = $request->input('tenant_id', $tenantId); // Prioriza el input del body
            if (!$tenantId) {
                return response()->json(['error' => 'Tenant ID is required for global admin to create a facility.'], 400);
            }
        } elseif (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing.'], 400);
        }
        
        // Si el usuario no es global admin, su tenant_id debe coincidir con el header
        if ($user && !$user->is_global_admin && $user->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: Tenant ID mismatch.');
        }

        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'address' => 'nullable|string|max:1000',
                'tenant_id' => 'required|exists:tenants,id', // Ahora tenant_id es requerido y validado
                'licence_number' => 'nullable|string|max:255', // AÑADIDO: Validación para licence_number
            ]);

            $facility = Facility::create([
                'name' => $validated['name'],
                'address' => $validated['address'] ?? null,
                'tenant_id' => $validated['tenant_id'],
                'licence_number' => $validated['licence_number'] ?? null, // AÑADIDO: Asignación de licence_number
            ]);

            Log::info('Facility created successfully.', ['facility_id' => $facility->id, 'tenant_id' => $validated['tenant_id']]);
            return response()->json($facility, 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed during facility store', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::critical('Unexpected error during facility store', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     * GET /api/facilities/{facility}
     */
    public function show(Request $request, Facility $facility)
    {
        $user = Auth::guard('sanctum')->user();
        if ($user && $user->is_global_admin) {
            // Super Admin puede ver cualquier instalación
            return response()->json($facility);
        }
        
        // Para otros usuarios, verificar pertenencia al tenant
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId || $facility->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: Facility does not belong to the current tenant or Tenant ID is missing.');
        }
        return response()->json($facility);
    }

    /**
     * Update the specified resource in storage.
     * PUT /api/facilities/{facility}
     */
    public function update(Request $request, Facility $facility)
    {
        $user = Auth::guard('sanctum')->user();
        if ($user && $user->is_global_admin) {
            // Super Admin puede actualizar cualquier instalación
            // Permitir que el Super Admin cambie el tenant_id si lo envía
            $validated = $request->validate([
                'name' => 'sometimes|required|string|max:255',
                'address' => 'nullable|string|max:1000',
                'tenant_id' => 'sometimes|required|exists:tenants,id', // Super Admin puede cambiar el tenant_id
                'licence_number' => 'nullable|string|max:255', // AÑADIDO: Validación para licence_number
            ]);
            $facility->update($validated);
            Log::info('Facility updated by Global Admin.', ['facility_id' => $facility->id, 'new_tenant_id' => $validated['tenant_id'] ?? $facility->tenant_id]);
            return response()->json($facility);
        }

        // Para otros usuarios, verificar pertenencia al tenant
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId || $facility->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to update this facility: Facility tenant mismatch or Tenant ID is missing.');
        }

        try {
            $validated = $request->validate([
                'name' => 'sometimes|required|string|max:255',
                'address' => 'nullable|string|max:1000',
                'licence_number' => 'nullable|string|max:255', // AÑADIDO: Validación para licence_number
            ]);

            $facility->update($validated);

            Log::info('Facility updated successfully.', ['facility_id' => $facility->id, 'tenant_id' => $tenantId]);
            return response()->json($facility);
        } catch (ValidationException $e) {
            Log::error('Validation failed during facility update', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::critical('Unexpected error during facility update', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     * DELETE /api/facilities/{facility}
     */
    public function destroy(Request $request, Facility $facility)
    {
        $user = Auth::guard('sanctum')->user();
        if ($user && $user->is_global_admin) {
            // Super Admin puede eliminar cualquier instalación
            $facility->delete();
            Log::info('Facility deleted by Global Admin.', ['facility_id' => $facility->id]);
            return response()->noContent();
        }

        // Para otros usuarios, verificar pertenencia al tenant
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId || $facility->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to delete this facility: Facility tenant mismatch or Tenant ID is missing.');
        }

        try {
            $facility->delete();
            Log::info('Facility deleted successfully.', ['facility_id' => $facility->id, 'tenant_id' => $tenantId]);
            return response()->noContent();
        } catch (\Throwable $e) {
            Log::critical('Error deleting facility', ['facility_id' => $facility->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Failed to delete facility.'], 500);
        }
    }

    public function getFacilitiesByTenantId($tenantId)
    {
        // Asegúrate de que solo los usuarios autorizados puedan ver esto
        // Por ejemplo, un administrador global o un usuario del mismo tenant.
        // Aquí se asume que tu middleware 'identify.tenant' ya maneja la mayoría de los casos,
        // pero podrías añadir lógica de autorización adicional si es necesario.

        $facilities = Facility::where('tenant_id', $tenantId)->get();

        return response()->json($facilities);
    }
}
