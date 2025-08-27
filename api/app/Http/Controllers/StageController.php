<?php

namespace App\Http\Controllers;

use App\Models\Stage;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class StageController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        Log::info('StageController@index: Iniciando método.');

        try {
            $stages = Stage::orderBy('order')->get();

            Log::info('StageController@index: Etapas obtenidas de la base de datos.', ['count' => $stages->count()]);

            return response()->json($stages);

        } catch (\Exception $e) {
            Log::error('StageController@index: Error al obtener etapas.', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['message' => 'Error interno del servidor al obtener etapas.'], 500);
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
        $user = auth()->user();

        Log::info('DEBUG_BACKEND: Incoming Stage Creation Request Payload:', $request->all());

        $rules = [
            'name' => 'required|string|max:255',
            'order' => 'nullable|integer',
        ];

        if ($user->is_global_admin) {
            $rules['tenant_id'] = ['required', 'integer', Rule::exists('tenants', 'id')];
        }

        try {
            $validatedData = $request->validate($rules);

            $dataToCreate = [
                'name' => $validatedData['name'],
                'order' => $validatedData['order'] ?? (Stage::max('order') + 1),
            ];

            if ($user->is_global_admin) {
                $dataToCreate['tenant_id'] = $validatedData['tenant_id'];
            } else {
                $dataToCreate['tenant_id'] = $user->tenant_id;
            }

            Log::info('DEBUG_BACKEND: Stage dataToCreate before model creation:', $dataToCreate);
            // dd($dataToCreate); // <-- ¡COMENTA O ELIMINA ESTA LÍNEA!

            if (empty($dataToCreate['tenant_id'])) {
                Log::error('HasTenant Trait: Fallo al asignar tenant_id al modelo App\Models\Stage durante la creación. Tenant ID es null. Datos de Request:', [
                    'request_data' => $request->all(),
                    'auth_user_id' => $user->id,
                    'auth_is_global_admin' => $user->is_global_admin,
                    'auth_tenant_id' => $user->tenant_id,
                    'data_to_create_at_error' => $dataToCreate
                ]);
                return response()->json(['message' => 'No se puede crear la etapa: El ID de inquilino no se proporcionó o es inválido.'], 422);
            }

            $stage = Stage::create($dataToCreate);

            return response()->json($stage, 201);

        } catch (ValidationException $e) {
            Log::error('DEBUG_BACKEND: Validation failed during Stage store:', [
                'errors' => $e->errors(),
                'request_payload' => $request->all(),
                'user_id' => $user->id,
                'is_global_admin' => $user->is_global_admin,
            ]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('DEBUG_BACKEND: Unexpected error during Stage store:', [
                'error_message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_payload' => $request->all(),
                'user_id' => $user->id,
                'is_global_admin' => $user->is_global_admin,
            ]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     *
     * @param  \App\Models\Stage  $stage
     * @return \Illuminate\Http\Response
     */
    public function show(Stage $stage)
    {
        return response()->json($stage);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Stage  $stage
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, Stage $stage)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'order' => 'nullable|integer',
        ]);

        $stage->update($request->all());

        return response()->json($stage);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  \App\Models\Stage  $stage
     * @return \Illuminate\Http\Response
     */
    public function destroy(Stage $stage)
    {
        $stage->delete();
        return response()->json(null, 204);
    }

    /**
     * Reorder stages.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function reorder(Request $request)
    {
        $request->validate([
            'stage_ids' => 'required|array',
            'stage_ids.*' => 'exists:stages,id',
        ]);

        foreach ($request->stage_ids as $index => $stageId) {
            Stage::where('id', $stageId)->update(['order' => $index]);
        }

        return response()->json(['message' => 'Stages reordered successfully'], 200);
    }
}
