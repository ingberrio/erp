<?php

namespace App\Http\Controllers;

use App\Models\Stage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log; // Importa la fachada Log

class StageController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        Log::info('StageController@index: Iniciando método.'); // Log 1

        try {
            // Asumo que tu modelo Stage ya tiene un Global Scope para tenant_id
            // Si no lo tiene, deberías filtrar así:
            // $stages = Stage::where('tenant_id', auth()->user()->tenant_id)->orderBy('order')->get();
            // Pero lo ideal es usar un Global Scope para evitar repetir el filtro.
            $stages = Stage::orderBy('order')->get();

            Log::info('StageController@index: Etapas obtenidas de la base de datos.', ['count' => $stages->count()]); // Log 2

            return response()->json($stages);

        } catch (\Exception $e) {
            Log::error('StageController@index: Error al obtener etapas.', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]); // Log 3
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
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $stage = Stage::create([
            'name' => $request->name,
            'order' => Stage::max('order') + 1, // Asigna el siguiente orden disponible
            // tenant_id se asignará automáticamente si tienes un Global Scope
        ]);

        return response()->json($stage, 201);
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
            'order' => 'nullable|integer', // Permite actualizar el orden
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
        // Antes de eliminar, puedes verificar si hay áreas de cultivo asociadas
        // y si las hay, puedes lanzar un error o eliminarlas en cascada.
        // Por ahora, si hay áreas, la eliminación fallará por restricción de clave foránea.
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
