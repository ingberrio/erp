<?php

namespace App\Http\Controllers;

use App\Models\TraceabilityEvent;
use App\Models\Batch; // Importar el modelo Batch
use App\Models\CultivationArea; // Importar el modelo CultivationArea
use App\Models\User; // Importar el modelo User
use App\Models\Facility; // Importar el modelo Facility
use App\Models\Stage; // Importar el modelo Stage (si es necesario para alguna relación)
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Carbon\Carbon; // Para manejar fechas

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
            if (!Auth::check() || (!Auth::user()->is_global_admin && $tenantId)) {
                $query->where('tenant_id', $tenantId);
                Log::info('TraceabilityEventController@index: Applying tenant filter: ' . $tenantId);
            } else if (Auth::check() && Auth::user()->is_global_admin) {
                Log::info('TraceabilityEventController@index: Global Admin detected, no tenant filter applied to query.');
            } else {
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

            // Cargar las relaciones 'user' y 'batch'
            $events = $query->with(['user', 'batch'])->get();

            Log::info('TraceabilityEventController@index: Events fetched from DB (with relations):', ['count' => $events->count()]);

            // Mapear los eventos para incluir el nombre del usuario y el nombre del lote directamente
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
                    'user_name' => $event->user ? $event->user->name : 'N/A',
                    'batch_name' => $event->batch ? $event->batch->name : 'N/A',
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
                'batch_id' => 'nullable|integer|exists:batches,id',
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

            
            $validatedData['tenant_id'] = $request->header('X-Tenant-ID') ?: (Auth::user()->tenant_id ?? null);

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

    /**
     * Exporta eventos de trazabilidad a un archivo CSV.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Symfony\Component\HttpFoundation\StreamedResponse
     */
    public function exportCsv(Request $request)
    {
        // 1. Validar y obtener parámetros de la solicitud
        $request->validate([
            'facility_id' => 'required|integer|exists:facilities,id',
            'start_date' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d',
        ]);

        $facilityId = $request->input('facility_id');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');

        // Obtener el tenant_id del usuario autenticado (ya que estás en un middleware 'identify.tenant')
        $tenantId = $request->user()->tenant_id;

        // 2. Construir la consulta de eventos de trazabilidad
        $query = TraceabilityEvent::where('facility_id', $facilityId)
                                  ->where('tenant_id', $tenantId); // Asegúrate de filtrar por tenant_id

        if ($startDate) {
            $query->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        // Cargar relaciones para obtener nombres descriptivos
        $events = $query->with(['batch', 'area', 'user', 'facility'])
                        ->orderBy('created_at', 'asc')
                        ->get();

        // 3. Preparar el archivo CSV
        $filename = "traceability_events_facility_{$facilityId}_" . Carbon::now()->format('Ymd_His') . ".csv";

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        $callback = function() use ($events) {
            $file = fopen('php://output', 'w');

            // Encabezados del CSV (ajusta según los campos que necesites de tus relaciones)
            fputcsv($file, [
                'Event ID',
                'Event Type',
                'Timestamp',
                'User ID',
                'User Name',
                'Batch ID',
                'Batch Name',
                'Batch Variety',
                'Area ID',
                'Area Name',
                'Facility ID',
                'Facility Name',
                'Description',
                'Quantity',
                'Unit',
                'From Location',
                'To Location',
                'Method',
                'Reason',
                'New Batch ID', // Aunque desde el frontend enviamos null, el backend podría tenerlo
                'New Batch Name', // Si existe un new_batch_id y puedes obtener su nombre
            ]);

            foreach ($events as $event) {
                // Obtener nombres de las relaciones (si existen)
                $userName = $event->user ? $event->user->name : 'N/A';
                $batchName = $event->batch ? $event->batch->name : 'N/A';
                $batchVariety = $event->batch ? $event->batch->variety : 'N/A';
                $areaName = $event->area ? $event->area->name : 'N/A';
                $facilityName = $event->facility ? $event->facility->name : 'N/A';
                
                // Si tienes un new_batch_id en el evento y quieres su nombre
                $newBatchName = 'N/A';
                if ($event->new_batch_id) {
                    // Asegúrate de que el modelo Batch tenga una relación inversa o puedas buscarlo
                    $newBatch = Batch::find($event->new_batch_id); 
                    $newBatchName = $newBatch ? $newBatch->name : 'N/A';
                }

                fputcsv($file, [
                    $event->id,
                    $event->event_type,
                    $event->created_at->toIso8601String(), // Formato ISO 8601 para consistencia
                    $event->user_id,
                    $userName,
                    $event->batch_id,
                    $batchName,
                    $batchVariety,
                    $event->area_id,
                    $areaName,
                    $event->facility_id,
                    $facilityName,
                    $event->description,
                    $event->quantity,
                    $event->unit,
                    $event->from_location,
                    $event->to_location,
                    $event->method,
                    $event->reason,
                    $event->new_batch_id,
                    $newBatchName,
                ]);
            }

            fclose($file);
        };

        return new StreamedResponse($callback, 200, $headers);
    }
}