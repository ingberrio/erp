<?php

namespace App\Http\Controllers;

use App\Models\TraceabilityEvent;
use App\Models\Batch; // Importar el modelo Batch
use App\Models\CultivationArea; // Importar el modelo CultivationArea
use App\Models\User; // Importar el modelo User
use App\Models\Facility; // Importar el modelo Facility
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Carbon\Carbon; // Para manejar fechas

class TraceabilityEventController extends Controller
{
    /**
     * Display a listing of the traceability events.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function index(Request $request)
    {
        try {
            Log::info('TraceabilityEventController@index: Request received.', $request->all());

            $query = TraceabilityEvent::query();

            // Lógica para filtrar por tenant_id
            $tenantId = $request->header('X-Tenant-ID') ?? (Auth::check() ? Auth::user()->tenant_id : null);

            if (!$tenantId && (!Auth::check() || !Auth::user()->is_global_admin)) {
                Log::warning('TraceabilityEventController@index: Tenant ID is missing for non-global admin.');
                return response()->json(['message' => 'Tenant ID is required for this action.'], 400);
            }

            if ($tenantId && (!Auth::check() || !Auth::user()->is_global_admin)) {
                $query->where('tenant_id', $tenantId);
                Log::info('TraceabilityEventController@index: Applying tenant filter: ' . $tenantId);
            } elseif (Auth::check() && Auth::user()->is_global_admin) {
                Log::info('TraceabilityEventController@index: Global Admin detected, tenant filter applied conditionally.');
                // Si es global admin, solo aplica el filtro de tenant_id si se especificó en el header
                if ($request->hasHeader('X-Tenant-ID')) {
                    $query->where('tenant_id', $tenantId);
                }
            }


            // Filtrar por facility_id
            // Si el usuario no es global admin, siempre filtra por su facility_id
            if (Auth::check() && !Auth::user()->is_global_admin && Auth::user()->facility_id) {
                $query->where('facility_id', Auth::user()->facility_id);
                Log::info('TraceabilityEventController@index: Filtering by authenticated user facility_id: ' . Auth::user()->facility_id);
            } elseif ($request->has('facility_id')) {
                // Si es global admin o no tiene facility_id asignada, usa la facility_id de la request
                $query->where('facility_id', $request->input('facility_id'));
                Log::info('TraceabilityEventController@index: Filtering by request facility_id: ' . $request->input('facility_id'));
            } else {
                // Si no hay facility_id en la request y no es global admin con facility_id,
                // y no hay X-Tenant-ID, podría ser un problema.
                // Para global admin sin facility_id en request, se espera que no haya filtro de facility.
                if (Auth::check() && Auth::user()->is_global_admin) {
                    Log::info('TraceabilityEventController@index: Global Admin, no specific facility_id filter applied.');
                } else {
                    Log::warning('TraceabilityEventController@index: Facility ID is missing for non-global admin and not provided in request.');
                    // Considerar devolver un error o una lista vacía si esto es un requisito estricto
                    // return response()->json(['message' => 'Facility ID is required for this action.'], 400);
                }
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

            // Ordenar por fecha de creación descendente por defecto
            $query->orderBy('created_at', 'desc');

            // Cargar las relaciones 'user', 'batch', 'area', 'facility', 'newBatch'
            $events = $query->with(['user', 'batch', 'area', 'facility', 'newBatch'])->get();

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
                    'from_sub_location' => $event->from_sub_location, // AÑADIDO
                    'to_sub_location' => $event->to_sub_location,     // AÑADIDO
                    'method' => $event->method,
                    'reason' => $event->reason,
                    'new_batch_id' => $event->new_batch_id,
                    'tenant_id' => $event->tenant_id,
                    'created_at' => $event->created_at,
                    'updated_at' => $event->updated_at,
                    'user_name' => $event->user ? $event->user->name : 'N/A',
                    'batch_name' => $event->batch ? $event->batch->name : 'N/A',
                    'area_name' => $event->area ? $event->area->name : 'N/A',
                    'facility_name' => $event->facility ? $event->facility->name : 'N/A',
                    'new_batch_name' => $event->newBatch ? $event->newBatch->name : 'N/A',
                ];
            });

            Log::info('TraceabilityEventController@index: Formatted Events for response:', ['count' => $formattedEvents->count()]);

            return response()->json($formattedEvents);
        } catch (\Exception $e) {
            Log::error('Error al obtener eventos de trazabilidad: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Error interno del servidor al obtener los eventos.', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        try {
            // Validar los datos de entrada
            $rules = [
                'batch_id' => 'required|integer|exists:batches,id',
                'event_type' => 'required|string|in:movement,cultivation,harvest,sampling,destruction,loss_theft,processing,inventory_adjustment', // AÑADIDO: inventory_adjustment
                'description' => 'nullable|string',
                'area_id' => 'required|integer|exists:cultivation_areas,id',
                'facility_id' => 'required|integer|exists:facilities,id',
                'user_id' => 'required|integer|exists:users,id',
                'quantity' => 'nullable|numeric|min:0',
                'unit' => 'nullable|string|max:50',
                'from_location' => 'nullable|string|max:255',
                'to_location' => 'nullable|string|max:255',
                'from_sub_location' => 'nullable|string|max:255', // AÑADIDO: Validación
                'to_sub_location' => 'nullable|string|max:255',   // AÑADIDO: Validación
                'method' => 'nullable|string|max:255',
                'reason' => 'nullable|string',
                'new_batch_id' => 'nullable|integer|exists:batches,id',
            ];

            // Reglas específicas según el tipo de evento
            switch ($request->event_type) {
                case 'movement':
                    $rules['to_location'] = 'required|string|max:255';
                    // quantity y unit son opcionales para movimiento
                    break;
                case 'cultivation':
                    $rules['method'] = 'required|string|max:255';
                    break;
                case 'harvest':
                    $rules['quantity'] = 'required|numeric|min:0.01';
                    $rules['unit'] = 'required|string|max:50';
                    $rules['new_batch_id'] = 'nullable|integer|exists:batches,id';
                    break;
                case 'sampling':
                    $rules['quantity'] = 'required|numeric|min:0.01';
                    $rules['unit'] = 'required|string|max:50';
                    $rules['reason'] = 'required|string';
                    break;
                case 'destruction':
                    $rules['quantity'] = 'required|numeric|min:0.01';
                    $rules['unit'] = 'required|string|max:50';
                    $rules['method'] = 'required|string|max:255';
                    $rules['reason'] = 'required|string';
                    break;
                case 'loss_theft':
                    $rules['quantity'] = 'required|numeric|min:0.01';
                    $rules['unit'] = 'required|string|max:50';
                    $rules['reason'] = 'required|string';
                    break;
                case 'processing':
                    $rules['quantity'] = 'required|numeric|min:0.01';
                    $rules['unit'] = 'required|string|max:50';
                    $rules['method'] = 'required|string|max:255';
                    break;
                case 'inventory_adjustment': // NEW: Reglas para ajuste de inventario
                    $rules['quantity'] = 'required|numeric'; // Puede ser positivo o negativo
                    $rules['unit'] = 'required|string|max:50';
                    $rules['reason'] = 'required|string';
                    // from_location y to_location pueden ser nulos o la ubicación actual del lote
                    $rules['from_location'] = 'nullable|string|max:255';
                    $rules['to_location'] = 'nullable|string|max:255';
                    $rules['from_sub_location'] = 'nullable|string|max:255';
                    $rules['to_sub_location'] = 'nullable|string|max:255';
                    break;
            }

            $validatedData = $request->validate($rules);

            // Asignar tenant_id automáticamente
            $tenantId = $request->header('X-Tenant-ID') ?? (Auth::check() ? Auth::user()->tenant_id : null);
            if (!$tenantId) {
                Log::error('Tenant ID is missing during traceability event creation.');
                return response()->json(['message' => 'Tenant ID is missing. Cannot create traceability event.'], 400);
            }
            $validatedData['tenant_id'] = $tenantId;

            // Crear el evento de trazabilidad
            $event = TraceabilityEvent::create($validatedData);

            // NEW: Si es un evento de ajuste de inventario, actualizar la cantidad del lote
            if ($event->event_type === 'inventory_adjustment') {
                $batch = Batch::find($event->batch_id);
                if ($batch) {
                    $batch->current_units += $event->quantity; // Suma la cantidad (puede ser negativa)
                    $batch->save();
                    Log::info('Batch units adjusted due to inventory_adjustment event.', [
                        'batch_id' => $batch->id,
                        'adjusted_by' => $event->quantity,
                        'new_units' => $batch->current_units
                    ]);
                } else {
                    Log::warning('TraceabilityEventController@store: Batch not found for inventory_adjustment event.', ['batch_id' => $event->batch_id]);
                }
            }


            Log::info('Evento de trazabilidad registrado:', ['event' => $event->toArray()]);

            return response()->json(['message' => 'Traceability event registered successfully.', 'event' => $event], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Error de validación al registrar evento:', ['errors' => $e->errors(), 'request_data' => $request->all()]);
            return response()->json([
                'message' => 'Error de validación al registrar el evento.',
                'details' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error al registrar evento de trazabilidad: ' . $e->getMessage(), ['trace' => $e->getTraceAsString(), 'request_data' => $request->all()]);
            return response()->json(['message' => 'Error interno del servidor al registrar el evento.', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified traceability event.
     *
     * @param  \App\Models\TraceabilityEvent  $traceabilityEvent
     * @return \Illuminate\Http\Response
     */
    public function show(TraceabilityEvent $traceabilityEvent)
    {
        // Asegurar que el evento pertenece al tenant o facility del usuario
        $tenantId = request()->header('X-Tenant-ID') ?? (Auth::check() ? Auth::user()->tenant_id : null);

        if ($traceabilityEvent->tenant_id != $tenantId && (!Auth::check() || !Auth::user()->is_global_admin)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // Cargar relaciones
        $traceabilityEvent->load(['batch', 'user', 'area', 'facility', 'newBatch']);

        return response()->json($traceabilityEvent);
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

        // Obtener el tenant_id del usuario autenticado o del header
        $tenantId = $request->header('X-Tenant-ID') ?? (Auth::check() ? Auth::user()->tenant_id : null);

        if (!$tenantId) {
            return response()->json(['message' => 'Tenant ID is required for CSV export.'], 400);
        }

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
        $events = $query->with(['batch', 'area', 'user', 'facility', 'newBatch']) // Cargar newBatch aquí
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
                'From Sub-Location', // AÑADIDO
                'To Location',
                'To Sub-Location',   // AÑADIDO
                'Method',
                'Reason',
                'New Batch ID',
                'New Batch Name',
            ]);

            foreach ($events as $event) {
                // Obtener nombres de las relaciones (si existen)
                $userName = $event->user ? $event->user->name : 'N/A';
                $batchName = $event->batch ? $event->batch->name : 'N/A';
                $batchVariety = $event->batch ? $event->batch->variety : 'N/A';
                $areaName = $event->area ? $event->area->name : 'N/A';
                $facilityName = $event->facility ? $event->facility->name : 'N/A';
                
                // Obtener el nombre del nuevo lote si existe
                $newBatchName = $event->newBatch ? $event->newBatch->name : 'N/A';

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
                    $event->from_sub_location, // AÑADIDO
                    $event->to_location,
                    $event->to_sub_location,   // AÑADIDO
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
