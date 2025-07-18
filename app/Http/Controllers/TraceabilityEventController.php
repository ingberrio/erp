<?php

namespace App\Http\Controllers;

use App\Models\TraceabilityEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log; // Asegúrate de que esta importación esté presente
use Illuminate\Support\Facades\Auth; // Asegúrate de que esta importación esté presente

class TraceabilityEventController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        try {
            Log::info('TraceabilityEventController@index: Request received.', $request->all());

            $query = TraceabilityEvent::query();

            // Lógica para filtrar por tenant_id
            $tenantId = null;
            if ($request->hasHeader('X-Tenant-ID')) {
                $tenantId = $request->header('X-Tenant-ID');
                Log::info('TraceabilityEventController@index: Using X-Tenant-ID from header: ' . $tenantId);
            } else if (Auth::check() && Auth::user()->tenant_id) {
                $tenantId = Auth::user()->tenant_id;
                Log::info('TraceabilityEventController@index: Using authenticated user tenant_id: ' . $tenantId);
            }

            // Aplicar filtro de tenant_id si no es Super Admin o si hay un tenantId definido
            // Si su Super Admin puede ver todos los tenants, ajuste esta lógica.
            // Actualmente, si no hay X-Tenant-ID y no es Super Admin con tenant_id, se requerirá.
            if (!Auth::check() || (!Auth::user()->is_global_admin && $tenantId)) {
                $query->where('tenant_id', $tenantId);
                Log::info('TraceabilityEventController@index: Applying tenant filter: ' . $tenantId);
            } else if (Auth::check() && Auth::user()->is_global_admin) {
                Log::info('TraceabilityEventController@index: Global Admin detected, no tenant filter applied to query.');
            } else {
                // Si no se pudo determinar el tenantId y no es global admin, retornar error
                Log::warning('TraceabilityEventController@index: Tenant ID is missing for non-global admin.');
                return response()->json(['message' => 'Tenant ID is required for this action.'], 400);
            }


            // Filtrar por area_id si se proporciona en los parámetros de la URL
            if ($request->has('area_id')) {
                $query->where('area_id', $request->input('area_id'));
                Log::info('TraceabilityEventController@index: Filtering by area_id: ' . $request->input('area_id'));
            }

            // Filtrar por batch_id si se proporciona en los parámetros de la URL
            if ($request->has('batch_id') && $request->input('batch_id') !== 'all') {
                $query->where('batch_id', $request->input('batch_id'));
                Log::info('TraceabilityEventController@index: Filtering by batch_id: ' . $request->input('batch_id'));
            }

            // Opcional: Ordenar los resultados (ej. por fecha descendente)
            $query->orderBy('created_at', 'desc');

            // *** CAMBIO CLAVE AQUÍ: Cargar las relaciones 'user' y 'batch' ***
            $events = $query->with(['user', 'batch'])->get(); // Carga la relación 'user' y 'batch'

            Log::info('TraceabilityEventController@index: Events fetched from DB (with relations):', ['count' => $events->count()]);

            // Mapear los eventos para incluir el nombre del usuario y el nombre del lote directamente
            // Esto es útil si el frontend espera propiedades planas como 'user_name' y 'batch_name'
            $formattedEvents = $events->map(function($event) {
                return [
                    'id' => $event->id,
                    'batch_id' => $event->batch_id,
                    'area_id' => $event->area_id,
                    'facility_id' => $event->facility_id,
                    'user_id' => $event->user_id,
                    'event_type' => $event->event_type,
                    'description' => $event->description,
                    'quantity' => $event->quantity,
                    'unit' => $event->unit,
                    'from_location' => $event->from_location,
                    'to_location' => $event->to_location,
                    'method' => $event->method,
                    'reason' => $event->reason,
                    'new_batch_id' => $event->new_batch_id,
                    'tenant_id' => $event->tenant_id,
                    'created_at' => $event->created_at,
                    'updated_at' => $event->updated_at,
                    'user_name' => $event->user ? $event->user->name : 'N/A', // Nombre del usuario
                    'batch_name' => $event->batch ? $event->batch->name : 'N/A', // Nombre del lote
                ];
            });

            Log::info('TraceabilityEventController@index: Formatted Events for response:', ['count' => $formattedEvents->count()]);

            return response()->json($formattedEvents);
        } catch (\Exception $e) {
            Log::error('Error al obtener eventos de trazabilidad:', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Error interno del servidor al obtener los eventos.', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        try {
            // Validar los datos de entrada
            $validatedData = $request->validate([
                'batch_id' => 'nullable|integer|exists:batches,id', // 'batch_id' puede ser nulo para eventos de cultivo generales
                'event_type' => 'required|string|max:255',
                'description' => 'nullable|string',
                'area_id' => 'required|integer|exists:cultivation_areas,id',
                'facility_id' => 'required|integer|exists:facilities,id',
                'user_id' => 'required|integer|exists:users,id',
                'quantity' => 'nullable|numeric',
                'unit' => 'nullable|string|max:50',
                'from_location' => 'nullable|string|max:255',
                'to_location' => 'nullable|string|max:255',
                'method' => 'nullable|string|max:255',
                'reason' => 'nullable|string',
                'new_batch_id' => 'nullable|integer|exists:batches,id',
            ]);

            // Asignar el tenant_id si es necesario (depende de su lógica de middleware y modelo)
            // Si su middleware 'identify.tenant' ya inyecta el tenant_id en la request o en un scope,
            // esta línea podría ser redundante o necesitar un ajuste.
            // Por ejemplo, si TraceabilityEvent tiene un campo 'tenant_id' y no se asigna automáticamente:
            // $validatedData['tenant_id'] = $request->header('X-Tenant-ID') ?: Auth::user()->tenant_id;
            // La lógica de `booted()` en el modelo TraceabilityEvent debería manejar esto si `tenant()` helper está disponible.


            $event = TraceabilityEvent::create($validatedData);

            Log::info('Evento de trazabilidad registrado:', ['event' => $event->toArray()]);

            return response()->json($event, 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Error de validación al registrar evento:', ['errors' => $e->errors()]);
            return response()->json([
                'message' => 'Error de validación al registrar el evento.',
                'details' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error al registrar evento de trazabilidad:', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Error interno del servidor al registrar el evento.', 'error' => $e->getMessage()], 500);
        }
    }

}
